import React, { useMemo, useState, useRef, useEffect } from 'react';
import { UserStats, Operator } from '../types';
import { BADGES, LEVEL_Thresholds } from '../constants';
import { Star, TrendingUp, History, Award, Check, Sword, Zap, Clock, Lock, MapPin, Castle, Crown, Palette, Wand2, Loader2, Image as ImageIcon } from 'lucide-react';
import { getXpProgress } from '../services/mathEngine';
import { getZoneBackground } from '../services/geminiService';
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
  
  // Background Generation State
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [bgLoading, setBgLoading] = useState(false);

  const currentZone = Math.ceil(stats.currentStage / 10);

  const nextLevelXp = LEVEL_Thresholds[stats.level] || 10000;
  const progress = getXpProgress(stats.xp, stats.level, LEVEL_Thresholds);

  const unlockedBadges = useMemo(() => {
    return BADGES.filter(b => stats.badges.includes(b.id));
  }, [stats.badges]);

  // Load Background Automatically
  useEffect(() => {
    const loadBg = async () => {
        setBgLoading(true);
        // Attempt to load background silently. If API key exists, it generates. If not, it fails silently.
        const img = await getZoneBackground(currentZone);
        if (img) setBgImage(img);
        setBgLoading(false);
    };
    loadBg();
  }, [currentZone]);

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
    <div className="w-full max-w-4xl mx-auto p-4 space-y-6">
      {/* Header Profile */}
      <div className="bg-white rounded-3xl p-6 shadow-xl border-b-4 border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Background Image Effect for Header */}
        {bgImage && (
            <div className="absolute inset-0 z-0 opacity-10">
                <img src={bgImage} className="w-full h-full object-cover" alt="header bg" />
            </div>
        )}
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-20 h-20 bg-yellow-300 rounded-full flex items-center justify-center text-4xl shadow-inner border-4 border-white">
            🦁
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 font-cartoon">小小探险家</h1>
            <div className="flex items-center gap-2 text-gray-500">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">Lv.{stats.level}</span>
              <span className="text-sm">星星: {Object.values(stats.stageStars).reduce((a: number, b: number) => a+b, 0)} ⭐</span>
            </div>
          </div>
        </div>
        
        {/* XP Bar */}
        <div className="flex-1 w-full md:w-auto relative z-10">
          <div className="flex justify-between text-sm font-bold text-gray-600 mb-1">
            <span>XP: {stats.xp}</span>
            <span>目标: {nextLevelXp}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden border border-gray-300">
            <div 
              className="bg-gradient-to-r from-green-400 to-green-500 h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-3 rounded-2xl font-bold font-cartoon transition-all ${activeTab === 'map' ? 'bg-blue-500 text-white shadow-lg transform -translate-y-1' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            冒险地图
          </button>
          <button 
            onClick={() => setActiveTab('badges')}
            className={`flex-1 py-3 rounded-2xl font-bold font-cartoon transition-all ${activeTab === 'badges' ? 'bg-yellow-500 text-white shadow-lg transform -translate-y-1' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            荣誉勋章
          </button>
          <button 
            onClick={() => setActiveTab('stats')}
            className={`flex-1 py-3 rounded-2xl font-bold font-cartoon transition-all ${activeTab === 'stats' ? 'bg-indigo-500 text-white shadow-lg transform -translate-y-1' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            能力分析
          </button>
      </div>

      {/* Map Tab Content */}
      {activeTab === 'map' && (
        <div className="space-y-6 animate-pop">
             {/* Config Panel */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-2xl shadow-md border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
                    🛠️ 训练项目
                    </h3>
                    <div className="flex gap-2">
                        {renderOperatorBtn(Operator.ADD, '加法', 'bg-blue-500')}
                        {renderOperatorBtn(Operator.SUBTRACT, '减法', 'bg-red-500')}
                        {renderOperatorBtn(Operator.MULTIPLY, '乘法', 'bg-orange-500')}
                        {renderOperatorBtn(Operator.DIVIDE, '除法', 'bg-purple-500')}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={onBossChallenge}
                        className="bg-white hover:bg-red-50 text-red-600 rounded-2xl p-4 shadow border border-red-100 flex flex-col items-center justify-center gap-1 group transition-all"
                        >
                        <Sword size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-bold">BOSS 练习场</span>
                    </button>

                    <button 
                        onClick={onReview}
                        className="bg-white hover:bg-purple-50 text-purple-600 rounded-2xl p-4 shadow border border-purple-100 flex flex-col items-center justify-center gap-1 group transition-all"
                        >
                        <History size={24} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-bold">错题特训</span>
                    </button>
                </div>
            </div>

             {/* Vertical Map Scroller with Dynamic Background */}
             <div className="relative rounded-3xl shadow-xl overflow-hidden border-4 border-blue-200 bg-blue-50">
                {/* AI Background Layer */}
                <div className="absolute inset-0 z-0">
                    {bgImage ? (
                        <div className="w-full h-full relative">
                            <img src={bgImage} className="w-full h-full object-cover opacity-80" alt="map background" />
                            <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-blue-900/10"></div>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed opacity-50"></div>
                    )}
                </div>

                {/* Loading Indicator */}
                {bgLoading && (
                    <div className="absolute top-4 right-4 z-20 bg-black/50 text-white text-xs px-3 py-1 rounded-full flex items-center gap-2">
                        <Loader2 size={12} className="animate-spin" /> 正在绘制地图背景...
                    </div>
                )}

                <div 
                    ref={scrollRef}
                    className="relative z-10 overflow-y-auto h-[600px] scroll-smooth custom-scrollbar"
                >
                    {renderVerticalMap()}
                </div>
             </div>
        </div>
      )}

      {/* Badges Tab Content */}
      {activeTab === 'badges' && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 min-h-[500px]">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 font-cartoon">
              <Award className="text-yellow-500" /> 荣誉勋章馆 ({unlockedBadges.length} / {BADGES.length})
            </h2>
            
            <div className="space-y-8">
                {['level', 'total', 'streak', 'operator', 'boss'].map(cat => {
                    const catBadges = BADGES.filter(b => b.category === cat);
                    const catUnlocked = catBadges.filter(b => stats.badges.includes(b.id));
                    const catTitle = {
                        level: '等级成长',
                        total: '勤奋刷题',
                        streak: '连对挑战',
                        operator: '运算大师',
                        boss: 'BOSS 猎人'
                    }[cat];

                    return (
                        <div key={cat}>
                            <h3 className="font-bold text-gray-400 text-sm mb-3 flex justify-between">
                                {catTitle}
                                <span>{catUnlocked.length} / {catBadges.length}</span>
                            </h3>
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {catBadges.map((badge) => {
                                    const isUnlocked = stats.badges.includes(badge.id);
                                    return (
                                        <div 
                                            key={badge.id} 
                                            className={`group relative flex flex-col items-center p-2 rounded-xl text-center transition-all duration-300 ${isUnlocked ? 'bg-yellow-50 scale-100 opacity-100 cursor-pointer hover:bg-yellow-100' : 'bg-gray-50 opacity-40 grayscale scale-95'}`}
                                            title={badge.description}
                                        >
                                            <div className="text-2xl mb-1 filter drop-shadow-sm transform transition-transform group-hover:scale-125">
                                                {badge.icon}
                                            </div>
                                            {isUnlocked && (
                                                <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                            )}
                                            
                                            {/* Tooltip on Hover */}
                                            <div className="absolute z-10 bottom-full mb-2 left-1/2 -translate-x-1/2 w-32 bg-gray-800 text-white text-xs p-2 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                                                <div className="font-bold mb-1">{badge.name}</div>
                                                {badge.description}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      )}

      {/* Stats Tab Content */}
      {activeTab === 'stats' && (
          <div className="space-y-6 animate-pop">
              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Accuracy Radar */}
                  <div className="bg-white p-6 rounded-3xl shadow-lg">
                      <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                          <Zap className="text-yellow-500" /> 能力雷达 (正确率)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" tick={{fontSize: 12, fontWeight: 'bold'}} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                <Radar name="正确率" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>

                  {/* Speed Bar Chart */}
                  <div className="bg-white p-6 rounded-3xl shadow-lg">
                      <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                          <Clock className="text-blue-500" /> 平均答题速度 (秒)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={speedData} layout="vertical">
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={40} tick={{fontSize: 12, fontWeight: 'bold'}} />
                                <Tooltip />
                                <Bar dataKey="time" fill="#60A5FA" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                      </div>
                  </div>
              </div>

              {/* Detail Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[Operator.ADD, Operator.SUBTRACT, Operator.MULTIPLY, Operator.DIVIDE].map(op => {
                      const s = stats.operatorStats?.[op] || { attempts: 0, correct: 0, totalTimeMs: 0 };
                      const acc = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0;
                      const avgTime = s.attempts > 0 ? (s.totalTimeMs / s.attempts / 1000).toFixed(1) : '-';
                      const label = { [Operator.ADD]: '加法', [Operator.SUBTRACT]: '减法', [Operator.MULTIPLY]: '乘法', [Operator.DIVIDE]: '除法' }[op];
                      
                      return (
                          <div key={op} className="bg-white p-4 rounded-2xl shadow-md border border-gray-100 flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                  <span className="font-bold text-gray-600">{label}</span>
                                  <span className="text-2xl font-cartoon text-blue-500">{op}</span>
                              </div>
                              <div className="flex justify-between items-end mt-2">
                                  <div>
                                      <div className="text-xs text-gray-400">正确率</div>
                                      <div className={`text-xl font-bold ${acc >= 90 ? 'text-green-500' : acc >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>{acc}%</div>
                                  </div>
                                  <div className="text-right">
                                      <div className="text-xs text-gray-400">平均用时</div>
                                      <div className="text-lg font-bold text-gray-700">{avgTime}s</div>
                                  </div>
                              </div>
                              <div className="text-xs text-gray-400 mt-1 pt-2 border-t text-center">
                                  已练习 {s.attempts} 题
                              </div>
                          </div>
                      );
                  })}
              </div>
          </div>
      )}

    </div>
  );
};

export default Dashboard;