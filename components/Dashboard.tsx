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
                                     <Crown size={20} className="absolute -top-6 text-yellow-500 fill-yellow-200 animate-bounce" />
                                )}
                            </button>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
        {/* Top Stats Bar */}
        <div className="bg-white p-4 shadow-sm z-20 flex justify-between items-center sticky top-0">
            <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <span className="font-bold text-xl">{stats.level}</span> <span className="text-xs">Lv</span>
                </div>
                <div className="flex flex-col w-32">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>XP</span>
                        <span>{Math.floor(progress)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>

            <div className="flex gap-4">
                 <div className="flex items-center gap-1 text-orange-500">
                    <Zap size={18} className="fill-orange-500" />
                    <span className="font-bold">{stats.currentStreak}</span>
                </div>
                <div className="flex items-center gap-1 text-yellow-500">
                    <Star size={18} className="fill-yellow-500" />
                    <span className="font-bold">{Object.values(stats.stageStars).reduce((a, b) => a + b, 0)}</span>
                </div>
            </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-2 bg-white border-b border-gray-100 gap-2 overflow-x-auto z-20">
            <button 
                onClick={() => setActiveTab('map')}
                className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors whitespace-nowrap
                ${activeTab === 'map' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
                <MapPin size={16} /> 探险地图
            </button>
            <button 
                onClick={() => setActiveTab('stats')}
                className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors whitespace-nowrap
                ${activeTab === 'stats' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
                <TrendingUp size={16} /> 训练数据
            </button>
            <button 
                onClick={() => setActiveTab('badges')}
                className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold transition-colors whitespace-nowrap
                ${activeTab === 'badges' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
                <Award size={16} /> 荣誉徽章
            </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto relative bg-[#f0f9ff]" ref={scrollRef}>
            {activeTab === 'map' && renderVerticalMap()}

            {activeTab === 'stats' && (
                <div className="p-4 space-y-6 pb-20">
                     {/* Operator Toggle */}
                     <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <Sword size={18} className="text-blue-500" /> 训练项目
                        </h3>
                        <div className="flex gap-2">
                            {renderOperatorBtn(Operator.ADD, '加法', 'bg-pink-500 border-pink-600 shadow-pink-200')}
                            {renderOperatorBtn(Operator.SUBTRACT, '减法', 'bg-blue-500 border-blue-600 shadow-blue-200')}
                            {renderOperatorBtn(Operator.MULTIPLY, '乘法', 'bg-purple-500 border-purple-600 shadow-purple-200')}
                            {renderOperatorBtn(Operator.DIVIDE, '除法', 'bg-orange-500 border-orange-600 shadow-orange-200')}
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <TrendingUp size={18} className="text-blue-500" /> 能力雷达
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="#e5e7eb" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 12 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name="Accuracy" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'badges' && (
                <div className="p-4 grid grid-cols-2 gap-3 pb-20">
                    {BADGES.map(badge => {
                        const isUnlocked = stats.badges.includes(badge.id);
                        return (
                            <div key={badge.id} className={`p-3 rounded-2xl border-b-4 flex flex-col items-center text-center gap-2 relative overflow-hidden ${isUnlocked ? 'bg-white border-yellow-200 shadow-sm' : 'bg-gray-100 border-gray-200 opacity-70 grayscale'}`}>
                                <div className="text-4xl mb-1">{badge.icon}</div>
                                <div className="font-bold text-gray-800 text-sm">{badge.name}</div>
                                <div className="text-xs text-gray-500 leading-tight">{badge.description}</div>
                                {!isUnlocked && <Lock size={16} className="absolute top-2 right-2 text-gray-400" />}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
        
        {/* Review Button Floating */}
        <div className="absolute bottom-6 right-6 z-30">
             <button onClick={onReview} className="bg-white p-3 rounded-full shadow-lg border border-gray-100 text-orange-500 hover:scale-110 transition-transform relative">
                <History size={24} />
                {stats.mistakes.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full animate-pulse">{stats.mistakes.length}</span>}
            </button>
        </div>
    </div>
  );
};

export default Dashboard;