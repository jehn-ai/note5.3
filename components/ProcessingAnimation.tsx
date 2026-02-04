import React, { useState, useEffect } from 'react';
import { Book, Cpu, Layers, Zap } from 'lucide-react';
import { AppTheme } from '../types';

interface ProcessingAnimationProps {
  theme?: AppTheme;
}

const ProcessingAnimation: React.FC<ProcessingAnimationProps> = ({ theme }) => {
  const [stage, setStage] = useState(0);
  const stages = [
    "The Genie Is Reading Your Note 😇...",
    "Magical Cutter are Applied to the Note 💈 ...",
    "Note Chopped Magically 😊...",
    "Finalizing Summary Layers 😉..."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStage((s) => (s + 1) % stages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const isGenie = theme === 'genie';

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-12 animate-in fade-in duration-1000">
      <div className="relative">
        {/* Outer Glow */}
        <div className={`absolute inset-0 blur-[80px] rounded-full animate-pulse ${isGenie ? 'bg-purple-500/20' : 'bg-cyan-500/20'}`} />
        
        {/* Core Animation Container */}
        <div className={`relative w-48 h-48 bg-slate-900 border rounded-[3rem] flex items-center justify-center shadow-2xl overflow-hidden ${isGenie ? 'border-purple-500/30' : 'border-cyan-500/30'}`}>
          
          {/* Scanning Line */}
          <div className={`absolute inset-x-0 h-1 shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-[scan_2s_ease-in-out_infinite] ${isGenie ? 'bg-purple-400/50 shadow-[0_0_15px_rgba(192,132,252,0.8)]' : 'bg-cyan-400/50 shadow-[0_0_15px_rgba(34,211,238,0.8)]'}`} />
          
          <div className="grid grid-cols-2 gap-4 animate-[spin_10s_linear_infinite]">
            <Book className={`${isGenie ? 'text-purple-400' : 'text-cyan-400'} opacity-80`} size={32} />
            <Cpu className={`${isGenie ? 'text-pink-400' : 'text-emerald-400'} opacity-80`} size={32} />
            <Layers className={`${isGenie ? 'text-indigo-400' : 'text-blue-400'} opacity-80`} size={32} />
            <Zap className={`${isGenie ? 'text-yellow-400' : 'text-yellow-400'} opacity-80`} size={32} />
          </div>
        </div>
      </div>

      <div className="space-y-4 max-w-sm">
        <h3 className="text-2xl font-bold text-white tracking-tight">{stages[stage]}</h3>
        <p className="text-slate-500 text-sm leading-relaxed px-4">
          Distilling insight from File...
        </p>
        
        <div className="flex gap-1 justify-center">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 rounded-full transition-all duration-1000 ${
                i === stage 
                  ? (isGenie ? 'w-8 bg-purple-500' : 'w-8 bg-cyan-500')
                  : 'w-2 bg-slate-800'
              }`} 
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
};

export default ProcessingAnimation;
