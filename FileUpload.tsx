
import React, { useState, useRef } from 'react';
import { Upload, FileText, Image as ImageIcon, X, AlertCircle, ShieldAlert, Loader2, Zap } from 'lucide-react';
import { SummaryMode, StudyMaterial } from './types';
import { GeminiService } from './services/gemini';
import { supabase } from './lib/supabase';

interface FileUploadProps {
  userEmail: string;
  onProcessingStart: () => void;
  onComplete: (data: StudyMaterial) => void;
  onCancel: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ userEmail, onProcessingStart, onComplete, onCancel }) => {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<SummaryMode>(SummaryMode.BULLET);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<{ message: string; type?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 30 * 1024 * 1024) {
        setError({ message: 'File size exceeds 30MB limit.' });
        return;
      }
      setFile(selected);
      setError(null);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleStart = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    onProcessingStart();

    try {
      setStatusText('Securing document...');
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${userEmail}/${fileName}`;

      const { error: storageError } = await supabase.storage
        .from('study-materials')
        .upload(filePath, file);

      if (storageError) throw storageError;

      setStatusText('Initializing database...');
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

      setStatusText('Genie at work: Extracting insights...');
      const base64 = await readFileAsBase64(file);
      
      // OPTIMIZATION: Generate summary first to get user to the ResultView fast
      const summary = await GeminiService.generateSummary(base64, file.type, mode);
      
      setStatusText('Finalizing summary...');
      const { data: summaryData, error: summaryError } = await supabase
        .from('summaries')
        .insert({
          upload_id: uploadData.id,
          user_email: userEmail,
          summary_style: mode,
          title: file.name,
          content: summary,
          ai_model_used: 'gemini-3-pro-preview'
        })
        .select()
        .single();

      if (summaryError) throw summaryError;

      const material: StudyMaterial = {
        id: summaryData.id,
        title: file.name,
        summary: summary,
        flashcards: [], // Populated on-demand in ResultView
        quiz: [],       // Populated on-demand in ResultView
        mode: mode,
        createdAt: summaryData.created_at
      };

      onComplete(material);
    } catch (err: any) {
      console.error('Processing Pipeline Failed:', err);
      
      // Robust error message extraction to prevent [object Object]
      let finalMessage = 'An unexpected error occurred during processing.';
      if (typeof err === 'string') finalMessage = err;
      else if (err?.message) finalMessage = err.message;
      else if (typeof err === 'object') finalMessage = JSON.stringify(err);

      setError({ 
        message: finalMessage,
        type: err?.code || 'System'
      });
      setIsUploading(false);
      setStatusText('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Transform Material</h2>
        <p className="text-slate-400">Genie will extract summaries instantly. Quizzes & Flashcards generated later.</p>
      </div>

      <div 
        className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${
          file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-slate-800 hover:border-cyan-500/50 bg-slate-900/50'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onClick={() => !file && !isUploading && fileInputRef.current?.click()}
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
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center">
                {file.type.includes('image') ? <ImageIcon size={32} /> : <FileText size={32} />}
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-200">{file.name}</p>
              <p className="text-sm text-slate-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
            </div>
            {!isUploading && (
              <button 
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
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
                <Upload size={32} />
              </div>
            </div>
            <p className="text-slate-400 font-medium">Click to select study document</p>
          </div>
        )}
      </div>

      {!isUploading && (
        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-400 uppercase tracking-wider">Extraction Mode</label>
          <div className="grid grid-cols-3 gap-4">
            {[
              { id: SummaryMode.BULLET, label: 'Bullet', desc: 'Core points' },
              { id: SummaryMode.DETAILED, label: 'Deep', desc: 'Full study' },
              { id: SummaryMode.TLDR, label: 'TL;DR', desc: 'Snap view' }
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as SummaryMode)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  mode === m.id 
                  ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500' 
                  : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className={`font-bold mb-1 ${mode === m.id ? 'text-cyan-400' : 'text-white'}`}>{m.label}</div>
                <div className="text-[10px] text-slate-500 leading-tight uppercase font-black tracking-widest">{m.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-2xl flex items-start gap-4 text-red-400 animate-in fade-in slide-in-from-top-2 shadow-lg">
          <ShieldAlert size={24} className="shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em]">{error.type === '42703' ? 'Database Mismatch' : 'System Fault'}</p>
            <p className="text-sm font-medium leading-relaxed">{error.message}</p>
            {error.message.includes('user_email') && (
              <div className="mt-3 p-3 bg-red-500/20 rounded-xl border border-red-500/30">
                <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-white">Action Required</p>
                <p className="text-xs text-slate-200">The database is missing required columns. Go to the <strong>Arch</strong> page and run the Repair Script.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {isUploading && (
        <div className="flex flex-col items-center gap-4 text-cyan-400 font-medium animate-pulse">
          <div className="flex items-center gap-2">
            <Loader2 className="animate-spin" size={20} />
            {statusText}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Priority: Summarizing content first...</div>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <button 
          onClick={onCancel}
          disabled={isUploading}
          className="flex-1 py-4 px-6 border border-slate-800 text-slate-400 font-bold rounded-2xl hover:bg-slate-900 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button 
          disabled={!file || isUploading}
          onClick={handleStart}
          className={`flex-1 py-4 px-6 font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${
            !file || isUploading 
            ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
            : 'bg-gradient-to-r from-cyan-600 to-emerald-600 text-white hover:shadow-cyan-500/20 active:scale-95'
          }`}
        >
          <Zap size={18} />
          Fast Process
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
