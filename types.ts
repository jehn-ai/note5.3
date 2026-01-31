
export enum SummaryMode {
  BULLET = 'bullet',
  DETAILED = 'detailed',
  TLDR = 'tldr'
}

export enum AppStep {
  LOGIN = 'login',
  AUTH_CALLBACK = 'auth-callback',
  DASHBOARD = 'dashboard',
  UPLOAD = 'upload',
  PROCESSING = 'processing',
  RESULT = 'result',
  SYSTEM_DESIGN = 'system-design'
}

export interface Flashcard {
  question: string;
  answer: string;
  source?: string; // e.g., "From Section 2" or "Slide Context"
  // Optional for future expansion of spaced repetition
  status?: 'new' | 'learning' | 'review' | 'mastered';
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface StudyMaterial {
  id: string;
  title: string;
  summary: string;
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  mode: SummaryMode;
  createdAt: string;
}

export interface BibleVerse {
  text: string;
  reference: string;
}
