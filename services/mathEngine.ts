import { Question, Operator, MistakeRecord } from '../types';

// Spaced Repetition Logic (Unchanged)
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

// --- NEW STAGE CONFIGURATION ---

export interface StageConfig {
    min: number;
    max: number;
    operators: Operator[];
    description: string;
    // Specific constraints
    forceMultiplicationRange?: [number, number]; // e.g. [2, 5] means 2x? to 5x?
    forceDivisionRange?: [number, number];
}

export const getStageConfig = (stage: number): StageConfig => {
    // 1. Beginner: 0-10 Add/Sub
    if (stage <= 5) {
        return { 
            min: 0, max: 10, 
            operators: [Operator.ADD, Operator.SUBTRACT], 
            description: "10以内加减法启蒙" 
        };
    }
    // 2. Basic: 0-20 Add/Sub (Intro to carry/borrow implicitly)
    if (stage <= 10) {
        return { 
            min: 0, max: 20, 
            operators: [Operator.ADD, Operator.SUBTRACT], 
            description: "20以内加减法" 
        };
    }
    // 3. Intermediate Add/Sub: 0-50
    if (stage <= 15) {
        return { 
            min: 5, max: 50, 
            operators: [Operator.ADD, Operator.SUBTRACT], 
            description: "50以内加减法" 
        };
    }
    // 4. Advanced Add/Sub: 0-100
    if (stage <= 20) {
        return { 
            min: 10, max: 100, 
            operators: [Operator.ADD, Operator.SUBTRACT], 
            description: "100以内加减法挑战" 
        };
    }
    // 5. Multiplication Intro (2,3,4,5 tables)
    if (stage <= 25) {
        return { 
            min: 1, max: 100, 
            operators: [Operator.MULTIPLY], 
            forceMultiplicationRange: [2, 5],
            description: "乘法口诀表 (2-5)" 
        };
    }
    // 6. Multiplication Advanced (6,7,8,9 tables)
    if (stage <= 30) {
        return { 
            min: 1, max: 100, 
            operators: [Operator.MULTIPLY], 
            forceMultiplicationRange: [6, 9],
            description: "乘法口诀表 (6-9)" 
        };
    }
    // 7. Mixed 100 (Add/Sub/Mul)
    if (stage <= 35) {
        return { 
            min: 10, max: 100, 
            operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY], 
            forceMultiplicationRange: [2, 9],
            description: "100以内混合运算" 
        };
    }
    // 8. Division Intro
    if (stage <= 40) {
        return { 
            min: 1, max: 100, 
            operators: [Operator.DIVIDE], 
            forceDivisionRange: [2, 9], // Divisors
            description: "除法入门" 
        };
    }
    // 9. Master 100 (All Ops)
    if (stage <= 50) {
        return { 
            min: 10, max: 100, 
            operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE], 
            forceMultiplicationRange: [2, 12],
            forceDivisionRange: [2, 10],
            description: "100以内四则运算精通" 
        };
    }
    // 10. Larger Numbers (500)
    if (stage <= 70) {
        return { 
            min: 50, max: 500, 
            operators: [Operator.ADD, Operator.SUBTRACT], 
            description: "500以内大数加减" 
        };
    }
    // 11. The Quest (1000)
    return { 
        min: 100, max: 1000, 
        operators: [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE], 
        description: "1000以内终极挑战" 
    };
};

// Updated Generator that takes Config or defaults
export const generateQuestion = (
  maxNumberOrConfig: number | StageConfig,
  operators?: Operator[], // Legacy support
  mistakes: MistakeRecord[] = []
): Question => {
  // Helper to generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Check Review
  const now = Date.now();
  const dueMistakes = mistakes.filter(m => m.nextReviewTime <= now);
  if (dueMistakes.length > 0 && Math.random() < 0.4) {
    dueMistakes.sort((a, b) => a.nextReviewTime - b.nextReviewTime);
    const topCandidates = dueMistakes.slice(0, 3);
    const mistake = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    return {
      ...mistake.question,
      id: generateId(), 
      isReview: true
    };
  }

  // Determine Config
  let config: StageConfig;
  if (typeof maxNumberOrConfig === 'number') {
      // Legacy mode
      config = {
          min: 1,
          max: maxNumberOrConfig,
          operators: operators || [Operator.ADD],
          description: "Custom"
      };
  } else {
      config = maxNumberOrConfig;
  }

  const validOperators = config.operators.length > 0 ? config.operators : [Operator.ADD];
  const operator = validOperators[Math.floor(Math.random() * validOperators.length)];
  let num1 = 0;
  let num2 = 0;
  let answer = 0;

  switch (operator) {
    case Operator.ADD:
      // num1 [min, max-1]
      // num2 such that sum <= max
      num1 = Math.floor(Math.random() * (config.max - config.min)) + config.min;
      // Ensure num1 is at least 1 to avoid 0+0 boring questions if min=0
      if (num1 === 0 && Math.random() > 0.1) num1 = Math.floor(Math.random() * 10) + 1;
      
      const maxForNum2 = config.max - num1;
      if (maxForNum2 < 0) { num1 = Math.floor(config.max / 2); } // fallback
      
      num2 = Math.floor(Math.random() * (config.max - num1));
      answer = num1 + num2;
      break;

    case Operator.SUBTRACT:
      // answer should be >= 0 (or min? usually 0 for sub)
      num1 = Math.floor(Math.random() * (config.max - config.min)) + config.min;
      if (num1 < config.max / 4) num1 = Math.floor(Math.random() * (config.max - config.max/4)) + Math.floor(config.max/4); // push higher numbers
      
      num2 = Math.floor(Math.random() * num1); 
      answer = num1 - num2;
      break;

    case Operator.MULTIPLY:
      if (config.forceMultiplicationRange) {
          // Table based: One number is from the range
          const [minF, maxF] = config.forceMultiplicationRange;
          num1 = Math.floor(Math.random() * (maxF - minF + 1)) + minF;
          // The other number is random up to 12 usually for times tables
          num2 = Math.floor(Math.random() * 9) + 2; 
      } else {
          // General bounds
          const limit = Math.floor(Math.sqrt(config.max));
          num1 = Math.floor(Math.random() * limit) + 2;
          num2 = Math.floor(Math.random() * limit) + 2;
      }
      answer = num1 * num2;
      break;

    case Operator.DIVIDE:
      let divisor = 2;
      let quotient = 2;
      
      if (config.forceDivisionRange) {
           const [minD, maxD] = config.forceDivisionRange;
           divisor = Math.floor(Math.random() * (maxD - minD + 1)) + minD;
           quotient = Math.floor(Math.random() * 9) + 2;
      } else {
          const divLimit = Math.floor(Math.sqrt(config.max));
          divisor = Math.floor(Math.random() * divLimit) + 2;
          quotient = Math.floor(Math.random() * divLimit) + 2;
      }
      
      num2 = divisor;
      num1 = quotient * divisor; 
      answer = quotient;
      break;
  }

  return {
    id: generateId(),
    num1,
    num2,
    operator,
    answer,
    isReview: false
  };
};

export const getXpProgress = (xp: number, level: number, thresholds: number[]) => {
  const currentLevelXp = thresholds[level - 1] || 0;
  const nextLevelXp = thresholds[level] || 100000;
  const progress = Math.min(100, Math.max(0, ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
  return progress;
};