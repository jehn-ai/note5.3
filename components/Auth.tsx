
import React, { useState } from 'react';
import { LogIn, Sparkles, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

interface AuthProps {
  onLogin: (email: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const handleAnonymousSignIn = () => {
    setLoading(true);
    const guestEmail = `guest_${Math.random().toString(36).substring(7)}@notegenie.internal`;
    localStorage.setItem('notegenie_user_email', guestEmail);
    
    // Simulate slight "magic" delay for UX
    setTimeout(() => {
      onLogin(guestEmail);
      setLoading(false);
    }, 800);
  };

  const handleEmailSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    // Immediate session generation
    localStorage.setItem('notegenie_user_email', email);

    // Simulate authentication processing
    setTimeout(() => {
      onLogin(email);
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Sparkles className="w-32 h-32 text-cyan-400" />
      </div>
      
      <div className="relative z-10 text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/20">
          <Sparkles className="text-white w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          Scholar Access
        </h1>
        <p className="text-slate-400">Unlock your Genie Study Buddy 😇</p>
      </div>

      <div className="space-y-4 relative z-10">
        <button 
          type="button"
          disabled={loading}
          className="w-full bg-white text-slate-900 font-bold py-3.5 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95 hover:bg-slate-100 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="relative flex items-center gap-4 py-2">
          <div className="flex-1 h-px bg-slate-800"></div>
          <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">or academic email</span>
          <div className="flex-1 h-px bg-slate-800"></div>
        </div>

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-slate-100 placeholder:text-slate-600"
              placeholder="user@university.edu"
            />
          </div>
          
          {message && (
            <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="shrink-0 mt-0.5" size={16} /> : <AlertCircle className="shrink-0 mt-0.5" size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="space-y-3">
            <button 
              type="submit"
              disabled={loading || !email}
              className="group w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold py-4 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <LogIn size={20} />
              )}
              {loading ? 'Entering...' : 'Enter NoteGenie'}
              {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
            </button>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleAnonymousSignIn}
                disabled={loading}
                className="w-full py-2.5 flex items-center justify-center gap-2 text-[10px] font-extrabold text-slate-500 hover:text-emerald-400 uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 disabled:opacity-30 group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-emerald-500 transition-colors" />
                Try as Guest
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-emerald-500 transition-colors" />
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="mt-8 pt-6 border-t border-slate-800 text-center">
        <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">
          Secure Academic Gateway
        </p>
      </div>
    </div>
  );
};

export default Auth;
