import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GameArena from './components/GameArena';
import MistakeReview from './components/MistakeReview';
import StageSummary from './components/StageSummary';
import ChatAssistant from './components/ChatAssistant';
import { UserStats, Question, Operator, GameSettings, MistakeRecord } from './types';
import { generateQuestion, calculateNextReview, getStageConfig } from './services/mathEngine';
import { BADGES, LEVEL_Thresholds } from './constants';
import { getEncouragement, generateBossQuestion } from './services/geminiService';

// Initial State
const INITIAL_STATS: UserStats = {
  level: 1,
  xp: 0,
  points: 0,
  rewardsRedeemed: [],
  currentStage: 1,
  stageStars: {},
  totalQuestions: 0,
  correctAnswers: 0,
  currentStreak: 0,
  maxStreak: 0,
  badges: [],
  mistakes: [],
  dailyActivity: [],
  stageHistory: [],
  bossesDefeated: 0,
  operatorStats: {
    [Operator.ADD]: { attempts: 0, correct: 0, totalTimeMs: 0 },
    [Operator.SUBTRACT]: { attempts: 0, correct: 0, totalTimeMs: 0 },
    [Operator.MULTIPLY]: { attempts: 0, correct: 0, totalTimeMs: 0 },
    [Operator.DIVIDE]: { attempts: 0, correct: 0, totalTimeMs: 0 },
  }
};

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'game' | 'review' | 'stage_summary'>('dashboard');
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [loading, setLoading] = useState(false);
  // View State for Rewards
  const [showRewards, setShowRewards] = useState(false); // Can be a modal or overlay
  
  // Selection State - Enabled all by default per user request
  const [selectedOperators, setSelectedOperators] = useState<Operator[]>([
    Operator.ADD, 
    Operator.SUBTRACT, 
    Operator.MULTIPLY, 
    Operator.DIVIDE
  ]);

  // Stage State
  const [stageQuestions, setStageQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [stageAnswers, setStageAnswers] = useState<{qId: string, correct: boolean, val: number}[]>([]);
  const [playingStageNumber, setPlayingStageNumber] = useState<number>(1); // -1 indicates Mistake Review Mode
  const [encouragement, setEncouragement] = useState<string | null>(null);
  
  // Load Data
  useEffect(() => {
    const saved = localStorage.getItem('mathQuestStats_v3'); // Updated version key
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Ensure new fields exist
      if (!parsed.operatorStats) parsed.operatorStats = INITIAL_STATS.operatorStats;
      if (!parsed.stageStars) parsed.stageStars = {};
      if (!parsed.currentStage) parsed.currentStage = 1;
      if (parsed.bossesDefeated === undefined) parsed.bossesDefeated = 0;
      if (parsed.points === undefined) parsed.points = 0;
      if (!parsed.rewardsRedeemed) parsed.rewardsRedeemed = [];
      setStats(parsed);
    }
  }, []);

  // Save Data
  useEffect(() => {
    localStorage.setItem('mathQuestStats_v3', JSON.stringify(stats));
  }, [stats]);

  const toggleOperator = (op: Operator) => {
    setSelectedOperators(prev => {
      // Don't allow empty selection
      if (prev.includes(op)) {
        if (prev.length === 1) return prev; 
        return prev.filter(o => o !== op);
      } else {
        return [...prev, op];
      }
    });
  };

  const handleResetData = () => {
      if (window.confirm("确定要重置所有游戏进度吗？这无法撤销哦！")) {
          localStorage.removeItem('mathQuestStats_v3');
          setStats(INITIAL_STATS);
          setView('dashboard');
          window.location.reload(); // Reload to clear any memory states/caches
      }
  };

  const checkBadges = (currentStats: UserStats): string[] => {
    const newBadges: string[] = [];
    BADGES.forEach(badge => {
      if (!currentStats.badges.includes(badge.id) && badge.condition(currentStats)) {
        newBadges.push(badge.id);
      }
    });
    return newBadges;
  };

  // --- NEW: Start Mistake Bootcamp ---
  const startReviewGame = () => {
      const mistakes = stats.mistakes;
      if (mistakes.length === 0) {
          alert("太棒了！你的错题本是空的，暂时不需要特训。");
          return;
      }

      setLoading(true);
      setEncouragement(null);
      setStageAnswers([]);
      setCurrentQIndex(0);
      setPlayingStageNumber(-1); // Special ID for Review Mode

      // Strategy: Pick up to 15 questions. 
      // Prioritize "Due" items (nextReviewTime < now).
      // Then prioritize low proficiency.
      const now = Date.now();
      const sorted = [...mistakes].sort((a, b) => {
          const aDue = a.nextReviewTime <= now;
          const bDue = b.nextReviewTime <= now;
          if (aDue && !bDue) return -1;
          if (!aDue && bDue) return 1;
          return a.proficiency - b.proficiency; // Lowest proficiency first
      });

      const batch = sorted.slice(0, 15);

      const questions: Question[] = batch.map(m => ({
          ...m.question,
          // Important: Regenerate ID so it's treated as a fresh game instance
          id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          isReview: true
      }));

      setStageQuestions(questions);
      setLoading(false);
      setView('game');
  };

  const startStage = async (stageNum: number) => {
    setPlayingStageNumber(stageNum);
    setLoading(true);
    setEncouragement(null);
    setStageAnswers([]);
    setCurrentQIndex(0);

    // GET CONFIG FROM MATH ENGINE
    const stageConfig = getStageConfig(stageNum);
    const questions: Question[] = [];

    // Generate normal questions
    // Default 10 questions per stage
    const questionCount = 10; 

    for (let i = 0; i < questionCount; i++) {
       // Allow mistakes to appear in first 3 slots if available (Spaced Repetition)
       const useMistakes = i < 3; 
       questions.push(generateQuestion(stageConfig, undefined, useMistakes ? stats.mistakes : []));
    }

    // Determine if Boss Question should appear
    // FIXED: Every 5 stages is a BOSS stage
    const isBossStage = stageNum % 5 === 0;

    if (isBossStage) {
        // Pass stageNum for difficulty scaling
        const bossQ = await generateBossQuestion(stats.level, stageConfig.operators, stageNum);
        if (bossQ) {
            questions[questions.length - 1] = {
                id: 'boss_' + Date.now(),
                num1: 0, num2: 0, operator: Operator.ADD, answer: bossQ.answer,
                isBoss: true,
                bossText: bossQ.text
            };
        }
    }

    setStageQuestions(questions);
    setLoading(false);
    setView('game');
  };

  const startBossChallenge = async () => {
    // Immediate Boss Fight (Extra Practice) - Use current stage context
    const currentStageConfig = getStageConfig(stats.currentStage);
    
    setPlayingStageNumber(stats.currentStage); 
    setLoading(true);
    setEncouragement(null);
    setStageAnswers([]);
    setCurrentQIndex(0);

    const bossQ = await generateBossQuestion(stats.level, currentStageConfig.operators, stats.currentStage);
    if (bossQ) {
        const q: Question = {
            id: 'boss_' + Date.now(),
            num1: 0, num2: 0, operator: Operator.ADD, answer: bossQ.answer,
            isBoss: true,
            bossText: bossQ.text
        };
        setStageQuestions([q]); // Single question stage
        setLoading(false);
        setView('game');
    } else {
        setLoading(false);
        alert("AI 暂时无法生成题目，请检查网络或稍后再试。");
    }
  };

  const handleAnswer = async (correct: boolean, userAnswer: number, timeTakenMs: number) => {
    // Safety check: Ensure question exists (prevents race conditions)
    const currentQuestion = stageQuestions[currentQIndex];
    if (!currentQuestion) {
        console.error("Critical Error: Question index out of bounds");
        return;
    }
    
    // 1. Record Answer
    const newAnswers = [...stageAnswers, { qId: currentQuestion.id, correct, val: userAnswer }];
    setStageAnswers(newAnswers);

    // 2. Update Global Stats
    const today = new Date().toISOString().split('T')[0];
    
    setStats(prev => {
      const newCorrect = correct ? prev.correctAnswers + 1 : prev.correctAnswers;
      const newStreak = correct ? prev.currentStreak + 1 : 0;
      const newMaxStreak = Math.max(prev.maxStreak, newStreak);
      const xpGain = correct ? 10 + (Math.min(newStreak, 10)) : 1; 
      // Boss Bonus
      const finalXpGain = (correct && currentQuestion.isBoss) ? xpGain + 50 : xpGain;
      const newXp = prev.xp + finalXpGain;
      // Points Logic (1 Point per correct answer, 5 for Boss)
      const pointsGain = correct ? (currentQuestion.isBoss ? 5 : 1) : 0;
      const newPoints = (prev.points || 0) + pointsGain;
      
      const newBossesDefeated = (correct && currentQuestion.isBoss) ? prev.bossesDefeated + 1 : prev.bossesDefeated;

      // Level Logic
      let newLevel = prev.level;
      if (LEVEL_Thresholds[prev.level] && newXp >= LEVEL_Thresholds[prev.level]) {
        newLevel = prev.level + 1;
      }

      const todayActivityIdx = prev.dailyActivity.findIndex(d => d.date === today);
      const newDaily = prev.dailyActivity.map(d => ({...d})); // Deep copy for safety
      
      if (todayActivityIdx > -1) {
          newDaily[todayActivityIdx].count += 1;
      } else {
          newDaily.push({ date: today, count: 1 });
      }

      // Update Operator Stats
      const op = currentQuestion.operator;
      const currentOpStats = prev.operatorStats[op] || { attempts: 0, correct: 0, totalTimeMs: 0 };
      const newOpStats = {
          attempts: currentOpStats.attempts + 1,
          correct: currentOpStats.correct + (correct ? 1 : 0),
          totalTimeMs: currentOpStats.totalTimeMs + timeTakenMs
      };

      // SRS Mistake Logic
      let newMistakes = [...prev.mistakes];
      
      // Helper to find existing mistake record
      // Check purely by numbers and operator, ignoring ID since ID changes in reviews
      const mistakeIndex = newMistakes.findIndex(m => 
        m.question.num1 === currentQuestion.num1 && 
        m.question.num2 === currentQuestion.num2 && 
        m.question.operator === currentQuestion.operator
      );

      if (mistakeIndex > -1) {
          // Existing mistake: Update using SRS
          const updatedRecord = calculateNextReview(newMistakes[mistakeIndex], correct);
          if (updatedRecord === null) {
              // Mastered! Remove it
              newMistakes.splice(mistakeIndex, 1);
          } else {
              // Update record
              newMistakes[mistakeIndex] = updatedRecord;
          }
      } else if (!correct) {
          // New mistake (not in list)
          const newRecord: MistakeRecord = {
              question: currentQuestion,
              userAnswer,
              timestamp: Date.now(),
              reviewCount: 0,
              nextReviewTime: Date.now() + 60 * 1000, // 1 min
              proficiency: 0
          };
          newMistakes.push(newRecord);
      }

      const tempStats = {
        ...prev,
        level: newLevel,
        xp: newXp,
        points: newPoints,
        totalQuestions: prev.totalQuestions + 1,
        correctAnswers: newCorrect,
        currentStreak: newStreak,
        maxStreak: newMaxStreak,
        mistakes: newMistakes,
        bossesDefeated: newBossesDefeated,
        dailyActivity: newDaily,
        operatorStats: {
            ...prev.operatorStats,
            [op]: newOpStats
        }
      };

      const earnedBadges = checkBadges(tempStats);
      return { ...tempStats, badges: [...prev.badges, ...earnedBadges] };
    });

    // 3. AI Encouragement
    if (correct && (stats.currentStreak + 1) % 4 === 0) {
      getEncouragement(stats.currentStreak + 1, stats.level).then(setEncouragement);
    }

    // 4. Progress or Finish Stage
    if (currentQIndex < stageQuestions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    } else {
      // Stage Finished
      finishStage(newAnswers);
    }
  };

  const finishStage = (answers: {qId: string, correct: boolean, val: number}[]) => {
      // If Review Mode (-1), we don't calculate stars or unlock levels
      if (playingStageNumber === -1) {
          setStageAnswers(answers);
          setView('stage_summary');
          return;
      }

      // Calculate Stars
      const correctCount = answers.filter(a => a.correct).length;
      const total = stageQuestions.length;
      const percentage = correctCount / total;
      let stars: 0 | 1 | 2 | 3 = 0;
      if (percentage >= 0.9) stars = 3;
      else if (percentage >= 0.6) stars = 2;
      else if (percentage >= 0.3) stars = 1;

      // Update Stage Progress in Stats
      if (stars > 0) {
          setStats(prev => {
              // Unlock next stage if we just beat the current highest stage
              const nextStage = playingStageNumber === prev.currentStage ? prev.currentStage + 1 : prev.currentStage;
              
              // Record stars (keep highest)
              const oldStars = prev.stageStars[playingStageNumber] || 0;
              
              return {
                  ...prev,
                  currentStage: nextStage,
                  stageStars: {
                      ...prev.stageStars,
                      [playingStageNumber]: Math.max(oldStars, stars)
                  }
              };
          });
      }

      setStageAnswers(answers);
      setView('stage_summary');
  };

  const handleRedeemReward = (reward: any) => {
      if (stats.points >= reward.cost) {
          if(window.confirm(`确定要消耗 ${reward.cost} 积分兑换 "${reward.name}" 吗？`)) {
              setStats(prev => ({
                  ...prev,
                  points: prev.points - reward.cost,
                  rewardsRedeemed: [...prev.rewardsRedeemed, { ...reward, id: Date.now().toString() }] // Unique ID for each redemption instance
              }));
              alert("兑换成功！快去找爸爸妈妈领取奖励吧！🎁");
          }
      } else {
          alert("积分不足，继续加油做题吧！💪");
      }
  };

  return (
    <div className={`min-h-screen text-gray-800 font-sans relative ${playingStageNumber === -1 ? 'bg-purple-50' : 'bg-[#f0f9ff]'}`}>
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex flex-col items-center justify-center text-white backdrop-blur-sm">
           <Loader2 className="animate-spin mb-4" size={48} />
           <p className="text-xl font-bold font-cartoon">
             {playingStageNumber === -1 ? '正在整理错题本...' : 'AI 老师正在准备题目...'}
           </p>
        </div>
      )}

      <header className="bg-white shadow-sm border-b border-blue-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
           <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('dashboard')}>
             <span className="text-3xl">🏝️</span>
             <span className="text-xl font-bold text-blue-600 font-cartoon">数理探险岛</span>
           </div>
           {view !== 'dashboard' && (
             <div className={`text-sm font-bold px-3 py-1 rounded-full ${playingStageNumber === -1 ? 'bg-purple-100 text-purple-600' : 'text-gray-500'}`}>
               {playingStageNumber === -1 ? '🛡️ 错题特训模式' : `关卡 ${playingStageNumber} | Lv.${stats.level}`}
             </div>
           )}
        </div>
      </header>

      <main className="p-4 pb-24"> 
        {view === 'dashboard' && (
          <Dashboard 
            stats={stats} 
            selectedOperators={selectedOperators}
            onToggleOperator={toggleOperator}
            onStartStage={startStage} 
            onReview={() => setView('review')} 
            onBossChallenge={startBossChallenge}
            onResetData={handleResetData}
            onRedeemReward={handleRedeemReward}
          />
        )}

        {view === 'game' && stageQuestions.length > 0 && stageQuestions[currentQIndex] && (
          <GameArena 
            question={stageQuestions[currentQIndex]}
            currentQuestionIndex={currentQIndex}
            totalQuestions={stageQuestions.length}
            streak={stats.currentStreak}
            onAnswer={handleAnswer} 
            onExit={() => setView('dashboard')}
            encouragement={encouragement}
            isReviewMode={playingStageNumber === -1}
          />
        )}

        {view === 'stage_summary' && (
            <StageSummary 
                questions={stageQuestions}
                userAnswers={stageAnswers}
                onNext={() => { setView('dashboard'); }}
                onRetry={() => playingStageNumber === -1 ? startReviewGame() : startStage(playingStageNumber)}
            />
        )}

        {view === 'review' && (
          <MistakeReview 
            mistakes={stats.mistakes} 
            onBack={() => setView('dashboard')} 
            onStartPractice={startReviewGame}
          />
        )}
      </main>

      <ChatAssistant />
    </div>
  );
};

export default App;