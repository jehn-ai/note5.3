import React, { useState, useEffect } from 'react';
import { AppStep, StudyMaterial, SummaryMode } from './types';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import FileUpload from './components/FileUpload';
import ProcessingAnimation from './components/ProcessingAnimation';
import ResultView from './components/ResultView';
import SystemDesign from './components/SystemDesign';
import Settings from './components/Settings';
import BibleVerseWidget from './components/BibleVerseWidget';
import { BookOpen, ShieldCheck, Database, LayoutDashboard, Code, LogOut, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.LOGIN);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [processedData, setProcessedData] = useState<StudyMaterial | null>(null);
  const [history, setHistory] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        fetchHistory(session.user.email); 
        setCurrentStep((prev) => prev === AppStep.LOGIN ? AppStep.DASHBOARD : prev);
      } else {
        // If we have a left-over guest session in local storage, we can honor it
        const guest = localStorage.getItem('notegenie_user_email');
        if (guest && guest.startsWith('guest_')) {
          setUserEmail(guest);
          setCurrentStep(AppStep.DASHBOARD);
          fetchHistory(guest);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
        fetchHistory(session.user.email);
        setCurrentStep((prev) => prev === AppStep.LOGIN ? AppStep.DASHBOARD : prev);
      } else {
        // Handle logout or no session
        // Check if we are guest
        const guest = localStorage.getItem('notegenie_user_email');
        if (!guest || !guest.startsWith('guest_')) {
          setUserEmail(null);
          setHistory([]);
          setCurrentStep(AppStep.LOGIN);
        }
      }
    });

    return () => subscription.unsubscribe();
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

  const handleLogout = async () => {
    if (userEmail?.startsWith('guest_')) {
      localStorage.removeItem('notegenie_user_email');
      setUserEmail(null);
      setHistory([]);
      setCurrentStep(AppStep.LOGIN);
    } else {
      await supabase.auth.signOut();
      // Listener will handle state update
    }
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

  const [theme, setTheme] = useState<'default' | 'genie'>('default');

  useEffect(() => {
    // Load theme preference
    const savedTheme = localStorage.getItem('notegenie_theme') as 'default' | 'genie';
    if (savedTheme) setTheme(savedTheme);
  }, []);

  const handleThemeChange = (newTheme: 'default' | 'genie') => {
    setTheme(newTheme);
    localStorage.setItem('notegenie_theme', newTheme);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-cyan-500"></div>
      </div>
    );
  }

  const getBackgroundClass = () => {
    if (theme === 'genie') {
      return "min-h-screen flex flex-col bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-purple-900 to-slate-900 text-slate-100 selection:bg-purple-500/30";
    }
    return "min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500/30";
  };

  return (
    <div className={getBackgroundClass()}>
      {userEmail && (
        <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div 
              className="flex items-center gap-2 cursor-pointer group"
              onClick={() => setCurrentStep(AppStep.DASHBOARD)}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-smooth active-press group-hover:scale-110 ${theme === 'genie' ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20' : 'bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-cyan-500/20'}`}>
                <BookOpen className="text-white w-5 h-5" />
              </div>
              <span className={`font-bold text-xl tracking-tight bg-clip-text text-transparent ${theme === 'genie' ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}>
                NoteGenie
              </span>
            </div>
            
            <nav className="flex items-center gap-4">
              <button 
                onClick={() => setCurrentStep(AppStep.DASHBOARD)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-smooth active-press ${currentStep === AppStep.DASHBOARD ? (theme === 'genie' ? 'bg-purple-500/10 text-purple-400 hover-glow' : 'bg-cyan-500/10 text-cyan-400 hover-glow') : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'}`}
              >
                <LayoutDashboard size={18} />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
              <button 
                onClick={() => setCurrentStep(AppStep.SYSTEM_DESIGN)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-smooth active-press ${currentStep === AppStep.SYSTEM_DESIGN ? (theme === 'genie' ? 'bg-pink-500/10 text-pink-400 hover-glow' : 'bg-emerald-500/10 text-emerald-400 hover-glow') : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'}`}
              >
                <Code size={18} />
                <span className="hidden sm:inline text-xs font-bold tracking-widest uppercase">Arch</span>
              </button>
              <button 
                onClick={() => setCurrentStep(AppStep.SETTINGS)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-smooth active-press ${currentStep === AppStep.SETTINGS ? 'bg-slate-700 text-slate-200 hover-glow' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'}`}
                title="Settings"
              >
                <SettingsIcon size={18} />
              </button>
              <div className="h-6 w-[1px] bg-slate-800 mx-2" />
              <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-red-400 transition-smooth active-press p-2 rounded-lg hover:bg-red-500/10"
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
            theme={theme}
            onUploadClick={() => setCurrentStep(AppStep.UPLOAD)}
            onViewMaterial={(m) => { setProcessedData(m); setCurrentStep(AppStep.RESULT); }}
          />
        )}
        {userEmail && currentStep === AppStep.UPLOAD && (
          <FileUpload 
            userEmail={userEmail}
            theme={theme}
            onProcessingStart={() => setCurrentStep(AppStep.PROCESSING)}
            onComplete={handleProcessComplete}
            onUpdate={handleMaterialUpdate}
            onCancel={() => setCurrentStep(AppStep.DASHBOARD)}
          />
        )}
        {userEmail && currentStep === AppStep.PROCESSING && <ProcessingAnimation theme={theme} />}
        {userEmail && currentStep === AppStep.RESULT && processedData && (
          <ResultView 
            material={processedData} 
            theme={theme}
            onBack={() => setCurrentStep(AppStep.DASHBOARD)} 
          />
        )}
        {userEmail && currentStep === AppStep.SYSTEM_DESIGN && <SystemDesign theme={theme} />}
        {userEmail && currentStep === AppStep.SETTINGS && (
          <Settings 
            userEmail={userEmail} 
            theme={theme}
            onThemeChange={handleThemeChange}
          />
        )}
      </main>

      <BibleVerseWidget theme={theme} />

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