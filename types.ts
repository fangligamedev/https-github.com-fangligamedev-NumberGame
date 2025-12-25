
export enum Operator {
  ADD = '+',
  SUBTRACT = '-',
  MULTIPLY = '×',
  DIVIDE = '÷'
}

export interface Question {
  id: string;
  num1: number;
  num2: number;
  operator: Operator;
  answer: number;
  isReview?: boolean;
  isBoss?: boolean; 
  bossText?: string; 
}

export interface MistakeRecord {
  question: Question;
  userAnswer: number;
  timestamp: number;
  reviewCount: number;
  nextReviewTime: number;
  proficiency: number; 
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'level' | 'streak' | 'total' | 'operator' | 'boss';
  unlocked: boolean;
  condition: (stats: UserStats) => boolean;
}

export interface StageRecord {
  id: string; // e.g., "1", "2"
  timestamp: number;
  score: number; // 0-100
  stars: 0 | 1 | 2 | 3;
  totalQuestions: number;
  correctCount: number;
}

export interface OperatorStats {
  attempts: number;
  correct: number;
  totalTimeMs: number;
}

export interface UserStats {
  level: number;
  xp: number;
  currentStage: number; // The highest unlocked stage number (starts at 1)
  stageStars: Record<number, number>; // Map of Stage Number -> Stars Earned (0-3)
  totalQuestions: number;
  correctAnswers: number;
  currentStreak: number;
  maxStreak: number;
  badges: string[];
  mistakes: MistakeRecord[];
  dailyActivity: { date: string; count: number }[];
  stageHistory: StageRecord[];
  operatorStats: Record<Operator, OperatorStats>;
  bossesDefeated: number;
}

export interface GameSettings {
  maxNumber: number;
  allowNegative: boolean;
  operators: Operator[];
  questionsPerStage: number; 
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
