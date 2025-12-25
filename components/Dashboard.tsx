import React, { useMemo, useState, useRef, useEffect } from 'react';
import { UserStats, Operator } from '../types';
import { BADGES, LEVEL_Thresholds, REWARDS } from '../constants';
import { Star, TrendingUp, History, Award, Check, Sword, Zap, Lock, MapPin, Castle, Crown, Clock, RotateCcw, Gift, ShoppingBag } from 'lucide-react';
import { getXpProgress } from '../services/mathEngine';
import { 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip
} from 'recharts';

interface Props {
  stats: UserStats;
  selectedOperators: Operator[];
  onToggleOperator: (op: Operator) => void;
  onStartStage: (stageNum: number) => void;
  onReview: () => void;
  onBossChallenge: () => void;
  onResetData: () => void;
  onRedeemReward: (reward: any) => void; // New
}

const Dashboard: React.FC<Props> = ({ stats, selectedOperators, onToggleOperator, onStartStage, onReview, onBossChallenge, onResetData, onRedeemReward }) => {
  const [activeTab, setActiveTab] = useState<'map' | 'badges' | 'stats'>('map');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const progress = getXpProgress(stats.xp, stats.level, LEVEL_Thresholds);

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

  const renderOperatorBtn = (op: Operator, colorClass: string) => {
    const isSelected = selectedOperators.includes(op);
    return (
      <button
        onClick={() => onToggleOperator(op)}
        className={`flex-1 aspect-square rounded-xl font-bold text-2xl flex items-center justify-center transition-all shadow-sm border-b-4 active:border-b-0 active:translate-y-1 ${
          isSelected 
            ? `${colorClass} text-white border-black/20` 
            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
        }`}
      >
        {op === Operator.MULTIPLY ? '×' : op === Operator.DIVIDE ? '÷' : op}
        {isSelected && <div className="absolute top-1 right-1"><Check size={12} strokeWidth={4} /></div>}
      </button>
    );
  };

  const getMapPosition = (index: number) => {
      const y = index * 90; 
      const xOffset = Math.sin(index * 0.8) * 35; 
      const x = 50 + xOffset; 
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
            className="relative w-full px-4 mt-4"
            style={{ height: `${totalHeight}px` }}
        >
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

                                {!isLocked && stars > 0 && (
                                    <div className={`absolute ${isBoss ? '-bottom-6 rotate-45' : '-bottom-2'} flex gap-0.5 bg-black/60 px-1.5 py-0.5 rounded-full backdrop-blur-sm z-20`}>
                                        {[1, 2, 3].map(i => (
                                            <Star key={i} size={8} className={i <= stars ? "fill-yellow-400 text-yellow-400" : "text-gray-400"} />
                                        ))}
                                    </div>
                                )}
                                
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
    <div className="flex flex-col h-full bg-[#f0f9ff]">
        {/* Top User Bar */}
        <div className="bg-white p-4 m-4 rounded-3xl shadow-sm flex items-center gap-4 border border-blue-100 z-20 sticky top-4">
            <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-4xl border-4 border-yellow-200 shadow-inner">
                🦁
            </div>
            <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1">
                    <h2 className="text-xl font-bold text-gray-800">小小探险家</h2>
                    <div className="text-sm font-bold text-gray-500">目标: 100</div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded text-xs font-bold">
                        Lv.{stats.level}
                    </div>
                    <div className="text-xs text-gray-400">星星: {Object.values(stats.stageStars).reduce((a: any, b: any) => a + b, 0)} ⭐</div>
                    <div className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-100">
                        <Gift size={10} /> 积分: {stats.points || 0}
                    </div>
                </div>
                <div className="mt-2 h-3 bg-gray-100 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                    <div className="absolute top-0 right-2 text-[10px] text-gray-400 leading-3">XP: {stats.xp}</div>
                </div>
            </div>
        </div>

        {/* Tab Switcher (Segmented Control Style) */}
        <div className="px-4 mb-4 z-20 sticky top-28">
             <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-blue-100">
                <button 
                    onClick={() => setActiveTab('map')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300
                    ${activeTab === 'map' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    冒险地图
                </button>
                <button 
                    onClick={() => setActiveTab('badges')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300
                    ${activeTab === 'badges' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    荣誉徽章
                </button>
                <button 
                    onClick={() => setActiveTab('stats')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300
                    ${activeTab === 'stats' ? 'bg-blue-500 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    能力分析
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-8 relative" ref={scrollRef}>
            {activeTab === 'map' && (
                <div className="flex flex-col gap-4">
                    {/* Control Panel Section */}
                    <div className="px-4 flex flex-col md:flex-row gap-4">
                        {/* Training Items - Compact */}
                        <div className="bg-white p-4 rounded-3xl shadow-sm border border-blue-100 md:w-52 shrink-0">
                            <h3 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                                <Sword size={14} /> 训练项目
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {renderOperatorBtn(Operator.ADD, 'bg-blue-500 border-blue-600')}
                                {renderOperatorBtn(Operator.SUBTRACT, 'bg-red-500 border-red-600')}
                                {renderOperatorBtn(Operator.MULTIPLY, 'bg-orange-500 border-orange-600')}
                                {renderOperatorBtn(Operator.DIVIDE, 'bg-purple-500 border-purple-600')}
                            </div>
                        </div>

                        {/* Actions - Big Buttons */}
                        <div className="flex-1 flex gap-3 h-full">
                            <button 
                                onClick={onBossChallenge}
                                className="flex-1 bg-white border border-red-100 rounded-3xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95 group h-full min-h-[140px]"
                            >
                                <div className="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-colors">
                                    <Sword size={20} />
                                </div>
                                <span className="text-xs font-bold text-red-500">BOSS 练习场</span>
                            </button>

                            <button 
                                onClick={onReview}
                                className="flex-1 bg-white border border-purple-100 rounded-3xl p-3 flex flex-col items-center justify-center gap-2 shadow-sm hover:shadow-md transition-all active:scale-95 group relative h-full min-h-[140px]"
                            >
                                {stats.mistakes.length > 0 && (
                                    <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-bounce" />
                                )}
                                <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                    <History size={20} />
                                </div>
                                <span className="text-xs font-bold text-purple-500">错题特训</span>
                            </button>
                        </div>
                    </div>

                    {/* Map */}
                    {renderVerticalMap()}
                </div>
            )}

            {activeTab === 'stats' && (
                <div className="p-4 space-y-6">
                    {/* Top Row: Radar & Speed Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
                            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2 text-lg">
                                <Zap size={20} className="text-yellow-500 fill-yellow-500" /> 能力雷达 (正确率)
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                        <PolarGrid stroke="#e5e7eb" />
                                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 14, fontWeight: 'bold' }} />
                                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                        <Radar name="Accuracy" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-blue-100">
                            <h3 className="font-bold text-gray-700 mb-6 flex items-center gap-2 text-lg">
                                <Clock size={20} className="text-blue-500" /> 平均答题速度 (秒)
                            </h3>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart layout="vertical" data={speedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 14, fontWeight: 'bold' }} />
                                        <Tooltip 
                                            cursor={{ fill: '#f3f4f6' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        />
                                        <Bar dataKey="time" fill="#60a5fa" radius={[0, 4, 4, 0]} barSize={32} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Detailed Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { op: Operator.ADD, label: '加法', color: 'text-blue-500' },
                            { op: Operator.SUBTRACT, label: '减法', color: 'text-green-500' },
                            { op: Operator.MULTIPLY, label: '乘法', color: 'text-purple-500' },
                            { op: Operator.DIVIDE, label: '除法', color: 'text-orange-500' },
                        ].map(({ op, label, color }) => {
                            const s = stats.operatorStats?.[op] || { attempts: 0, correct: 0, totalTimeMs: 0 };
                            const acc = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0;
                            const avgTime = s.attempts > 0 ? (s.totalTimeMs / s.attempts / 1000).toFixed(1) : '-';

                            return (
                                <div key={op} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between h-36 relative overflow-hidden group hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start z-10">
                                        <span className={`text-lg font-bold ${color}`}>{label}</span>
                                        <span className="text-2xl font-bold text-gray-200 group-hover:text-gray-300 transition-colors">
                                            {op === Operator.MULTIPLY ? '×' : op === Operator.DIVIDE ? '÷' : op}
                                        </span>
                                    </div>
                                    
                                    <div className="space-y-1 z-10">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">正确率</span>
                                            <span className={`font-bold ${acc >= 90 ? 'text-green-500' : acc >= 60 ? 'text-yellow-500' : 'text-gray-400'}`}>{acc}%</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">平均用时</span>
                                            <span className="font-bold text-gray-700">{avgTime}s</span>
                                        </div>
                                        <div className="flex justify-between text-xs pt-2 border-t border-gray-50 mt-2">
                                            <span className="text-gray-400">已练习</span>
                                            <span className="text-gray-500">{s.attempts} 题</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Reset Data Button */}
                    <div className="pt-8 flex justify-center">
                        <button 
                            onClick={onResetData}
                            className="text-red-400 text-sm flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-red-50 transition-colors border border-transparent hover:border-red-100"
                        >
                            <RotateCcw size={14} /> 重置所有游戏数据
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'badges' && (
                <div className="p-4 pb-20 space-y-8">
                    {/* Points Wallet */}
                    <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-6 rounded-3xl shadow-lg text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="text-sm font-bold opacity-80 mb-1">我的积分账户</div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black">{stats.points || 0}</span>
                                <span className="text-xl font-bold">分</span>
                            </div>
                            <p className="text-xs mt-2 opacity-90">答对题目和击败BOSS可以获得积分哦！</p>
                        </div>
                        <Gift size={120} className="absolute -right-8 -bottom-8 opacity-20 rotate-12 z-0" />
                    </div>

                    {/* Honor Badges */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-lg">
                            <Award size={20} className="text-blue-500" /> 荣誉徽章
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            {BADGES.filter(b => b.unlocked || stats.badges.includes(b.id) || b.id.includes('level_')).slice(0, 8).map(badge => {
                                const isUnlocked = stats.badges.includes(badge.id);
                                return (
                                    <div key={badge.id} className={`p-4 rounded-3xl border-b-4 flex flex-col items-center text-center gap-3 relative overflow-hidden transition-all ${isUnlocked ? 'bg-white border-yellow-200 shadow-sm' : 'bg-gray-100 border-gray-200 opacity-60 grayscale'}`}>
                                        <div className="text-5xl drop-shadow-sm">{badge.icon}</div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">{badge.name}</div>
                                            <div className="text-[10px] text-gray-500 mt-1">{badge.description}</div>
                                        </div>
                                        {!isUnlocked && <Lock size={16} className="absolute top-3 right-3 text-gray-400" />}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="text-center mt-4">
                            <button className="text-blue-500 text-sm font-bold">查看全部徽章 ({stats.badges.length}/{BADGES.length})</button>
                        </div>
                    </div>

                    {/* Reward Shop */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-lg">
                            <ShoppingBag size={20} className="text-pink-500" /> 积分商城
                        </h3>
                        <div className="grid grid-cols-1 gap-3">
                            {REWARDS.map(reward => (
                                <button 
                                    key={reward.id}
                                    onClick={() => onRedeemReward(reward)}
                                    className="bg-white p-4 rounded-3xl shadow-sm border border-pink-100 flex items-center justify-between group active:scale-95 transition-all hover:shadow-md"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-pink-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                                            {reward.icon}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-gray-800">{reward.name}</div>
                                            <div className="text-xs text-pink-500 font-bold flex items-center gap-1 mt-1">
                                                <Zap size={12} className="fill-pink-500" /> 消耗 {reward.cost} 积分
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`px-5 py-2 rounded-2xl font-bold text-sm transition-colors ${stats.points >= reward.cost ? 'bg-pink-500 text-white shadow-pink-200 shadow-lg' : 'bg-gray-100 text-gray-400'}`}>
                                        {stats.points >= reward.cost ? '立即兑换' : '积分不足'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default Dashboard;