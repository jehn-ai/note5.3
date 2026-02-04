import React, { useState } from 'react';
import { LogIn, Sparkles, Mail, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppTheme } from '../types';

interface AuthProps {
  onLogin: (email: string) => void;
  theme?: AppTheme;
}

const Auth: React.FC<AuthProps> = ({ onLogin, theme = 'default' }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  const isGenie = theme === 'genie';

  const handleGoogleSignIn = async () => {
    setLoading(true);
    
    // Set our custom persistence flag
    if (rememberMe) {
      localStorage.setItem('notegenie_remember_me', 'true');
    } else {
      localStorage.removeItem('notegenie_remember_me');
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      setLoading(false);
    }
  };

  const handleAnonymousSignIn = () => {
    // For now, we'll keep the guest simulation for instant "Try it out" access without polluting the Supabase user base
    // In a real SaaS, you might use supabase.auth.signInAnonymously()
    setLoading(true);
    const guestEmail = `guest_${Math.random().toString(36).substring(7)}@notegenie.internal`;
    localStorage.setItem('notegenie_user_email', guestEmail);
    
    // Simulate slight "magic" delay for UX
    setTimeout(() => {
      onLogin(guestEmail);
      setLoading(false);
    }, 800);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage(null);

    // Set our custom persistence flag
    if (rememberMe) {
      localStorage.setItem('notegenie_remember_me', 'true');
    } else {
      localStorage.removeItem('notegenie_remember_me');
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ 
        type: 'success', 
        text: 'Check your email for the magic link!' 
      });
    }
  };

  return (
    <div className={`max-w-md mx-auto mt-0 p-8 border rounded-3xl shadow-2xl relative overflow-hidden transition-all duration-500 ${
      isGenie 
        ? 'bg-[#1e1035]/80 border-purple-500/30 shadow-purple-900/40' 
        : 'bg-slate-900/90 border-slate-800 shadow-cyan-900/20'
    }`}>
      <div className="absolute top-0 right-0 p-4 opacity-5">
        <Sparkles className={`w-32 h-32 ${isGenie ? 'text-purple-400' : 'text-cyan-400'}`} />
      </div>
      
      <div className="relative z-10 text-center mb-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg transition-colors ${
          isGenie 
            ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20' 
            : 'bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-cyan-500/20'
        }`}>
          <Sparkles className="text-white w-8 h-8" />
        </div>
        <h1 className={`text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r ${
          isGenie ? 'from-purple-400 to-pink-400' : 'from-cyan-400 to-emerald-400'
        }`}>
          Scholar Access
        </h1>
        <p className="text-slate-400">Unlock your Genie Study Buddy 😇</p>
      </div>

      <div className="space-y-4 relative z-10">
        <button 
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
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
              className={`w-full bg-slate-950 border rounded-2xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 transition-all text-slate-100 placeholder:text-slate-600 ${
                isGenie 
                  ? 'border-purple-500/20 focus:ring-purple-500/50' 
                  : 'border-slate-800 focus:ring-cyan-500/50'
              }`}
              placeholder="user@university.edu"
            />
          </div>
          
          {message && (
            <div className={`p-4 rounded-xl text-xs flex items-start gap-3 border animate-in fade-in slide-in-from-top-2 ${
              message.type === 'success' 
                ? (isGenie ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')
                : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="shrink-0 mt-0.5" size={16} /> : <AlertCircle className="shrink-0 mt-0.5" size={16} />}
              <span>{message.text}</span>
            </div>
          )}

          <div className="space-y-3">
            <label className="flex items-center gap-3 px-1 cursor-pointer group">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={`peer h-4 w-4 appearance-none rounded border border-slate-600 bg-slate-800 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    isGenie 
                      ? 'checked:bg-purple-500 checked:border-purple-500 focus:ring-purple-500/50' 
                      : 'checked:bg-cyan-500 checked:border-cyan-500 focus:ring-cyan-500/50'
                  }`} 
                />
                <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" viewBox="0 0 17 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                   <path d="M1 5.917L5.724 10.5L16 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Remember my session
              </span>
            </label>

            <button 
              type="submit"
              disabled={loading || !email}
              className={`group w-full text-white font-bold py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 ${
                isGenie 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-900/20' 
                  : 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 shadow-cyan-900/20'
              }`}
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
                className={`w-full py-2.5 flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.2em] transition-all hover:scale-105 active:scale-95 disabled:opacity-30 group ${
                  isGenie ? 'text-slate-500 hover:text-pink-400' : 'text-slate-500 hover:text-emerald-400'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isGenie ? 'bg-slate-700 group-hover:bg-pink-500' : 'bg-slate-700 group-hover:bg-emerald-500'}`} />
                Try as Guest
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isGenie ? 'bg-slate-700 group-hover:bg-pink-500' : 'bg-slate-700 group-hover:bg-emerald-500'}`} />
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
