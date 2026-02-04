import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, LogOut, Palette, CheckCircle2, Trash2, BookOpen, AlertCircle, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AppTheme, QuizStyle } from '../types';

interface SettingsProps {
  userEmail: string;
  theme: AppTheme;
  onThemeChange: (theme: AppTheme) => void;
}

const Settings: React.FC<SettingsProps> = ({ userEmail, theme, onThemeChange }) => {
  const [session, setSession] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [quizStyle, setQuizStyle] = useState<QuizStyle>(QuizStyle.STANDARD);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [summaryStats, setSummaryStats] = useState<{ total: number } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.user_metadata) {
        setDisplayName(session.user.user_metadata.full_name || '');
        setQuizStyle(session.user.user_metadata.quiz_style || QuizStyle.STANDARD);
      }
    });

    // Fetch stats
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count } = await supabase
      .from('summaries')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', userEmail);
    setSummaryStats({ total: count || 0 });
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      data: { 
        full_name: displayName,
        quiz_style: quizStyle
      }
    });

    setLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    }
  };

  const handleDeleteAllData = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('summaries')
      .delete()
      .eq('user_email', userEmail);
    
    setLoading(false);
    setDeleteConfirm(false);
    if (!error) {
       fetchStats();
       setMessage({ type: 'success', text: 'All data cleared successfully.' });
    } else {
       setMessage({ type: 'error', text: error.message });
    }
  };

  const isGuest = userEmail.startsWith('guest_');

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${theme === 'genie' ? 'bg-gradient-to-br from-purple-500 to-pink-500 shadow-purple-500/20' : 'bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-cyan-500/20'}`}>
          <User className="text-white w-8 h-8" />
        </div>
        <div>
          <h2 className={`text-2xl font-bold bg-clip-text text-transparent ${theme === 'genie' ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-cyan-400 to-emerald-400'}`}>
            Account Settings
          </h2>
          <p className="text-slate-400">Manage your profile and preferences</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* Profile Section */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 px-1">
          <Shield size={20} className={theme === 'genie' ? "text-purple-400" : "text-emerald-400"} />
          Profile Information
        </h3>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Display Name</label>
               <input 
                 type="text" 
                 value={displayName}
                 onChange={(e) => setDisplayName(e.target.value)}
                 className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all text-slate-200"
                 placeholder="Your Name"
               />
             </div>
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Email Address</label>
               <div className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm flex items-center gap-2 text-slate-400 cursor-not-allowed">
                 <Mail size={16} />
                 <span className="truncate">{userEmail}</span>
               </div>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Default Quiz Style</label>
             <div className="grid grid-cols-3 gap-3">
               {[QuizStyle.STANDARD, QuizStyle.SCENARIO, QuizStyle.BASIC].map((style) => (
                 <button
                   key={style}
                   onClick={() => setQuizStyle(style)}
                   className={`px-4 py-3 rounded-xl text-sm font-medium capitalize transition-all border ${
                     quizStyle === style 
                       ? (theme === 'genie' ? 'bg-purple-500/20 border-purple-500/50 text-purple-300' : 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300')
                       : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                   }`}
                 >
                   {style}
                 </button>
               ))}
             </div>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              onClick={handleUpdateProfile}
              disabled={loading || isGuest}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'genie' 
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-purple-900/20' 
                  : 'bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white shadow-cyan-900/20'
              }`}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 px-1">
          <Palette size={20} className={theme === 'genie' ? "text-pink-400" : "text-cyan-400"} />
          Appearance
        </h3>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <div>
               <h4 className="font-medium text-slate-200">Genie Theme</h4>
               <p className="text-sm text-slate-500">Enable the magical gradient interface</p>
            </div>
            <button 
              onClick={() => onThemeChange(theme === 'default' ? 'genie' : 'default')}
              className={`w-14 h-8 rounded-full transition-colors relative ${theme === 'genie' ? 'bg-purple-600' : 'bg-slate-700'}`}
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform shadow-md flex items-center justify-center ${theme === 'genie' ? 'left-7' : 'left-1'}`}>
                {theme === 'genie' && <Sparkles size={12} className="text-purple-600" />}
              </div>
            </button>
          </div>
        </div>
      </section>

      {/* Data Management Section */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2 px-1">
          <Trash2 size={20} className="text-red-400" />
          Data Zone
        </h3>
        <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 space-y-6">
           <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
             <div className="flex items-center gap-3 text-slate-400">
               <BookOpen size={20} />
               <span className="font-medium">Total Summaries</span>
             </div>
             <span className="text-xl font-bold text-white">{summaryStats?.total || 0}</span>
           </div>

           <div className="pt-2">
             {!deleteConfirm ? (
               <button 
                 onClick={() => setDeleteConfirm(true)}
                 className="w-full py-3 border border-red-500/20 text-red-400 rounded-xl hover:bg-red-500/10 transition-colors font-medium flex items-center justify-center gap-2"
               >
                 <Trash2 size={18} />
                 Clear All Data
               </button>
             ) : (
               <div className="space-y-3 animate-in fade-in zoom-in-95">
                 <p className="text-center text-red-300 text-sm font-bold">Are you sure? This cannot be undone.</p>
                 <div className="flex gap-3">
                   <button 
                     onClick={() => setDeleteConfirm(false)}
                     className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors font-medium"
                   >
                     Cancel
                   </button>
                   <button 
                     onClick={handleDeleteAllData}
                     className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors font-bold shadow-lg shadow-red-900/20"
                   >
                     Yes, Delete Everything
                   </button>
                 </div>
               </div>
             )}
           </div>
        </div>
      </section>

      <div className="flex justify-center pt-8 border-t border-slate-800/50">
         <button 
           onClick={() => supabase.auth.signOut()}
           className="flex items-center gap-2 px-6 py-3 text-slate-400 hover:text-red-400 hover:bg-red-500/5 rounded-full transition-all font-medium text-sm"
         >
           <LogOut size={16} />
           Sign Out of NoteGenie
         </button>
      </div>
    </div>
  );
};

export default Settings;
