import React, { useState, useEffect } from 'react';
import { StudyMaterial, Flashcard, QuizQuestion } from '../types';
import { ArrowLeft, Download, Copy, Check, Info, HelpCircle, GraduationCap, ChevronRight, ChevronLeft, Zap, Loader2, Sparkles, FileText, XCircle, CheckCircle2, Link } from 'lucide-react';
import { GeminiService } from '../services/gemini';
import { supabase } from '../lib/supabase';
import { jsPDF } from "jspdf";

interface ResultViewProps {
  material: StudyMaterial;
  onBack: () => void;
}

const ResultView: React.FC<ResultViewProps> = ({ material, onBack }) => {
  // Flashcards are now the default view
  const [activeTab, setActiveTab] = useState<'summary' | 'flashcards' | 'quiz'>('flashcards');
  const [copied, setCopied] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  
  // Generation states
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [localMaterial, setLocalMaterial] = useState<StudyMaterial>(material);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setLocalMaterial(material);
  }, [material]);

  const handleCopy = () => {
    navigator.clipboard.writeText(localMaterial.summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFlashcardConfidence = (type: 'got-it' | 'review') => {
    // Visual feedback logic could go here
    // Move to next card
    if (flashcardIndex < localMaterial.flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setFlashcardIndex(i => i + 1), 150);
    }
  };

  const generateFlashcardsOnDemand = async () => {
    setIsGeneratingFlashcards(true);
    try {
      const cards = await GeminiService.generateFlashcards(localMaterial.summary);
      
      const userEmail = localStorage.getItem('notegenie_user_email') || 'unknown';
      const flashcardsToInsert = cards.map(f => ({
        summary_id: localMaterial.id,
        user_email: userEmail,
        front: f.question,
        back: f.answer
      }));
      await supabase.from('flashcards').insert(flashcardsToInsert);

      setLocalMaterial(prev => ({ ...prev, flashcards: cards }));
    } catch (err) {
      console.error("Flashcard generation failed:", err);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const generateQuizOnDemand = async () => {
    setIsGeneratingQuiz(true);
    try {
      const questions = await GeminiService.generateQuiz(localMaterial.summary);
      
      const userEmail = localStorage.getItem('notegenie_user_email') || 'unknown';
      await supabase.from('quizzes').insert({
        summary_id: localMaterial.id,
        user_email: userEmail,
        title: `Quiz: ${localMaterial.title}`,
        question_count: questions.length,
        questions: questions
      });

      setLocalMaterial(prev => ({ ...prev, quiz: questions }));
    } catch (err) {
      console.error("Quiz generation failed:", err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const downloadAsPDF = () => {
    setIsDownloading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxLineWidth = pageWidth - margin * 2;
      let yPos = 20;

      // Helper for page breaks
      const checkPageBreak = (height: number) => {
        if (yPos + height >= doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          yPos = 20;
          return true;
        }
        return false;
      };

      // --- HEADER ---
      doc.setFontSize(22);
      doc.setTextColor(6, 182, 212); // Cyan-500
      doc.text("NoteGenie Report", margin, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Mode: ${localMaterial.mode.toUpperCase()}`, margin, yPos);
      yPos += 15;

      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text(localMaterial.title, margin, yPos);
      yPos += 5;
      
      doc.setDrawColor(200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 15;

      // --- FLASHCARDS (PRIORITY) ---
      if (localMaterial.flashcards.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(6, 182, 212);
        doc.text("FLASHCARDS", margin, yPos);
        yPos += 10;

        localMaterial.flashcards.forEach((card, i) => {
          doc.setFontSize(10);
          doc.setTextColor(50);
          
          // Question
          const qLines = doc.splitTextToSize(`Q${i+1}: ${card.question}`, maxLineWidth);
          if (checkPageBreak(qLines.length * 5 + 10)) {
             doc.setFontSize(14); doc.setTextColor(6, 182, 212); doc.text("FLASHCARDS (cont.)", margin, yPos); yPos+=10; doc.setFontSize(10); doc.setTextColor(50);
          }
          doc.setFont("helvetica", "bold");
          doc.text(qLines, margin, yPos);
          yPos += (qLines.length * 5);

          // Answer
          doc.setFont("helvetica", "normal");
          const aLines = doc.splitTextToSize(`A: ${card.answer}`, maxLineWidth);
          checkPageBreak(aLines.length * 5 + 5);
          doc.text(aLines, margin, yPos);
          yPos += (aLines.length * 5) + 5; // Spacing
        });
        yPos += 15;
      }

      // --- QUIZ ---
      if (localMaterial.quiz.length > 0) {
        checkPageBreak(30);
        doc.setFontSize(14);
        doc.setTextColor(6, 182, 212);
        doc.text("KNOWLEDGE AUDIT", margin, yPos);
        yPos += 10;

        localMaterial.quiz.forEach((q, i) => {
          doc.setFontSize(10);
          doc.setTextColor(0);
          
          const qText = doc.splitTextToSize(`${i+1}. ${q.question}`, maxLineWidth);
          if (checkPageBreak(qText.length * 5 + 25)) {
             doc.setFontSize(14); doc.setTextColor(6, 182, 212); doc.text("KNOWLEDGE AUDIT (cont.)", margin, yPos); yPos+=10; doc.setFontSize(10); doc.setTextColor(0);
          }
          
          doc.setFont("helvetica", "bold");
          doc.text(qText, margin, yPos);
          yPos += (qText.length * 5) + 2;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(80);
          q.options.forEach((opt, optIdx) => {
             const isCorrect = opt === q.correctAnswer;
             const prefix = String.fromCharCode(65 + optIdx) + ")";
             const optText = `${prefix} ${opt} ${isCorrect ? '(Correct)' : ''}`;
             doc.text(optText, margin + 5, yPos);
             yPos += 5;
          });
          
          yPos += 2;
          const expText = doc.splitTextToSize(`Explanation: ${q.explanation}`, maxLineWidth);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100);
          doc.text(expText, margin, yPos);
          yPos += (expText.length * 5) + 8;
        });
        yPos += 15;
      }

      // --- SUMMARY ---
      checkPageBreak(30);
      doc.setFontSize(14);
      doc.setTextColor(6, 182, 212);
      doc.text("SOURCE SUMMARY", margin, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(0);
      const splitSummary = doc.splitTextToSize(localMaterial.summary || "Summary generation pending...", maxLineWidth);
      
      splitSummary.forEach((line: string) => {
        checkPageBreak(7);
        doc.text(line, margin, yPos);
        yPos += 5;
      });

      // Footer
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${pageCount} - NoteGenie AI Study Assistant`, margin, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`${localMaterial.title.replace(/[^a-z0-9]/gi, '_').substring(0, 30)}_NoteGenie.pdf`);
    } catch (err) {
      console.error("PDF Generation Error", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded-lg hover:bg-slate-900"
        >
          <ArrowLeft size={20} /> Decks
        </button>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={handleCopy}
            disabled={!localMaterial.summary}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 px-4 py-2.5 rounded-xl transition-all disabled:opacity-50"
          >
            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button 
            onClick={downloadAsPDF}
            disabled={isDownloading}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-xl transition-all font-bold shadow-lg shadow-cyan-900/20 disabled:opacity-70 disabled:cursor-wait"
          >
            {isDownloading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
            {isDownloading ? 'Export Pack' : 'Download Pack'}
          </button>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-1.5 flex shadow-inner">
        {[
          { id: 'flashcards', label: 'Flashcards', icon: <Sparkles size={14} /> },
          { id: 'quiz', label: 'Quiz', icon: <GraduationCap size={14} /> },
          { id: 'summary', label: 'Summary', icon: <Zap size={14} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
              activeTab === tab.id 
              ? 'bg-slate-800 text-cyan-400 shadow-md ring-1 ring-slate-700' 
              : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.icon}
            <span className="text-sm">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'flashcards' && (
          <div className="animate-in zoom-in-95 duration-300">
            {localMaterial.flashcards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6">
                <div className="w-24 h-24 bg-cyan-500/10 rounded-[2.5rem] flex items-center justify-center text-cyan-400">
                  <Sparkles size={48} />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h4 className="text-2xl font-bold text-white">Synthesize Mastery</h4>
                  <p className="text-slate-400 text-sm">Use active recall to embed this knowledge. Genie will create high-impact cards in seconds.</p>
                </div>
                <button 
                  onClick={generateFlashcardsOnDemand}
                  disabled={isGeneratingFlashcards}
                  className="bg-white text-slate-950 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isGeneratingFlashcards ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                  {isGeneratingFlashcards ? 'Synthesizing...' : 'Generate Flashcards'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-8">
                <div className="w-full max-w-xl perspective-1000 group">
                  <div 
                    className={`relative w-full aspect-[4/3] transition-transform duration-700 transform-style-3d cursor-pointer ${isFlipped ? 'rotate-y-180' : ''}`}
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    {/* Front */}
                    <div className="absolute inset-0 bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center backface-hidden shadow-2xl relative overflow-hidden">
                      {/* Source Link */}
                      <div className="absolute top-6 right-6">
                        <div className="flex items-center gap-1.5 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 px-3 py-1.5 rounded-full transition-all text-[10px] font-bold uppercase tracking-widest border border-slate-700/50">
                           <Link size={12} />
                           {localMaterial.flashcards[flashcardIndex].source || 'Context: Summary'}
                        </div>
                      </div>

                      <div className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.3em] mb-6">Card {flashcardIndex + 1}</div>
                      <p className="text-2xl md:text-3xl font-bold text-white leading-tight">{localMaterial.flashcards[flashcardIndex].question}</p>
                      <div className="absolute bottom-8 text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                        Tap to reveal <ChevronRight size={14} />
                      </div>
                    </div>
                    {/* Back */}
                    <div className="absolute inset-0 bg-emerald-950 border-2 border-emerald-500/30 rounded-[2.5rem] p-12 flex flex-col items-center justify-center text-center backface-hidden rotate-y-180 shadow-2xl shadow-emerald-900/20">
                      <div className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6">Answer</div>
                      <p className="text-xl md:text-2xl font-medium text-slate-100 leading-relaxed">{localMaterial.flashcards[flashcardIndex].answer}</p>
                      
                      <div className="absolute bottom-8 flex gap-4 w-full justify-center px-8" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleFlashcardConfidence('review')}
                          className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle size={14} /> Review
                        </button>
                        <button 
                          onClick={() => handleFlashcardConfidence('got-it')}
                          className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle2 size={14} /> I Know It
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <button 
                    disabled={flashcardIndex === 0}
                    onClick={() => { setFlashcardIndex(i => i - 1); setIsFlipped(false); }}
                    className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-20 shadow-lg"
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-white font-black text-xl">{flashcardIndex + 1}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">of {localMaterial.flashcards.length}</span>
                  </div>
                  <button 
                    disabled={flashcardIndex === localMaterial.flashcards.length - 1}
                    onClick={() => { setFlashcardIndex(i => i + 1); setIsFlipped(false); }}
                    className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-all disabled:opacity-20 shadow-lg"
                  >
                    <ChevronRight size={28} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 space-y-6 animate-in zoom-in-95 duration-300 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-cyan-400">
                <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center">
                  <Info size={20} />
                </div>
                <h3 className="font-bold uppercase tracking-widest text-xs">Source Material</h3>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                Extracted Context
              </span>
            </div>
            
            {localMaterial.summary ? (
              <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap selection:bg-cyan-500/30 text-lg">
                {localMaterial.summary}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
                <Loader2 className="w-16 h-16 text-cyan-500 animate-spin" />
                <div className="space-y-2">
                  <h4 className="text-xl font-bold text-white">Generating Summary...</h4>
                  <p className="text-slate-400 text-sm">Your summary is being crafted in the background. It will appear here shortly.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="animate-in zoom-in-95 duration-300">
             {localMaterial.quiz.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-[2.5rem] flex items-center justify-center text-emerald-400">
                  <GraduationCap size={48} />
                </div>
                <div className="space-y-2 max-w-sm">
                  <h4 className="text-2xl font-bold text-white">Knowledge Audit</h4>
                  <p className="text-slate-400 text-sm">Genie will construct a custom assessment to test your comprehension boundaries.</p>
                </div>
                <button 
                  onClick={generateQuizOnDemand}
                  disabled={isGeneratingQuiz}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                  {isGeneratingQuiz ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                  {isGeneratingQuiz ? 'Building Quiz...' : 'Generate Quiz'}
                </button>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {localMaterial.quiz.map((q, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 space-y-6 shadow-xl">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 font-black text-sm">
                        {idx + 1}
                      </div>
                      <p className="text-xl font-bold text-white leading-tight pt-1">{q.question}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-14">
                      {q.options.map((option, oIdx) => {
                        const isSelected = quizAnswers[idx] === option;
                        const isCorrect = option === q.correctAnswer;
                        const showResult = !!quizAnswers[idx];

                        let variant = 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300';
                        if (showResult) {
                          if (isCorrect) variant = 'border-emerald-500 bg-emerald-500/10 text-emerald-400';
                          else if (isSelected) variant = 'border-red-500 bg-red-500/10 text-red-400';
                        } else if (isSelected) {
                          variant = 'border-cyan-500 bg-cyan-500/10 text-cyan-400';
                        }

                        return (
                          <button
                            key={oIdx}
                            disabled={!!quizAnswers[idx]}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [idx]: option }))}
                            className={`text-left p-5 rounded-2xl border-2 font-medium transition-all ${variant}`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    {quizAnswers[idx] && (
                      <div className="pl-14 pt-2">
                        <button 
                          onClick={() => setShowExplanation(prev => ({ ...prev, [idx]: !prev[idx] }))}
                          className="text-cyan-400 hover:text-cyan-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mb-3"
                        >
                          {showExplanation[idx] ? 'Hide Insight' : 'Reveal Reasoning'} <HelpCircle size={14} />
                        </button>
                        {showExplanation[idx] && (
                          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-400 text-sm italic leading-relaxed animate-in fade-in slide-in-from-top-2">
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="bg-gradient-to-br from-cyan-900/10 to-emerald-900/10 border border-slate-800 p-10 rounded-[2.5rem] text-center space-y-4">
                  <GraduationCap className="mx-auto text-emerald-400" size={56} />
                  <h4 className="text-2xl font-bold text-white tracking-tight">Focus Mastery Achieved</h4>
                  <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
                    Consistent assessment sessions are proven to increase exam performance by 40%. Keep grinding!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
};

export default ResultView;