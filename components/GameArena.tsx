import React, { useState, useEffect, useRef } from 'react';
import { Question, Operator } from '../types';
import { ArrowRight, CheckCircle, XCircle, Sword, Mic, MicOff, AlertTriangle, Volume2, Shield } from 'lucide-react';
import { generateSpeech } from '../services/geminiService';

interface Props {
  question: Question;
  streak: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  onAnswer: (correct: boolean, userAnswer: number, timeTakenMs: number) => void;
  onExit: () => void;
  encouragement: string | null;
  isReviewMode?: boolean; 
}

const GameArena: React.FC<Props> = ({ 
  question, 
  streak, 
  currentQuestionIndex,
  totalQuestions,
  onAnswer, 
  onExit, 
  encouragement,
  isReviewMode = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showBossIntro, setShowBossIntro] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const correctAudioBufferRef = useRef<AudioBuffer | null>(null);
  
  // Timing refs
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    inputRef.current?.focus();
    setInputValue('');
    setStatus('idle');
    setFeedbackMsg('');
    startTimeRef.current = Date.now(); // Reset timer on new question
    
    // Boss Intro Logic
    if (question.isBoss) {
        setShowBossIntro(true);
        // Play AI Voice
        handleBossVoiceOver();
        
        // Hide visual overlay after animation
        const timer = setTimeout(() => {
            setShowBossIntro(false);
            inputRef.current?.focus();
        }, 2500);
        return () => clearTimeout(timer);
    } else {
        setShowBossIntro(false);
    }
  }, [question.id]);

  // Cleanup recognition and audio on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioContextRef.current) {
          audioContextRef.current.close();
      }
    };
  }, []);

  const getAudioContext = () => {
      if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      }
      return audioContextRef.current;
  };

  const playBuffer = async (buffer: AudioBuffer) => {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
          await ctx.resume();
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
  };

  const playFeedbackVoice = async (text: string, isCorrect: boolean) => {
      try {
          // Cache logic for "Correct" message to save API calls and latency
          if (isCorrect && correctAudioBufferRef.current) {
              playBuffer(correctAudioBufferRef.current);
              return;
          }

          const buffer = await generateSpeech(text);
          if (buffer) {
              if (isCorrect) {
                  correctAudioBufferRef.current = buffer;
              }
              playBuffer(buffer);
          }
      } catch (e) {
          console.error("Feedback voice error", e);
      }
  };

  const handleBossVoiceOver = async () => {
      if (!question.bossText) return;
      
      try {
          setIsPlayingAudio(true);
          const buffer = await generateSpeech("警报！遭遇首领挑战！" + question.bossText);
          
          if (buffer) {
              const ctx = getAudioContext();
              if (ctx.state === 'suspended') await ctx.resume();
              
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.onended = () => setIsPlayingAudio(false);
              source.start();
          } else {
              setIsPlayingAudio(false);
          }
      } catch (e) {
          console.error("Audio playback failed", e);
          setIsPlayingAudio(false);
      }
  };

  const handleSubmit = (e?: React.FormEvent, overrideValue?: string) => {
    e?.preventDefault();
    if (status !== 'idle') return; // Prevent double submission

    const valToSubmit = overrideValue !== undefined ? overrideValue : inputValue;
    
    if (!valToSubmit) return;

    const timeTaken = Date.now() - startTimeRef.current;
    const numVal = parseInt(valToSubmit, 10);
    const isCorrect = numVal === question.answer;

    if (isCorrect) {
      setStatus('correct');
      const msg = '太棒了！';
      setFeedbackMsg(msg);
      playFeedbackVoice(msg, true);
      setTimeout(() => {
        onAnswer(true, numVal, timeTaken);
      }, 800);
    } else {
      setStatus('wrong');
      const msg = `正确答案是 ${question.answer}`;
      setFeedbackMsg(msg);
      playFeedbackVoice(msg, false);
      setTimeout(() => {
        onAnswer(false, numVal, timeTaken);
      }, 2500); // Give more time to read boss answer
    }
  };

  const toggleVoiceControl = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音控制');
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      console.log('Voice Input:', transcript);

      // 1. Extract Numbers
      // Look for digits first
      const digitMatch = transcript.match(/\d+/);
      let detectedNumber = digitMatch ? digitMatch[0] : null;

      // 2. Handle Commands
      const isSubmit = transcript.includes('提交') || transcript.includes('确定') || transcript.includes('下一题') || transcript.includes('对');
      const isExit = transcript.includes('退出') || transcript.includes('不玩了');
      const isClear = transcript.includes('清除') || transcript.includes('重来');

      if (isExit) {
        onExit();
        return;
      }

      if (isClear) {
        setInputValue('');
        return;
      }

      if (detectedNumber) {
        setInputValue(detectedNumber);
        // If said number AND submit command (or just "25" might imply submit if we want aggressive auto-submit, but explicit command is safer)
        // Let's allow "25 Submit" flow
        if (isSubmit) {
           handleSubmit(undefined, detectedNumber);
        }
      } else if (isSubmit && inputValue) {
        // Said "Submit" without a number, but input has value
        handleSubmit();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const getOperatorDisplay = (op: Operator) => {
    switch(op) {
      case Operator.MULTIPLY: return '×';
      case Operator.DIVIDE: return '÷';
      default: return op;
    }
  };

  const isBoss = question.isBoss;

  return (
    <div className={`flex flex-col items-center justify-start min-h-[70vh] w-full max-w-2xl mx-auto p-4 pt-8 relative overflow-hidden ${showBossIntro ? 'animate-shake' : ''}`}>
      
      {/* Boss Intro Overlay */}
      {showBossIntro && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/90 backdrop-blur-sm rounded-3xl animate-pop overflow-hidden">
           {/* Flash Effect inside Overlay */}
           <div className="absolute inset-0 bg-white opacity-20 animate-ping"></div>
           
           <div className="text-center text-white relative z-10">
              <AlertTriangle size={80} className="mx-auto mb-4 text-yellow-400 animate-bounce" />
              <h2 className="text-4xl font-bold font-cartoon mb-2 tracking-wider">BOSS 降临</h2>
              <p className="text-red-200 animate-pulse text-xl">请听题...</p>
           </div>
        </div>
      )}

      {/* Top Bar with Progress */}
      <div className="w-full mb-6">
        <div className="flex justify-between items-center mb-2">
          <button onClick={onExit} className="text-gray-400 font-bold hover:text-red-500 transition text-sm">
            退出
          </button>
          <div className="flex items-center gap-2 font-bold text-sm text-gray-500">
             {isReviewMode && <Shield size={16} className="text-purple-500" />}
             {isReviewMode ? "错题特训中" : `关卡进度 ${currentQuestionIndex + 1}/${totalQuestions}`}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-orange-500 font-bold text-lg">🔥 {streak}</span>
          </div>
        </div>
        <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ease-out ${isReviewMode ? 'bg-purple-500' : 'bg-blue-500'}`}
            style={{ width: `${((currentQuestionIndex) / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Encouragement Banner */}
      {encouragement && status === 'idle' && !isBoss && (
        <div className="mb-4 animate-pop bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold shadow-sm border border-yellow-200">
          💡 AI 老师: {encouragement}
        </div>
      )}

      {/* Boss Header */}
      {isBoss && (
        <div className="mb-4 animate-bounce-small bg-red-100 text-red-800 px-6 py-2 rounded-full font-cartoon text-xl font-bold shadow-sm border-2 border-red-300 flex items-center gap-2">
          <Sword size={24} /> BOSS 挑战关卡
          {isPlayingAudio && <Volume2 size={20} className="animate-pulse text-red-600" />}
        </div>
      )}

      {/* Question Card */}
      <div className={`relative bg-white w-full rounded-3xl shadow-2xl p-4 md:p-10 flex flex-col items-center border-b-8 transition-colors duration-300 ${
          status === 'correct' ? 'border-green-500 bg-green-50' : 
          status === 'wrong' ? 'border-red-500 bg-red-50' : 
          isBoss ? 'border-red-500 shadow-red-200 ring-4 ring-red-100 ring-opacity-50' : 
          isReviewMode ? 'border-purple-500 shadow-purple-200' : // Purple for review mode
          'border-blue-500'
      }`}>
        
        {/* Render Logic: Boss Text vs Standard Equation */}
        {isBoss ? (
            <div className={`mb-8 text-center transition-opacity duration-1000 ${showBossIntro ? 'opacity-0' : 'opacity-100'}`}>
                <p className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed font-cartoon">
                    {question.bossText}
                </p>
                <div className="mt-4 text-sm text-gray-500">
                    请在下方输入最终答案（数字）
                </div>
            </div>
        ) : (
            <div className="flex items-center gap-4 text-5xl md:text-7xl font-bold text-gray-800 mb-8 font-cartoon">
            <span className="w-24 text-center">{question.num1}</span>
            <span className={`text-${isReviewMode ? 'purple' : 'blue'}-500`}>{getOperatorDisplay(question.operator)}</span>
            <span className="w-24 text-center">{question.num2}</span>
            <span>=</span>
            <div className="w-32 h-20 bg-gray-100 rounded-xl border-4 border-gray-300 flex items-center justify-center text-gray-800 overflow-hidden relative">
                {status === 'idle' ? (
                    <span className="animate-pulse text-gray-300">?</span>
                ) : (
                    <span className={status === 'correct' ? 'text-green-600' : 'text-red-600'}>{inputValue}</span>
                )}
            </div>
            </div>
        )}

        {/* Input Area */}
        {status === 'idle' && !showBossIntro && (
          <form onSubmit={(e) => handleSubmit(e)} className="w-full max-w-sm flex gap-2 animate-pop">
             <input 
              ref={inputRef}
              type="number" 
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={`flex-1 min-w-0 bg-gray-50 border-2 rounded-xl px-4 py-3 text-3xl text-center font-bold focus:outline-none focus:ring-4 transition-all ${
                  isBoss ? 'border-red-200 focus:border-red-500 focus:ring-red-100' : 
                  isReviewMode ? 'border-purple-200 focus:border-purple-500 focus:ring-purple-100' :
                  'border-gray-200 focus:border-blue-500 focus:ring-blue-100'
              }`}
              placeholder="?"
              autoFocus
             />
             <button 
                type="button"
                onClick={toggleVoiceControl}
                className={`flex-shrink-0 rounded-xl px-4 transition-all border-b-4 active:border-b-0 active:translate-y-1 ${isListening ? 'bg-red-500 border-red-700 text-white animate-pulse' : 'bg-gray-200 border-gray-300 text-gray-500 hover:bg-gray-300'}`}
                title={isListening ? "停止语音" : "开启语音控制: 说出答案并说'提交'"}
             >
                {isListening ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             <button 
              type="submit"
              disabled={!inputValue}
              className={`flex-shrink-0 text-white rounded-xl px-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg border-b-4 active:border-b-0 active:translate-y-1 ${
                  isBoss ? 'bg-red-500 hover:bg-red-600 border-red-700' : 
                  isReviewMode ? 'bg-purple-500 hover:bg-purple-600 border-purple-700' :
                  'bg-blue-500 hover:bg-blue-600 border-blue-700'
              }`}
             >
               <ArrowRight size={32} />
             </button>
          </form>
        )}

        {/* Feedback Display */}
        {status !== 'idle' && (
          <div className={`flex flex-col items-center animate-pop`}>
            {status === 'correct' ? (
                <CheckCircle className="text-green-500 mb-2 w-16 h-16" />
            ) : (
                <XCircle className="text-red-500 mb-2 w-16 h-16" />
            )}
            <p className={`text-2xl font-bold ${status === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
                {feedbackMsg}
            </p>
          </div>
        )}

      </div>
      
      <div className="mt-8 text-gray-400 text-sm flex flex-col items-center gap-1">
         <span>按回车键提交答案</span>
         {isListening && <span className="text-red-400 font-bold animate-pulse">🎤 正在听... (试着说: "25 提交")</span>}
      </div>
    </div>
  );
};

export default GameArena;