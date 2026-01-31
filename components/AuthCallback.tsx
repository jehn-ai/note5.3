
import React, { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, ShieldCheck } from 'lucide-react';

interface AuthCallbackProps {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onSuccess, onError }) => {
  useEffect(() => {
    const verifySession = async () => {
      try {
        // Supabase auto-handles hash fragments for implicit flow, 
        // but for PKCE/explicit callback routes we ensure the session is settled.
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (data.session) {
          // Success! Slight delay for UX smoothness
          setTimeout(onSuccess, 1500);
        } else {
          // Check if it's a code-based flow
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          onSuccess();
        }
      } catch (err: any) {
        console.error('Auth Verification Error:', err);
        onError(err.message || 'Failed to verify your session.');
      }
    };

    verifySession();
  }, [onSuccess, onError]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-in fade-in duration-700">
      <div className="relative">
        <div className="absolute inset-0 bg-cyan-500/20 blur-[60px] rounded-full animate-pulse" />
        <div className="relative w-24 h-24 bg-slate-900 border border-cyan-500/30 rounded-3xl flex items-center justify-center shadow-2xl">
          <ShieldCheck className="text-cyan-400 w-12 h-12 animate-bounce" />
        </div>
      </div>
      
      <div className="space-y-3">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          Verifying Credentials <Sparkles className="text-yellow-400 w-5 h-5" />
        </h2>
        <p className="text-slate-400 max-w-xs mx-auto">
          Securing your academic session. One moment while NoteGenie prepares your sanctuary...
        </p>
      </div>

      <div className="flex gap-2 justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-bounce" />
      </div>
    </div>
  );
};

export default AuthCallback;
