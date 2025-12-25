import React, { useEffect, useState } from 'react';
import { Star, RefreshCw, ArrowRight, Brain } from 'lucide-react';
import { analyzeStage } from '../services/geminiService';
import { Question } from '../types';

interface Props {
  questions: Question[];
  userAnswers: {qId: string, correct: boolean, val: number}[];
  onNext: () => void;
  onRetry: () => void;
}

const StageSummary: React.FC<Props> = ({ questions, userAnswers, onNext, onRetry }) => {
  const [aiFeedback, setAiFeedback] = useState<string>('正在生成老师的点评...');
  
  const correctCount = userAnswers.filter(a => a.correct).length;
  const total = questions.length;
  const percentage = correctCount / total;
  
  let stars = 1;
  if (percentage >= 0.9) stars = 3;
  else if (percentage >= 0.6) stars = 2;

  useEffect(() => {
    analyzeStage(questions, userAnswers).then(setAiFeedback);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto p-4 animate-pop">
      <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center text-white">
          <h2 className="text-3xl font-cartoon mb-4">关卡挑战完成!</h2>
          <div className="flex justify-center gap-4 mb-4">
            {[1, 2, 3].map(i => (
              <Star 
                key={i} 
                size={48} 
                className={`transition-all duration-700 ${i <= stars ? 'fill-yellow-400 text-yellow-400 animate-bounce-small' : 'text-blue-800 fill-blue-800/50'}`}
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
          <p className="text-blue-200 font-bold text-xl">{correctCount} / {total} 正确</p>
        </div>

        <div className="p-8">
          {/* AI Analysis */}
          <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-6 mb-8 relative">
            <div className="absolute -top-4 left-6 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
              <Brain size={12} /> AI 老师点评
            </div>
            <p className="text-gray-700 leading-relaxed mt-2 font-medium">
              {aiFeedback}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={onRetry}
              className="flex items-center justify-center gap-2 py-4 rounded-xl bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 transition"
            >
              <RefreshCw size={20} /> 再练一次
            </button>
            <button 
              onClick={onNext}
              className="flex items-center justify-center gap-2 py-4 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 shadow-lg border-b-4 border-green-700 active:border-b-0 active:translate-y-1 transition-all"
            >
              继续冒险 <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StageSummary;