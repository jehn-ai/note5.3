
import React, { useMemo, useRef, useState } from 'react';
import { X, FileText, Image as ImageIcon, Loader2, Zap, Layers, ShieldAlert, Cloud, HardDrive } from 'lucide-react';
import { StudyMaterial, AppTheme } from '../types';
import { GeminiService } from '../services/gemini';
import { supabase } from '../lib/supabase';

type StudyGoal = 'quick' | 'standard' | 'exam';
type StorageMode = 'local' | 'cloud';

interface FileUploadProps {
  userEmail: string;
  theme: AppTheme;
  onProcessingStart: () => void;
  onComplete: (data: StudyMaterial) => void;
  onUpdate?: (data: Partial<StudyMaterial>) => void;
  onCancel: () => void;
}

/* ---------------------------
   Minimal IndexedDB helpers
   Stores:
   - files: Blob
   - materials: JSON
---------------------------- */
const DB_NAME = 'notegenie';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
      if (!db.objectStoreNames.contains('materials')) db.createObjectStore('materials');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(storeName: 'files' | 'materials', key: string, value: any) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function safeIdFromEmail(email: string) {
  // avoid raw email in paths or ids
  return btoa(email).replace(/=+/g, '').replace(/[+/]/g, '_');
}

// REDUCED TO 10MB to prevent XHR/Browser crashes with inline base64
const MAX_FILE_MB = 10;

