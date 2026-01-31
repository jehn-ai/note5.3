
import React, { useState, useEffect } from 'react';
import { BIBLE_VERSES } from '../constants';
import { Quote } from 'lucide-react';

const BibleVerseWidget: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BIBLE_VERSES.length);
    }, 15000); // Rotate every 15 seconds
    return () => clearInterval(timer);
  }, []);

  const verse = BIBLE_VERSES[index];

  return (
    <div className="fixed bottom-6 left-6 z-[60] max-w-[280px] group pointer-events-none sm:pointer-events-auto">
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 p-4 rounded-2xl shadow-2xl transition-all hover:scale-[1.02] hover:border-cyan-500/30">
        <div className="flex items-start gap-3">
          <Quote className="text-cyan-500/50 shrink-0 mt-1" size={16} />
          <div className="space-y-2">
            <p className="text-xs text-slate-300 italic leading-relaxed font-medium">
              "{verse.text}"
            </p>
            <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">
              — {verse.reference}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BibleVerseWidget;
