export type QuestionType = 'multiple-choice' | 'fill-in-the-blank' | 'essay';

export interface Question {
  type: QuestionType;
  question_text: string;
  options?: string[]; // Only for multiple-choice
  correct_answer: string; // For essay, this can be a model answer/rubric
  explanation: string;
  image_description?: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: Question[];
  passage?: string;
  user_id?: string; // Foreign key to the user who created it
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