const FileUpload: React.FC<FileUploadProps> = ({ userEmail, theme, onProcessingStart, onComplete, onUpdate, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [studyGoal, setStudyGoal] = useState<StudyGoal>('standard');
  const [storageMode, setStorageMode] = useState<StorageMode>('local');

  const [isWorking, setIsWorking] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<{ message: string; type?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const isPDF = useMemo(() => !!file?.name?.toLowerCase().endsWith('.pdf'), [file]);

  const goalConfig = useMemo(() => {
    if (studyGoal === 'quick') return { label: 'Quick Study', desc: '10 core cards', targetCards: 10 };
    if (studyGoal === 'exam') return { label: 'Exam Prep', desc: '50 cards + tougher recall', targetCards: 50 };
    return { label: 'Standard', desc: '25 cards', targetCards: 25 };
  }, [studyGoal]);

  const readFileAsBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(f);
    });

  const validateFile = (selected: File) => {
    const sizeMB = selected.size / (1024 * 1024);
    if (sizeMB > MAX_FILE_MB) {
      return `File size exceeds ${MAX_FILE_MB}MB limit. Larger files can cause network timeouts.`;
    }
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const msg = validateFile(selected);
    if (msg) {
      setError({ message: msg, type: 'Validation' });
      return;
    }

    setFile(selected);
    setError(null);
  };

  const handleRemove = () => {
    if (isWorking) return;
    setFile(null);
    setError(null);
  };

  const handleCancel = () => {
    cancelRef.current = true;
    setStatusText('Stopping...');
    onCancel();
  };

  const handleStart = async () => {
    if (!file || isWorking) return;

    cancelRef.current = false;
    setIsWorking(true);
    setError(null);
    onProcessingStart();

    const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const localKey = `${safeIdFromEmail(userEmail)}:${sessionId}`;

    try {
      setStatusText('Preparing your deck...');
      const base64 = await readFileAsBase64(file);

      if (cancelRef.current) throw new Error('Cancelled');

      // 1) Local-first save: keep the original file on device
      if (storageMode === 'local') {
        setStatusText('Saving to this device...');
        await idbSet('files', localKey, file);
      }

      if (cancelRef.current) throw new Error('Cancelled');

      // 2) Flashcards FIRST
      setStatusText('Creating flashcards...');
      let flashcards: Array<{ question: string; answer: string }> = [];

      // Use the newly added direct method
      if (GeminiService.generateFlashcardsFromDocument) {
        flashcards = await GeminiService.generateFlashcardsFromDocument(base64, file.type, {
          targetCards: goalConfig.targetCards,
          difficulty: studyGoal
        });
      } else {
        // Fallback
        const quickContext = await GeminiService.generateSummary(base64, file.type, 'TLDR' as any);
        flashcards = await GeminiService.generateFlashcards(quickContext);
      }

      if (cancelRef.current) throw new Error('Cancelled');

      // Create material NOW so user lands on Flashcards immediately
      const material: StudyMaterial = {
        id: sessionId,
        title: file.name,
        summary: '',          // summary loads later
        flashcards,
        quiz: [],
        mode: studyGoal as any,
        createdAt: new Date().toISOString()
      };

      // Save material locally so refresh does not wipe progress
      if (storageMode === 'local') {
        await idbSet('materials', localKey, material);
      }

      // Immediately route user to Flashcards screen
      onComplete(material);

      // 3) Background work: summary + optional cloud upload
      setStatusText('Finalizing summary...');
      const summary = await GeminiService.generateSummary(base64, file.type, 'BULLET' as any);

      // --- CRITICAL SYNC FIX: Update the live app state ---
      if (onUpdate) {
        onUpdate({ summary });
      }

      if (!cancelRef.current && storageMode === 'local') {
        const updated = { ...material, summary };
        await idbSet('materials', localKey, updated);
      }

      if (cancelRef.current) return;

      if (storageMode === 'cloud') {
        setStatusText('Saving to cloud...');
        const fileExt = file.name.split('.').pop() || 'bin';
        const userKey = safeIdFromEmail(userEmail);
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        const filePath = `uploads/${userKey}/${fileName}`;

        const { error: storageError } = await supabase.storage
          .from('study-materials')
          .upload(filePath, file, { contentType: file.type, upsert: false });

        if (storageError) throw storageError;

        const { data: uploadData, error: uploadDbError } = await supabase
          .from('uploads')
          .insert({
            user_email: userEmail,
            file_name: file.name,
            file_size: file.size,
            file_type: file.type,
            storage_path: filePath
          })
          .select()
          .single();

        if (uploadDbError) throw uploadDbError;

        const { data: summaryData, error: summaryError } = await supabase
          .from('summaries')
          .insert({
            upload_id: uploadData.id,
            user_email: userEmail,
            summary_style: 'BULLET',
            title: file.name,
            content: summary,
            ai_model_used: 'gemini-3-flash-preview'
          })
          .select()
          .single();

        if (summaryError) throw summaryError;

        if (flashcards.length) {
          const flashcardsToInsert = flashcards.map(f => ({
            summary_id: summaryData.id,
            user_email: userEmail,
            front: f.question,
            back: f.answer
          }));
          const { error: fcErr } = await supabase.from('flashcards').insert(flashcardsToInsert);
          if (fcErr) throw fcErr;
        }
      }
    } catch (err: any) {
      if (err?.message === 'Cancelled') return;

      let finalMessage = 'An unexpected error occurred during processing.';
      if (typeof err === 'string') finalMessage = err;
      else if (err?.message) finalMessage = err.message;

      setError({ message: finalMessage, type: err?.code || 'System' });
    } finally {
      setIsWorking(false);
      setStatusText('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Create Flashcard Deck</h2>
        <p className="text-slate-400">
          Upload your slides and start flipping cards in seconds.
        </p>
      </div>

      {/* Storage Mode */}
      {!isWorking && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setStorageMode('local')}
            className={`px-4 py-2 rounded-2xl border text-sm font-bold flex items-center gap-2 transition-smooth active-press ${
              storageMode === 'local'
                ? (theme === 'genie' ? 'border-pink-500 bg-pink-500/10 text-pink-300 hover-glow' : 'border-emerald-500 bg-emerald-500/10 text-emerald-300 hover-glow')
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
            }`}
          >
            <HardDrive size={16} /> Local
          </button>
          <button
            onClick={() => setStorageMode('cloud')}
            className={`px-4 py-2 rounded-2xl border text-sm font-bold flex items-center gap-2 transition-smooth active-press ${
              storageMode === 'cloud'
                ? (theme === 'genie' ? 'border-purple-500 bg-purple-500/10 text-purple-300 hover-glow' : 'border-cyan-500 bg-cyan-500/10 text-cyan-300 hover-glow')
                : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700'
            }`}
          >
            <Cloud size={16} /> Cloud
          </button>
        </div>
      )}

      {/* Upload Box */}
      <div
        className={`border-2 border-dashed rounded-3xl p-12 text-center transition-smooth cursor-pointer hover-lift ${
          file 
            ? (theme === 'genie' ? 'border-pink-500/50 bg-pink-500/5' : 'border-emerald-500/50 bg-emerald-500/5')
            : (`border-slate-800 bg-slate-900/50 ${theme === 'genie' ? 'hover:border-purple-500/50' : 'hover:border-cyan-500/50'}`)
        } ${isWorking ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => !file && !isWorking && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.docx,.txt,image/*"
        />

        {file ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${theme === 'genie' ? 'bg-pink-500/20 text-pink-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {file.type.includes('image') ? <ImageIcon size={32} /> : <FileText size={32} />}
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-200">{file.name}</p>
              <p className="text-sm text-slate-500">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
                {isPDF ? '  •  Slides PDF' : ''}
              </p>
            </div>
            {!isWorking && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="text-red-400 hover:text-red-300 text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <X size={16} /> Remove
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-slate-800 text-slate-500 rounded-2xl flex items-center justify-center">
                <Layers size={32} />
              </div>
            </div>
            <p className="text-slate-400 font-medium">Click to upload slides, notes, or docs</p>
            <p className="text-xs text-slate-500">Flashcards are created first. Summary follows.</p>
          </div>
        )}
      </div>

      {/* Study Goal */}
      {!isWorking && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Study Goal</label>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: 'quick' as const, label: 'Quick', desc: '10 core cards' },
              { id: 'standard' as const, label: 'Standard', desc: '25 cards' },
              { id: 'exam' as const, label: 'Exam', desc: '50 cards' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setStudyGoal(m.id)}
                className={`p-4 rounded-2xl border text-left transition-smooth active-press hover-lift ${
                  studyGoal === m.id
                    ? (theme === 'genie' ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500 hover-glow' : 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500 hover-glow')
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className={`font-bold mb-1 ${studyGoal === m.id ? (theme === 'genie' ? 'text-purple-400' : 'text-cyan-400') : 'text-white'}`}>
                  {m.label}
                </div>
                <div className="text-[10px] text-slate-500 leading-tight uppercase font-black tracking-widest">
                  {m.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl flex items-start gap-4 text-red-400 animate-in fade-in slide-in-from-top-2 shadow-lg">
          <ShieldAlert size={24} className="shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em]">{error.type || 'System Fault'}</p>
            <p className="text-sm font-medium leading-relaxed">{error.message}</p>
          </div>
        </div>
      )}

      {/* Working */}
      {isWorking && (
        <div className={`flex flex-col items-center gap-4 font-medium animate-pulse ${theme === 'genie' ? 'text-purple-400' : 'text-cyan-400'}`}>
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            {statusText || 'Working...'}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
            Goal: {goalConfig.label}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 pt-4">
        <button
          onClick={handleCancel}
          disabled={isWorking && statusText === 'Stopping...'}
          className="flex-1 py-4 px-6 border border-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-900 transition-smooth active-press disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          disabled={!file || isWorking}
          onClick={handleStart}
          className={`flex-1 py-4 px-6 font-bold rounded-2xl shadow-lg transition-smooth active-press flex items-center justify-center gap-2 ${
            !file || isWorking
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : (theme === 'genie' 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-purple-500/20 hover:shadow-2xl hover-glow' 
                  : 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white hover:shadow-cyan-500/20 hover:shadow-2xl hover-glow')
          }`}
        >
          <Zap size={18} />
          {isWorking ? 'Building Deck...' : 'Start Flashcards'}
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
