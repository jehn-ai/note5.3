import React, { useMemo, useState } from "react";
import { X, Loader2, CheckCircle2, XCircle, Mic } from "lucide-react";
import type { ProveItQuestion, ProveItGrade } from "../types";
import { GeminiService } from "../services/gemini";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  reviewedCards: { id: string; front: string; back: string }[]; // last N reviewed
  onStartQuiz: () => void;
};

export default function ProveItModal({ isOpen, onClose, reviewedCards, onStartQuiz }: Props) {
  const [step, setStep] = useState<"question" | "results">("question");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<ProveItQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<ProveItGrade | null>(null);
  const [followUps, setFollowUps] = useState<Record<string, string>>({});
  const [gradingError, setGradingError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!questions.length) return false;
    return questions.every(q => (answers[q.id] || "").trim().length > 0);
  }, [questions, answers]);

  React.useEffect(() => {
    if (!isOpen) return;

    // Reset each open
    setStep("question");
    setAnswers({});
    setGrade(null);
    setFollowUps({});
    setGradingError(null);

    (async () => {
      setLoading(true);
      try {
        // Ensure minimum 10 cards for quality question generation
        let cardsToUse = reviewedCards.slice(-20);
        if (cardsToUse.length < 10) {
          console.log(`[ProveIt] Only ${cardsToUse.length} cards available, need at least 10 for quality questions`);
          // This fallback should already be handled in ResultView, but just in case
          if (cardsToUse.length === 0) {
            setQuestions([]);
            setLoading(false);
            return;
          }
        }
        
        console.log('[ProveIt] Generating questions from', cardsToUse.length, 'reviewed cards');
        const qs = await GeminiService.generateProveItQuestions(cardsToUse);
        setQuestions(qs);
      } catch (error) {
        console.error('[ProveIt] Question generation failed:', error);
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, reviewedCards]);

  if (!isOpen) return null;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setGradingError(null);
    try {
      const g = await GeminiService.gradeProveIt(questions, answers);
      setGrade(g);
      setStep("results");
    } catch (error: any) {
      console.error('[ProveIt] Grading failed:', error);
      const errorMsg = error?.message?.includes('overloaded') 
        ? 'Model is overloaded. Please try again.'
        : error?.message?.includes('503')
        ? 'Service temporarily unavailable. Please retry.'
        : 'Grading failed. Please try again.';
      setGradingError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <div className="text-white font-bold text-xl">Prove It</div>
            <div className="text-slate-400 text-sm">3 questions to lock it in.</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Loader2 className="animate-spin" size={18} />
              {step === "question" ? "Generating your review..." : "Grading..."}
            </div>
          )}

          {/* Voice-ready UI (disabled for now, but designed in) */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="px-3 py-1 rounded-full border border-slate-800 bg-slate-900/50">
              Input: Typed
            </div>
            <div className="px-3 py-1 rounded-full border border-slate-800 bg-slate-900/50 flex items-center gap-1 opacity-60">
              <Mic size={14} /> Voice (coming soon)
            </div>
          </div>

          {/* Error Banner */}
          {gradingError && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-start gap-3">
              <XCircle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <div className="text-red-400 font-bold text-sm">Grading Failed</div>
                <div className="text-slate-300 text-sm mt-1">{gradingError}</div>
                <div className="text-slate-400 text-xs mt-2">Your answers are saved. Click "Submit" to retry.</div>
              </div>
            </div>
          )}

          {step === "question" && !loading && (
            <div className="space-y-5">
              {questions.length === 0 ? (
                <div className="text-slate-400">
                  Couldn't generate review questions. Try again or regenerate the deck.
                </div>
              ) : (
                questions.map((q, idx) => (
                  <div key={q.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-200 font-bold">
                        Q{idx + 1} {q.type === "scenario" ? "Scenario" : "Short Answer"}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">
                        1–2 sentences
                      </div>
                    </div>

                    <div className="mt-3 text-white leading-relaxed">{q.question}</div>

                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="Type your answer..."
                      className="mt-4 w-full min-h-[90px] rounded-2xl border border-slate-800 bg-slate-950 p-4 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                    />
                  </div>
                ))
              )}
            </div>
          )}

          {step === "results" && grade && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 flex items-center justify-between">
                <div>
                  <div className="text-white font-bold text-lg">Score</div>
                  <div className="text-slate-400 text-sm">Quick checkpoint before the quiz.</div>
                </div>
                <div className="text-2xl font-black text-cyan-300">
                  {grade.totalScore}/{grade.maxScore}
                </div>
              </div>

              {grade.results.map((r) => (
                <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
                  <div className="flex items-center gap-2">
                    {r.correct ? (
                      <CheckCircle2 className="text-emerald-400" size={20} />
                    ) : (
                      <XCircle className="text-red-400" size={20} />
                    )}
                    <div className="text-white font-bold">{r.id.toUpperCase()}</div>
                    <div className="ml-auto text-xs text-slate-500 font-bold uppercase tracking-widest">
                      {r.correct ? "Correct" : "Needs work"}
                    </div>
                  </div>

                  <div className="mt-2 text-slate-200">{r.feedback}</div>

                  {!r.correct && r.followUpQuestion && (
                    <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-slate-300 font-bold text-sm">Fix it (1 follow-up)</div>
                      <div className="mt-2 text-white">{r.followUpQuestion}</div>
                      <textarea
                        value={followUps[r.id] || ""}
                        onChange={(e) => setFollowUps(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="Type your follow-up answer..."
                        className="mt-3 w-full min-h-[70px] rounded-2xl border border-slate-800 bg-black/30 p-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-600"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-slate-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-800 text-slate-300 font-bold hover:bg-slate-900"
          >
            Close
          </button>

          {step === "question" ? (
            <button
              onClick={submit}
              disabled={!canSubmit || loading}
              className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 ${
                !canSubmit || loading
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white active:scale-95"
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              Submit
            </button>
          ) : (
            <button
              onClick={onStartQuiz}
              className="flex-1 py-3 rounded-2xl font-bold bg-gradient-to-r from-cyan-600 to-emerald-600 text-white active:scale-95"
            >
              Take 5-question quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
