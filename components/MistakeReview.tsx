import React, { useState } from 'react';
import { MistakeRecord } from '../types';
import { analyzeMistakes } from '../services/geminiService';
import { Brain, ArrowLeft, Loader2, Clock, CheckCircle2, Target, Sword } from 'lucide-react';

interface Props {
  mistakes: MistakeRecord[];
  onBack: () => void;
  onStartPractice: () => void;
}

const MistakeReview: React.FC<Props> = ({ mistakes, onBack, onStartPractice }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGetAnalysis = async () => {
    setLoading(true);
    const result = await analyzeMistakes(mistakes);
    setAnalysis(result);
    setLoading(false);
  };

  // Sort: Due items first, then by urgency (timestamp)
  const now = Date.now();
  const sortedMistakes = [...mistakes].sort((a, b) => {
    // Priority 1: Overdue items
    const aDue = a.nextReviewTime <= now;
    const bDue = b.nextReviewTime <= now;
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;
    
    // Priority 2: Next review time ascending
    return a.nextReviewTime - b.nextReviewTime;
  });

  const dueCount = mistakes.filter(m => m.nextReviewTime <= now).length;

  const getRelativeTime = (time: number) => {
    const diff = time - now;
    if (diff <= 0) return "现在";
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `${mins}分钟后`;
    const hours = Math.ceil(mins / 60);
    if (hours < 24) return `${hours}小时后`;
    const days = Math.ceil(hours / 24);
    return `${days}天后`;
  };

  const renderProficiency = (prof: number) => {
    const dots = [];
    for (let i = 0; i < 5; i++) {
      dots.push(
        <div 
          key={i} 
          className={`w-2 h-2 rounded-full ${i < prof ? 'bg-green-500' : 'bg-gray-200'}`}
        />
      );
    }
    return <div className="flex gap-1">{dots}</div>;
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 bg-white rounded-full shadow hover:bg-gray-50 transition">
          <ArrowLeft />
        </button>
        <h1 className="text-2xl font-bold text-gray-800 font-cartoon">错题本 & AI 诊断</h1>
      </div>

      {/* Top Action Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Stats & Practice */}
          <div className="bg-white rounded-3xl p-6 shadow-lg border border-purple-100 flex flex-col justify-between">
              <div>
                  <h2 className="text-lg font-bold text-gray-600 flex items-center gap-2 mb-2">
                      <Target className="text-purple-500" /> 错题消灭计划
                  </h2>
                  <div className="flex items-end gap-2 mb-1">
                      <span className="text-4xl font-bold text-gray-800">{mistakes.length}</span>
                      <span className="text-sm text-gray-500 mb-1">总错题</span>
                  </div>
                  <div className="text-sm text-red-500 font-bold">
                      {dueCount} 道题目需要立即复习
                  </div>
              </div>
              
              <button 
                onClick={onStartPractice}
                disabled={mistakes.length === 0}
                className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                 <Sword size={20} />
                 {mistakes.length === 0 ? "恭喜！暂无错题" : "开始错题特训"}
              </button>
          </div>

          {/* AI Analysis */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-6 shadow-xl text-white relative overflow-hidden">
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                    <Brain className="text-purple-200" />
                    <h2 className="text-lg font-bold">AI 老师诊断</h2>
                </div>
                {analysis ? (
                  <div className="bg-white/10 p-4 rounded-xl text-sm leading-relaxed animate-pop border border-white/20 h-32 overflow-y-auto custom-scrollbar">
                    {analysis}
                  </div>
                ) : (
                  <div className="h-32 flex flex-col justify-center items-center text-center">
                    <p className="text-purple-100 text-sm mb-4">
                        让 AI 老师分析你的薄弱点，提供专属建议！
                    </p>
                    <button 
                        onClick={handleGetAnalysis}
                        disabled={loading || mistakes.length === 0}
                        className="bg-white text-purple-600 px-4 py-2 rounded-full text-sm font-bold shadow-md hover:scale-105 transition-transform disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : '一键诊断'}
                    </button>
                  </div>
                )}
             </div>
             {/* Decorative Background */}
             <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          </div>
      </div>

      {/* Mistake List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedMistakes.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-gray-400 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <div className="text-6xl mb-4 grayscale opacity-50">🏆</div>
            <p className="font-bold text-lg">太棒了！你的错题本是空的！</p>
            <p className="text-sm">去冒险地图挑战新关卡吧</p>
          </div>
        ) : (
            sortedMistakes.map((record, idx) => {
                const isDue = record.nextReviewTime <= now;
                return (
                  <div key={idx} className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${isDue ? 'border-l-8 border-l-red-500 border-gray-100 shadow-md' : 'border-gray-100 opacity-80'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="text-xl font-bold text-gray-800 font-mono">
                            {record.question.num1} {record.question.operator} {record.question.num2} = ?
                        </div>
                        {renderProficiency(record.proficiency || 0)}
                      </div>
                      
                      <div className="flex justify-between items-end mt-2">
                          <div className="text-sm text-gray-500">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">上次答案: <span className="line-through text-red-400">{record.userAnswer}</span></span>
                                <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded">正解: {record.question.answer}</span>
                              </div>
                          </div>
                          
                          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${isDue ? 'bg-red-100 text-red-600' : 'bg-blue-50 text-blue-500'}`}>
                             {isDue ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                             {getRelativeTime(record.nextReviewTime)}
                          </div>
                      </div>
                  </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default MistakeReview;