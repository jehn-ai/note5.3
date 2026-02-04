
import React, { useState, useEffect } from 'react';
import { BIBLE_VERSES } from '../constants';
import { Quote } from 'lucide-react';
import { AppTheme } from '../types';

const BibleVerseWidget: React.FC<{ theme?: AppTheme }> = ({ theme }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BIBLE_VERSES.length);
    }, 15000); // Rotate every 15 seconds
    return () => clearInterval(timer);
  }, []);

  const verse = BIBLE_VERSES[index];
  const isGenie = theme === 'genie';

  return (
    <div className="fixed bottom-6 left-6 z-[60] max-w-[280px] group pointer-events-none sm:pointer-events-auto">
      <div className={`backdrop-blur-md border p-4 rounded-2xl shadow-2xl transition-all hover:scale-[1.02] ${isGenie ? 'bg-purple-900/80 border-purple-500/30 hover:border-pink-500/50' : 'bg-slate-900/90 border-slate-800 hover:border-cyan-500/30'}`}>
        <div className="flex items-start gap-3">
          <Quote className={`shrink-0 mt-1 ${isGenie ? 'text-pink-400/50' : 'text-cyan-500/50'}`} size={16} />
          <div className="space-y-2">
            <p className="text-xs text-slate-300 italic leading-relaxed font-medium">
              "{verse.text}"
            </p>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isGenie ? 'text-pink-400' : 'text-cyan-400'}`}>
              — {verse.reference}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleVerseWidget;
