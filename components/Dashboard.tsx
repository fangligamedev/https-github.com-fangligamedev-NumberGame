import React, { useMemo, useState, useRef, useEffect } from 'react';
import { UserStats, Operator } from '../types';
import { BADGES, LEVEL_Thresholds } from '../constants';
import { Star, TrendingUp, History, Award, Check, Sword, Zap, Clock, Lock, MapPin, Castle, Crown, Palette, Wand2, Loader2, Image as ImageIcon } from 'lucide-react';
import { getXpProgress } from '../services/mathEngine';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';

interface Props {
  stats: UserStats;
  selectedOperators: Operator[];
  onToggleOperator: (op: Operator) => void;
  onStartStage: (stageNum: number) => void;
  onReview: () => void;
  onBossChallenge: () => void;
}

const Dashboard: React.FC<Props> = ({ stats, selectedOperators, onToggleOperator, onStartStage, onReview, onBossChallenge }) => {
  const [activeTab, setActiveTab] = useState<'map' | 'badges' | 'stats'>('map');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const nextLevelXp = LEVEL_Thresholds[stats.level] || 10000;
  const progress = getXpProgress(stats.xp, stats.level, LEVEL_Thresholds);

  const unlockedBadges = useMemo(() => {
    return BADGES.filter(b => stats.badges.includes(b.id));
  }, [stats.badges]);

  // Scroll to current stage on mount (Vertical Map)
  useEffect(() => {
    if (activeTab === 'map' && scrollRef.current) {
        setTimeout(() => {
            if (!scrollRef.current) return;
            const stageHeight = 90; 
            const containerHeight = scrollRef.current.clientHeight;
            const targetScroll = (stats.currentStage * stageHeight) - (containerHeight / 2);
            scrollRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
        }, 100);
    }
  }, [activeTab, stats.currentStage]);

  // Prepare chart data (last 7 days)
  const chartData = stats.dailyActivity.slice(-7);

  // Prepare Radar Data for Stats
  const radarData = useMemo(() => {
      const ops = [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE];
      const labels: Record<Operator, string> = { [Operator.ADD]: '加法', [Operator.SUBTRACT]: '减法', [Operator.MULTIPLY]: '乘法', [Operator.DIVIDE]: '除法' };
      
      return ops.map(op => {
          const s = stats.operatorStats?.[op] || { attempts: 0, correct: 0 };
          const acc = s.attempts > 0 ? (s.correct / s.attempts) * 100 : 0;
          return {
              subject: labels[op],
              A: Math.round(acc),
              fullMark: 100
          };
      });
  }, [stats.operatorStats]);

  // Prepare Speed Data
  const speedData = useMemo(() => {
    const ops = [Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE];
    const labels: Record<Operator, string> = { [Operator.ADD]: '加法', [Operator.SUBTRACT]: '减法', [Operator.MULTIPLY]: '乘法', [Operator.DIVIDE]: '除法' };
    
    return ops.map(op => {
        const s = stats.operatorStats?.[op] || { attempts: 0, totalTimeMs: 0 };
        const avg = s.attempts > 0 ? (s.totalTimeMs / s.attempts) / 1000 : 0;
        return {
            name: labels[op],
            time: Number(avg.toFixed(1))
        };
    });
  }, [stats.operatorStats]);


  const renderOperatorBtn = (op: Operator, label: string, colorClass: string) => {
    const isSelected = selectedOperators.includes(op);
    return (
      <button
        onClick={() => onToggleOperator(op)}
        className={`flex-1 py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-sm border-b-4 active:border-b-0 active:translate-y-1 ${
          isSelected 
            ? `${colorClass} text-white border-black/20` 
            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
        }`}
      >
        <span className="font-cartoon text-2xl">{op}</span>
        {isSelected && <Check size={16} strokeWidth={4} />}
      </button>
    );
  };

  // Helper for map path calculation
  const getMapPosition = (index: number) => {
      const y = index * 90; // 90px vertical spacing
      const xOffset = Math.sin(index * 0.8) * 35; // 35% swing from center
      const x = 50 + xOffset; // Center at 50%
      return { x: `${x}%`, y };
  };

  const getZoneIcon = (stageNum: number) => {
      const zone = Math.ceil(stageNum / 10);
      const icons = ['🌲', '🌵', '❄️', '🌋', '🔮', '🐙', '🦇', '☁️', '🍭', '🚀'];
      return icons[(zone - 1) % icons.length];
  };

  const renderVerticalMap = () => {
    const totalStages = 100;
    const stages = Array.from({ length: totalStages }, (_, i) => i + 1);
    const totalHeight = totalStages * 90 + 150; 

    return (
        <div 
            className="relative w-full px-4"
            style={{ height: `${totalHeight}px` }}
        >
            {/* Draw Path Lines First */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0 filter drop-shadow-md">
                {stages.map((stageNum) => {
                    if (stageNum >= totalStages) return null;
                    const curr = getMapPosition(stageNum);
                    const next = getMapPosition(stageNum + 1);
                    const yOffset = 40; 
                    const isCompletedPath = stageNum < stats.currentStage;
                    
                    return (
                        <line 
                            key={`line-${stageNum}`}
                            x1={curr.x} 
                            y1={curr.y + yOffset} 
                            x2={next.x} 
                            y2={next.y + yOffset} 
                            stroke={isCompletedPath ? "white" : "rgba(255,255,255,0.4)"} 
                            strokeWidth="8" 
                            strokeDasharray={isCompletedPath ? "0" : "12 8"}
                            strokeLinecap="round"
                        />
                    );
                })}
            </svg>

            {/* Render Nodes */}
            {stages.map((stageNum) => {
                const pos = getMapPosition(stageNum);
                const isLocked = stageNum > stats.currentStage;
                const stars = stats.stageStars[stageNum] || 0;
                const isBoss = stageNum % 5 === 0;
                const isZoneStart = (stageNum - 1) % 10 === 0;

                return (
                    <React.Fragment key={stageNum}>
                        {isZoneStart && (
                             <div 
                                className="absolute text-xs font-bold text-gray-500 bg-white/90 px-3 py-1 rounded-full border border-gray-200 backdrop-blur-sm shadow-sm z-0"
                                style={{ 
                                    top: pos.y - 40, 
                                    left: '50%', 
                                    transform: 'translateX(-50%)' 
                                }}
                             >
                                 第 {Math.ceil(stageNum/10)} 区域 {getZoneIcon(stageNum)}
                             </div>
                        )}

                        <div 
                            className="absolute flex flex-col items-center justify-center transform -translate-x-1/2 z-10"
                            style={{ 
                                left: pos.x, 
                                top: pos.y 
                            }}
                        >
                            <button
                                onClick={() => !isLocked && onStartStage(stageNum)}
                                disabled={isLocked}
                                className={`
                                    relative flex items-center justify-center shadow-lg transition-all duration-300
                                    ${isBoss 
                                        ? 'w-24 h-24 rounded-3xl border-4 rotate-45 hover:rotate-0' 
                                        : 'w-16 h-16 rounded-full border-b-4 hover:scale-110'
                                    }
                                    ${isLocked 
                                        ? 'bg-gray-200/80 backdrop-blur-sm border-gray-300 text-gray-400' 
                                        : isBoss
                                            ? 'bg-yellow-400 border-yellow-600 text-yellow-900 shadow-yellow-200'
                                            : stageNum === stats.currentStage 
                                                ? 'bg-blue-500 border-blue-700 text-white animate-bounce-small shadow-blue-200 ring-4 ring-blue-100'
                                                : 'bg-white border-blue-200 text-blue-600'
                                    }
                                `}
                            >
                                <div className={isBoss ? "-rotate-45 transition-transform group-hover:rotate-0" : ""}>
                                    {isLocked ? (
                                        <Lock size={isBoss ? 24 : 18} />
                                    ) : isBoss ? (
                                        <Castle size={32} />
                                    ) : (
                                        <span className="text-xl font-cartoon font-bold">{stageNum}</span>
                                    )}
                                </div>

                                {/* Stars for completed levels */}
                                {!isLocked && stars > 0 && (
                                    <div className={`absolute ${isBoss ? '-bottom-6 rotate-45' : '-bottom-2'} flex gap-0.5 bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm z-20`}>
                                        {[1, 2, 3].map(i => (
                                            <Star key={i} size={8} className={i <= stars ? "fill-yellow-400 text-yellow-400" : "text-gray-400"} />
                                        ))}
                                    </div>
                                )}
                                
                                {/* Boss Crown for completed Boss */}
                                {!isLocked && isBoss && stars > 0 && (
                                     <Crown size={20} className="absolute -top-6 text-yellow-500 fill-yellow-200 animate