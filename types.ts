export type QuestionType = 'multiple-choice' | 'fill-in-the-blank' | 'essay';

export interface Question {
  type: QuestionType;
  question_text: string;
  image_description?: string;
  passage_index?: number; // NEW: Link to specific passage (0-based index)
  options?: string[]; // For multiple-choice
  correct_answer: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  title: string;
  passage?: string; // Legacy: single passage (backward compatible)
  passages?: string[]; // NEW: Support multiple passages
  questions: Question[];
}

export interface StudentAnswer {
  [questionIndex: number]: string;
}

export interface QuizResult {
  score: number;
  total: number;
  answers: StudentAnswer;
  gradableQuestions: number;
}

// Helper function to get passage for a question
export function getPassageForQuestion(quiz: Quiz, questionIndex: number): string | null {
  const question = quiz.questions[questionIndex];
  
  // If question has passage_index and quiz has multiple passages
  if (question.passage_index !== undefined && quiz.passages && quiz.passages.length > 0) {
    return quiz.passages[question.passage_index] || null;
  }
  
  // Fallback to single passage
  return quiz.passage || null;
}

// Helper to check if quiz has multiple passages
export function hasMultiplePassages(quiz: Quiz): boolean {
  return !!(quiz.passages && quiz.passages.length > 1);
}