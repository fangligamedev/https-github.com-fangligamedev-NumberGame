import { Question, Operator, MistakeRecord } from '../types';

// Spaced Repetition Logic
export const calculateNextReview = (record: MistakeRecord, isCorrect: boolean): MistakeRecord | null => {
  const currentProf = record.proficiency || 0;

  if (!isCorrect) {
      return {
          ...record,
          reviewCount: record.reviewCount + 1,
          proficiency: 0,
          nextReviewTime: Date.now() + 60 * 1000,
          timestamp: Date.now()
      };
  }

  const newProf = currentProf + 1;
  
  if (newProf >= 5) {
      return null; 
  }

  const intervals = [
      5 * 60 * 1000,       
      30 * 60 * 1000,      
      4 * 60 * 60 * 1000,  
      24 * 60 * 60 * 1000, 
      3 * 24 * 60 * 60 * 1000 
  ];

  const interval = intervals[Math.min(newProf - 1, intervals.length - 1)] || intervals[0];

  return {
      ...record,
      reviewCount: record.reviewCount + 1,
      proficiency: newProf,
      nextReviewTime: Date.now() + interval,
      timestamp: Date.now()
  };
};

// --- SHANGHAI 3RD GRADE+ STAGE CONFIGURATION ---

export interface StageConfig {
    min: number;
    max: number;
    operators: Operator[];
    description: string;
    multiStep?: boolean; // Future expansion
}

export const getStageConfig = (stage: number): StageConfig => {
    // Stage 1-10: Shanghai 3rd Grade Start (3-digit Add/Sub, 2-digit x 1-digit)
    if (stage <= 10) {
        return { 
            min: 10, max: 200, 
            operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE], 
            description: "三年级基础：百以内混合运算与倍数" 
        };
    }
    // Stage 11-30: Middle 3rd Grade (3-digit mixed, multi-digit Div)
    if (stage <= 30) {
        return { 
            min: 50, max: 500, 
            operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE], 
            description: "三年级进阶：三位数混合运算" 
        };
    }
    // Stage 31-60: Late 3rd / 4th Grade (Complex logic, larger multiples)
    if (stage <= 60) {
        return { 
            min: 100, max: 800, 
            operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE], 
            description: "四则运算大师：大数综合挑战" 
        };
    }
    // Stage 61-100: Final Mastery (Up to 1000, tricky combinations)
    return { 
        min: 200, max: 1000, 
        operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE], 
        description: "数理极限：1000以内终极综合" 
    };
};

// Updated Generator for higher difficulty
export const generateQuestion = (
  maxNumberOrConfig: number | StageConfig,
  operators?: Operator[], // Legacy support
  mistakes: MistakeRecord[] = []
): Question => {
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Review Check
  const now = Date.now();
  const dueMistakes = mistakes.filter(m => m.nextReviewTime <= now);
  if (dueMistakes.length > 0 && Math.random() < 0.3) {
    dueMistakes.sort((a, b) => a.nextReviewTime - b.nextReviewTime);
    const topCandidates = dueMistakes.slice(0, 3);
    const mistake = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    return { ...mistake.question, id: generateId(), isReview: true };
  }

  let config: StageConfig;
  if (typeof maxNumberOrConfig === 'number') {
      config = { min: 1, max: maxNumberOrConfig, operators: operators || [Operator.ADD], description: "Custom" };
  } else {
      config = maxNumberOrConfig;
  }

  const validOperators = config.operators.length > 0 ? config.operators : [Operator.ADD];
  const operator = validOperators[Math.floor(Math.random() * validOperators.length)];
  let num1 = 0, num2 = 0, answer = 0;

  switch (operator) {
    case Operator.ADD:
      // More challenging: Three-digit logic if max permits
      num1 = Math.floor(Math.random() * (config.max * 0.7 - config.min)) + config.min;
      num2 = Math.floor(Math.random() * (config.max - num1 - 10)) + 10;
      answer = num1 + num2;
      break;

    case Operator.SUBTRACT:
      num1 = Math.floor(Math.random() * (config.max - config.min)) + config.min;
      // Ensure substantial difference
      num2 = Math.floor(Math.random() * (num1 - 5)) + 5;
      answer = num1 - num2;
      break;

    case Operator.MULTIPLY:
      // Shanghai 3rd Grade: 2-digit x 1-digit or 2-digit x 2-digit
      if (config.max < 300) {
          num1 = Math.floor(Math.random() * 50) + 11; // 11-60
          num2 = Math.floor(Math.random() * 8) + 2;  // 2-9
      } else {
          num1 = Math.floor(Math.random() * 80) + 12; // 12-92
          num2 = Math.floor(Math.random() * 11) + 3;  // 3-13
      }
      answer = num1 * num2;
      break;

    case Operator.DIVIDE:
      // Multi-digit division
      let divisor = Math.floor(Math.random() * 8) + 2; // 2-9
      let quotient = Math.floor(Math.random() * (config.max / 10)) + 11; // Ensure 2-digit quotient
      num2 = divisor;
      num1 = quotient * divisor;
      answer = quotient;
      break;
  }

  return { id: generateId(), num1, num2, operator, answer, isReview: false };
};

export const getXpProgress = (xp: number, level: number, thresholds: number[]) => {
  const currentLevelXp = thresholds[level - 1] || 0;
  const nextLevelXp = thresholds[level] || 100000;
  return Math.min(100, Math.max(0, ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
};