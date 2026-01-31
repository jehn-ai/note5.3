import React, { useState, useEffect } from 'react';
import { AppStep, StudyMaterial, SummaryMode } from './types';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import FileUpload from './components/FileUpload';
import ProcessingAnimation from './components/ProcessingAnimation';
import ResultView from './components/ResultView';
import SystemDesign from './components/SystemDesign';
import BibleVerseWidget from './components/BibleVerseWidget';
import { BookOpen, ShieldCheck, Database, LayoutDashboard, Code, LogOut, AlertTriangle } from 'lucide-react';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.LOGIN);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<StudyMaterial | null>(null);
  const [history, setHistory] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('notegenie_user_email');
    if (savedEmail) {
      setUserEmail(savedEmail);
      setCurrentStep(AppStep.DASHBOARD);
      fetchHistory(savedEmail);
    }
    setLoading(false);
  }, []);

  const fetchHistory = async (email: string) => {
    try {
      setDbError(null);
      const { data, error } = await supabase
        .from('summaries')
        .select(`
          id,
          title,
          content,
          summary_style,
          created_at,
          flashcards (front, back),
          quizzes (questions)
        `)
        .eq('user_email', email)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        
        if (error.code === '42703') {
          setDbError("Database Schema Mismatch: The 'user_email' column is missing in your Supabase tables. Go to the 'Arch' page and run the Repair Script.");
        } else {
          setDbError(`Supabase Error (${error.code}): ${error.message || JSON.stringify(error)}`);
        }
        return;
      }

      if (!data) return;

      const mappedHistory: StudyMaterial[] = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        summary: item.content,
        mode: item.summary_style as SummaryMode,
        createdAt: item.created_at,
        flashcards: (item.flashcards || []).map((f: any) => ({ question: f.front, answer: f.back })),
        quiz: item.quizzes?.[0]?.questions || []
      }));

      setHistory(mappedHistory);
    } catch (err: any) {
      console.error('Fetch history logic error:', err);
      setDbError(`Application Error: ${err.message || JSON.stringify(err)}`);
    }
  };

  const handleLogin = (email: string) => {
    setUserEmail(email);
    setCurrentStep(AppStep.DASHBOARD);
    fetchHistory(email);
  };

  const handleLogout = () => {
    localStorage.removeItem('notegenie_user_email');
    setUserEmail(null);
    setHistory([]);
    setDbError(null);
    setCurrentStep(AppStep.LOGIN);
  };

  const handleProcessComplete = (data: StudyMaterial) => {
    setProcessedData(data);
    setHistory(prev => [data, ...prev]);
    setCurrentStep(AppStep.RESULT);
  };

  const handleMaterialUpdate = (patch: Partial<StudyMaterial>) => {
    setProcessedData(prev => prev ? { ...prev, ...patch } : null);
    // Optionally update history item too
    if (processedData) {
      setHistory(prev => prev.map(item => 
        item.id === processedData.id ? { ...item, ...patch } : item
      ));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30">
      {userEmail && (
        <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setCurrentStep(AppStep.DASHBOARD)}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-110 transition-transform">
                <BookOpen className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                NoteGenie
              </span>
            </div>
            
            <nav className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentStep(AppStep.DASHBOARD)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${currentStep === AppStep.DASHBOARD ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => setCurrentStep(AppStep.SYSTEM_DESIGN)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors ${currentStep === AppStep.SYSTEM_DESIGN ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:text-slate-100'}`}
              >
                <Code size={18} />
                <span className="hidden sm:inline text-xs font-bold tracking-widest uppercase">Arch</span>
              </button>
              <div className="h-6 w-[1px] bg-slate-800 mx-2" />
              <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 transition-colors p-2"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </nav>
          </div>
        </header>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 relative">
        {dbError && userEmail && (
          <div className="mb-8 p-6 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-start gap-4 text-red-400 animate-in fade-in slide-in-from-top-4 shadow-xl">
            <AlertTriangle size={24} className="shrink-0 mt-1" />
            <div className="space-y-1">
              <p className="font-bold uppercase tracking-widest text-[10px]">Critical Database Fault</p>
              <p className="text-sm font-medium leading-relaxed">{dbError}</p>
            </div>
          </div>
        )}

        {!userEmail && currentStep === AppStep.LOGIN && <Auth onLogin={handleLogin} />}
        
        {userEmail && currentStep === AppStep.DASHBOARD && (
          <Dashboard 
            history={history} 
            onUploadClick={() => setCurrentStep(AppStep.UPLOAD)}
            onViewMaterial={(m) => { setProcessedData(m); setCurrentStep(AppStep.RESULT); }}
          />
        )}
        {userEmail && currentStep === AppStep.UPLOAD && (
          <FileUpload 
            userEmail={userEmail}
            onProcessingStart={() => setCurrentStep(AppStep.PROCESSING)}
            onComplete={handleProcessComplete}
            onUpdate={handleMaterialUpdate}
            onCancel={() => setCurrentStep(AppStep.DASHBOARD)}
          />
        )}
        {userEmail && currentStep === AppStep.PROCESSING && <ProcessingAnimation />}
        {userEmail && currentStep === AppStep.RESULT && processedData && (
          <ResultView 
            material={processedData} 
            onBack={() => setCurrentStep(AppStep.DASHBOARD)} 
          />
        )}
        {userEmail && currentStep === AppStep.SYSTEM_DESIGN && <SystemDesign />}
      </main>

      <BibleVerseWidget />

      <footer className="py-6 border-t border-slate-900 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-slate-500 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 font-medium"><ShieldCheck size={14} className="text-cyan-500" /> Cloud Encrypted</span>
            <span className="flex items-center gap-1 font-medium"><Database size={14} className="text-emerald-500" /> Supabase Storage</span>
          </div>
          <p className="font-medium tracking-wide">© 2025 NoteGenie. Built for Academic Excellence.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;