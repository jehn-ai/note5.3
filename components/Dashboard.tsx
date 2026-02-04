import React, { useEffect, useState } from 'react';
import { AppTheme, StudyMaterial } from '../types';
import { Plus, History, BookOpen, Clock, ChevronRight, UserCircle, ShieldAlert, Layers, HardDrive, Cloud } from 'lucide-react';


interface DashboardProps {
  history: StudyMaterial[];
  theme: AppTheme;
  onUploadClick: () => void;
  onViewMaterial: (m: StudyMaterial) => void;
}

// Minimal IDB helper for Dashboard
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

async function idbGetAll(storeName: 'materials') {
  try {
    const db = await openDB();
    return new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("IDB Access Error", e);
    return [];
  }
}

const Dashboard: React.FC<DashboardProps> = ({ history: cloudHistory, theme, onUploadClick, onViewMaterial }) => {
  const [isGuest, setIsGuest] = useState(false);
  const [localMaterials, setLocalMaterials] = useState<StudyMaterial[]>([]);

  useEffect(() => {
    const currentEmail = localStorage.getItem('notegenie_user_email');
    if (currentEmail && currentEmail.includes('guest_')) {
      setIsGuest(true);
    }
    
    // Fetch local materials
    idbGetAll('materials').then(locals => {
      // Sort locals by date desc
      const sorted = locals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLocalMaterials(sorted);
    });
  }, []);

  // Merge and deduplicate (prefer Cloud if ID matches, though IDs usually differ)
  // Logic: Local IDs are strings (sessionId), Cloud are UUIDs.
  // We just list both. Local ones might be temporary.
  const mergedHistory = [...localMaterials, ...cloudHistory].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Simple dedupe by title + date to avoid obvious dupes if we ever sync properly? 
  // For now, keep simple.

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-3xl font-bold text-white tracking-tight">Your Flashcard Decks</h2>
            {isGuest && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-black uppercase tracking-widest">
                <UserCircle size={12} /> Guest Session
              </span>
            )}
          </div>
          <p className="text-slate-400 font-medium">Master your subjects, one card at a time.</p>
        </div>
        <button 
          onClick={onUploadClick}
          className={`${theme === 'genie' ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/30' : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-900/30'} text-white px-6 py-4 rounded-2xl flex items-center gap-3 font-bold shadow-lg transition-all active:scale-95 group`}
        >
          <Plus size={24} className="group-hover:rotate-90 transition-transform" />
          Create New Deck
        </button>
      </div>

      {isGuest && (
        <div className="bg-slate-900/80 border border-amber-500/20 p-5 rounded-[2rem] flex items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 shrink-0">
              <ShieldAlert size={20} />
            </div>
            <p className="text-sm text-slate-300 font-medium">
              <span className="text-amber-400 font-bold uppercase text-[10px] tracking-widest block mb-0.5">Persistence Warning</span> 
              Guest sessions are local and temporary. Use your academic email to save progress across devices.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={`bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex items-center gap-4 transition-colors shadow-sm ${theme === 'genie' ? 'hover:border-purple-500/30' : 'hover:border-cyan-500/30'}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'genie' ? 'bg-purple-500/10 text-purple-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
            <Layers size={28} />
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{mergedHistory.length}</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Decks</div>
          </div>
        </div>
        <div className={`bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex items-center gap-4 transition-colors shadow-sm ${theme === 'genie' ? 'hover:border-pink-500/30' : 'hover:border-emerald-500/30'}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'genie' ? 'bg-pink-500/10 text-pink-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <History size={28} />
          </div>
          <div>
            <div className="text-3xl font-bold text-white">{mergedHistory.reduce((acc, curr) => acc + (curr.flashcards?.length || 0), 0)}</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cards Mastered</div>
          </div>
        </div>
        <div className={`bg-slate-900 border border-slate-800 p-6 rounded-[2rem] flex items-center gap-4 transition-colors shadow-sm ${theme === 'genie' ? 'hover:border-indigo-500/30' : 'hover:border-purple-500/30'}`}>
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'genie' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-purple-500/10 text-purple-400'}`}>
            <Clock size={28} />
          </div>
          <div>
            <div className="text-3xl font-bold text-white">99.9%</div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sync Uptime</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2 pl-2">
          <History size={20} className={theme === 'genie' ? "text-purple-400" : "text-cyan-400"} />
          Continue Studying
        </h3>
        {mergedHistory.length === 0 ? (
          <div className="bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-[3rem] py-24 text-center text-slate-500 flex flex-col items-center gap-4 shadow-inner">
            <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center border border-slate-800 shadow-xl">
              <Plus size={32} className="opacity-20" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-300">No decks found</p>
              <p className="text-sm">Upload your first document to create a deck.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {mergedHistory.map((m) => {
              const isLocal = !m.id.includes('-'); // Rough heuristic: UUIDs have dashes, Random string sessionIds usually don't (or diff format)
              // Better: check if it exists in localMaterials array
              const isActuallyLocal = localMaterials.some(l => l.id === m.id);

              return (
                <div 
                  key={m.id}
                  onClick={() => onViewMaterial(m)}
                  className={`group bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl flex items-center justify-between cursor-pointer transition-all hover:bg-slate-900 shadow-sm ${
                    theme === 'genie' ? 'hover:border-purple-500/50' : 'hover:border-cyan-500/50'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner ${
                      isActuallyLocal 
                        ? (theme === 'genie' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400')
                        : (theme === 'genie' 
                            ? 'bg-slate-800/80 text-slate-500 group-hover:bg-purple-500 group-hover:text-white' 
                            : 'bg-slate-800/80 text-slate-500 group-hover:bg-cyan-500 group-hover:text-white')
                    }`}>
                      {isActuallyLocal ? <HardDrive size={24} /> : <BookOpen size={24} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={`font-bold text-slate-200 transition-colors tracking-tight ${theme === 'genie' ? 'group-hover:text-purple-400' : 'group-hover:text-cyan-400'}`}>{m.title}</h4>
                        {isActuallyLocal && (
                          <span className={`text-[10px] border px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${
                            theme === 'genie' 
                              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}>
                            Device
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                        {new Date(m.createdAt).toLocaleDateString()} • {m.flashcards?.length || 0} Cards
                      </p>
                    </div>
                  </div>
                  <div className={`bg-slate-800/50 p-2 rounded-xl transition-colors ${theme === 'genie' ? 'group-hover:bg-purple-500/10' : 'group-hover:bg-cyan-500/10'}`}>
                    <ChevronRight size={20} className={`text-slate-600 transition-all group-hover:translate-x-1 ${theme === 'genie' ? 'group-hover:text-purple-400' : 'group-hover:text-cyan-400'}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;