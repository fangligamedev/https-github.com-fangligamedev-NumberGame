import { Question, Operator, MistakeRecord } from '../types';

// Spaced Repetition Logic
export const calculateNextReview = (record: MistakeRecord, isCorrect: boolean): MistakeRecord | null => {
  const currentProf = record.proficiency || 0;

  if (!isCorrect) {
      // Wrong answer: Reset proficiency and schedule immediate review (1 min)
      return {
          ...record,
          reviewCount: record.reviewCount + 1,
          proficiency: 0,
          nextReviewTime: Date.now() + 60 * 1000,
          timestamp: Date.now()
      };
  }

  // Correct answer: Increase proficiency
  const newProf = currentProf + 1;
  
  // Mastery threshold: 5 consecutive correct spaced reviews
  if (newProf >= 5) {
      return null; // Mastered! Remove from mistakes.
  }

  // Intervals based on new proficiency level:
  // 1: 5 min, 2: 30 min, 3: 4 hours, 4: 24 hours, 5: 3 days (Mastery check)
  const intervals = [
      5 * 60 * 1000,       // Prof 0 -> 1
      30 * 60 * 1000,      // Prof 1 -> 2
      4 * 60 * 60 * 1000,  // Prof 2 -> 3
      24 * 60 * 60 * 1000, // Prof 3 -> 4
      3 * 24 * 60 * 60 * 1000 // Prof 4 -> 5
  ];

  // Safety check for index
  const interval = intervals[Math.min(newProf - 1, intervals.length - 1)] || intervals[0];

  return {
      ...record,
      reviewCount: record.reviewCount + 1,
      proficiency: newProf,
      nextReviewTime: Date.now() + interval,
      timestamp: Date.now()
  };
};

export const generateQuestion = (
  maxNumber: number,
  operators: Operator[],
  mistakes: MistakeRecord[]
): Question => {
  // Helper to generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 1. Check if we should review a mistake (Spaced Repetition)
  const now = Date.now();
  const dueMistakes = mistakes.filter(m => m.nextReviewTime <= now);
  
  // 40% chance to serve a mistake if available (increased from 30% for better flow)
  if (dueMistakes.length > 0 && Math.random() < 0.4) {
    // Pick the most urgent one (earliest nextReviewTime)
    dueMistakes.sort((a, b) => a.nextReviewTime - b.nextReviewTime);
    // Add some randomness among the top 3 to avoid exact same order always
    const topCandidates = dueMistakes.slice(0, 3);
    const mistake = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    
    return {
      ...mistake.question,
      id: generateId(), // Ensure new ID so React renders it freshly
      isReview: true
    };
  }

  // 2. Generate New Question
  // Fallback to ADD if no operators provided (defensive coding)
  const validOperators = operators.length > 0 ? operators : [Operator.ADD];
  const operator = validOperators[Math.floor(Math.random() * validOperators.length)];
  let num1 = 0;
  let num2 = 0;
  let answer = 0;

  switch (operator) {
    case Operator.ADD:
      // Ensure sum <= maxNumber
      num1 = Math.floor(Math.random() * (maxNumber - 1)) + 1;
      num2 = Math.floor(Math.random() * (maxNumber - num1));
      answer = num1 + num2;
      break;
    case Operator.SUBTRACT:
      // Ensure positive result
      num1 = Math.floor(Math.random() * (maxNumber - 1)) + 1;
      num2 = Math.floor(Math.random() * num1); // num2 <= num1
      answer = num1 - num2;
      break;
    case Operator.MULTIPLY:
      // For multiplication, keep inputs smaller to stay within reasonable bounds for 3rd grade mental math
      const limit = Math.floor(Math.sqrt(maxNumber));
      num1 = Math.floor(Math.random() * limit) + 1;
      num2 = Math.floor(Math.random() * limit) + 1;
      answer = num1 * num2;
      break;
    case Operator.DIVIDE:
      // Reverse multiplication to ensure integer result
      const divLimit = Math.floor(Math.sqrt(maxNumber));
      const quotient = Math.floor(Math.random() * divLimit) + 1;
      num2 = Math.floor(Math.random() * divLimit) + 1; // Divisor
      num1 = quotient * num2; // Dividend
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

// Calculate XP needed for next level
export const getXpProgress = (xp: number, level: number, thresholds: number[]) => {
  const currentLevelXp = thresholds[level - 1] || 0;
  const nextLevelXp = thresholds[level] || 100000;
  const progress = Math.min(100, Math.max(0, ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100));
  return progress;
};