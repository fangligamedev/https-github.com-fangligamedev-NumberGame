import React, { useState, useEffect, useRef } from 'react';
import { Question, Operator } from '../types';
import { ArrowRight, CheckCircle, XCircle, Sword, Mic, MicOff, AlertTriangle, Volume2, Shield } from 'lucide-react';
import { generateSpeech, getZoneBackground } from '../services/geminiService';

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
  const [bgImage, setBgImage] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref to keep track of input value inside closure-bound event handlers
  const inputValueRef = useRef(''); 
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const correctAudioBufferRef = useRef<AudioBuffer | null>(null);
  
  // Timing refs
  const startTimeRef = useRef(Date.now());

  // Update ref when state changes
  useEffect(() => {
      inputValueRef.current = inputValue;
  }, [inputValue]);

  // Load Background
  useEffect(() => {
     const loadBg = async () => {
         const img = await getZoneBackground(1); 
         if (img) setBgImage(img);
     };
     loadBg();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    setInputValue('');
    setStatus('idle');
    setFeedbackMsg('');
    startTimeRef.current = Date.now(); // Reset timer on new question
    
    // Boss Intro Logic
    if (question.isBoss) {
        setShowBossIntro(true);
        handleBossVoiceOver();
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
          setIsPlayingAudio(false);
      }
  };

  const handleSubmit = (e?: React.FormEvent, overrideValue?: string) => {
    e?.preventDefault();
    if (status !== 'idle') return; 

    const valToSubmit = overrideValue !== undefined ? overrideValue : inputValueRef.current; // Use ref for latest value
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
      }, 1000); // Slightly increased delay so user can see the green check
    } else {
      setStatus('wrong');
      const msg = `正确答案是 ${question.answer}`;
      setFeedbackMsg(msg);
      playFeedbackVoice(msg, false);
      setTimeout(() => {
        onAnswer(false, numVal, timeTaken);
      }, 2500); 
    }
  };

  const toggleVoiceControl = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音控制，请使用 Chrome。');
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = true;
    recognition.interimResults = true; // Enable interim results for responsiveness

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
      }
      
      console.log('Voice Input:', transcript);

      // 1. Extract Numbers
      // Look for digits first
      const digitMatch = transcript.match(/\d+/);
      let detectedNumber = digitMatch ? digitMatch[0] : null;

      // 2. Handle Commands
      const isSubmit = transcript.includes('提交') || transcript.includes('确定') || transcript.includes('下一题') || transcript.includes('对') || transcript.includes('好');
      const isExit = transcript.includes('退出') || transcript.includes('不玩了');
      const isClear = transcript.includes('清除') || transcript.includes('重来');

      if (isExit) { onExit(); return; }
      if (isClear) { 
          setInputValue(''); 
          inputValueRef.current = '';
          return; 
      }

      if (detectedNumber) {
        setInputValue(detectedNumber);
        // We only auto-submit if there is an explicit submit command OR if the number matches the answer perfectly?
        // Let's stick to explicit command for safety, or user can press enter.
        if (isSubmit) {
           handleSubmit(undefined, detectedNumber);
        }
      } else if (isSubmit && inputValueRef.current) {
         // Using Ref to access the latest input value even if closure is stale
        handleSubmit(undefined, inputValueRef.current);
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
    <div className={`flex flex-col items-center justify-start min-h-[70vh] w-full max-w-2xl mx-auto pt-8 relative overflow-hidden transition-all duration-500 rounded-3xl ${showBossIntro ? 'animate-shake' : ''}`}>
      
      {/* Background Layer */}
      {bgImage && (
          <div className="absolute inset-0 z-0">
              <img src={bgImage} className="w-full h-full object-cover opacity-60 blur-sm" alt="game bg" />
              <div className="absolute inset-0 bg-white/40"></div>
          </div>
      )}

      {/* Boss Intro Overlay - Keep only the Boss Intro full screen */}
      {showBossIntro && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/95 backdrop-blur-sm rounded-3xl animate-pop overflow-hidden">
           <div className="absolute inset-0 bg-white opacity-20 animate-ping"></div>
           <div className="text-center text-white relative z-10">
              <AlertTriangle size={80} className="mx-auto mb-4 text-yellow-400 animate-bounce" />
              <h2 className="text-5xl font-bold font-cartoon mb-4 tracking-wider text-yellow-300 drop-shadow-lg">BOSS 降临</h2>
              <p className="text-red-200 animate-pulse text-2xl">全神贯注...</p>
           </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="w-full mb-6 relative z-10 px-4">
        <div className="flex justify-between items-center mb-2">
          <button onClick={onExit} className="bg-white/50 hover:bg-white text-gray-700 font-bold px-3 py-1 rounded-full transition text-sm backdrop-blur-sm">
            ❌ 退出
          </button>
          <div className="flex items-center gap-2 font-bold text-sm text-gray-700 bg-white/50 px-3 py-1 rounded-full backdrop-blur-sm">
             {isReviewMode && <Shield size={16} className="text-purple-500" />}
             {isReviewMode ? "错题特训中" : `关卡进度 ${currentQuestionIndex + 1}/${totalQuestions}`}
          </div>
          <div className="flex items-center gap-1 bg-white/80 px-3 py-1 rounded-full shadow-sm">
            <span className="text-orange-500 font-bold text-lg">🔥 {streak}</span>
          </div>
        </div>
        <div className="w-full bg-gray-200/50 h-3 rounded-full overflow-hidden backdrop-blur-sm border border-white/50">
          <div 
            className={`h-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)] ${isReviewMode ? 'bg-purple-500' : 'bg-blue-500'}`}
            style={{ width: `${((currentQuestionIndex) / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Encouragement (Only when idle) */}
      {encouragement && status === 'idle' && !isBoss && (
        <div className="mb-4 animate-pop bg-yellow-100/90 text-yellow-800 px-6 py-2 rounded-full text-sm font-bold shadow-lg border-2 border-white relative z-10">
          💡 AI 老师: {encouragement}
        </div>
      )}

      {/* Boss Header */}
      {isBoss && (
        <div className="mb-4 animate-bounce-small bg-red-600 text-white px-8 py-3 rounded-full font-cartoon text-xl font-bold shadow-lg border-4 border-red-400 flex items-center gap-2 relative z-10">
          <Sword size={24} /> BOSS 挑战关卡
          {isPlayingAudio && <Volume2 size={20} className="animate-pulse text-red-200" />}
        </div>
      )}

      {/* Main Card */}
      <div className={`relative w-full rounded-3xl shadow-2xl p-4 md:p-10 flex flex-col items-center border-b-8 transition-all duration-300 z-10 backdrop-blur-xl ${
          isBoss ? 'bg-red-50/90 border-red-500' : 
          isReviewMode ? 'bg-purple-50/90 border-purple-500' : 
          'bg-white/90 border-blue-500'
      }`}>
        
        {isBoss ? (
            <div className={`mb-8 text-center transition-opacity duration-1000 ${showBossIntro ? 'opacity-0' : 'opacity-100'}`}>
                <p className="text-xl md:text-2xl font-bold text-gray-800 leading-relaxed font-cartoon drop-shadow-sm">
                    {question.bossText}
                </p>
            </div>
        ) : (
            <div className="flex items-center gap-4 text-5xl md:text-7xl font-bold text-gray-800 mb-8 font-cartoon drop-shadow-sm flex-wrap justify-center">
                <span className="w-24 text-center">{question.num1}</span>
                <span className={`text-${isReviewMode ? 'purple' : 'blue'}-500`}>{getOperatorDisplay(question.operator)}</span>
                <span className="w-24 text-center">{question.num2}</span>
                <span>=</span>
                <div className={`w-32 h-24 rounded-xl border-4 flex items-center justify-center text-gray-800 overflow-hidden relative shadow-inner transition-colors duration-300 ${
                    status === 'idle' 
                        ? 'bg-gray-100/50 border-gray-300' 
                        : status === 'correct' 
                            ? 'bg-green-100 border-green-500' 
                            : 'bg-red-100 border-red-500'
                }`}>
                    {status === 'idle' ? (
                        <span className="animate-pulse text-gray-400">?</span>
                    ) : (
                        <span className={`text-5xl ${status === 'correct' ? 'text-green-600' : 'text-red-600'}`}>{inputValue}</span>
                    )}
                </div>
            </div>
        )}

        {/* Input Area (Visible when IDLE) */}
        {status === 'idle' && !showBossIntro && (
          <form onSubmit={(e) => handleSubmit(e)} className="w-full max-w-sm flex gap-2 animate-pop">
             <input 
              ref={inputRef}
              type="number" 
              inputMode="numeric"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={`flex-1 min-w-0 bg-white/80 border-2 rounded-xl px-4 py-3 text-3xl text-center font-bold focus:outline-none focus:ring-4 transition-all shadow-inner ${
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
                className={`flex-shrink-0 rounded-xl px-4 transition-all border-b-4 active:border-b-0 active:translate-y-1 shadow-md ${isListening ? 'bg-red-500 border-red-700 text-white animate-pulse' : 'bg-gray-100 border-gray-300 text-gray-500 hover:bg-gray-200'}`}
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

        {/* Inline Feedback Display (Visible when NOT IDLE) */}
        {status !== 'idle' && (
             <div className={`mt-2 w-full max-w-sm flex flex-col items-center justify-center p-4 rounded-2xl animate-pop border-2 shadow-sm ${
                 status === 'correct' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
             }`}>
                <div className="flex items-center gap-3">
                    {status === 'correct' ? (
                        <CheckCircle className="text-green-500 w-8 h-8 animate-bounce-small" />
                    ) : (
                        <XCircle className="text-red-500 w-8 h-8 animate-shake" />
                    )}
                    <span className={`text-2xl font-bold font-cartoon ${status === 'correct' ? 'text-green-600' : 'text-red-600'}`}>
                        {feedbackMsg}
                    </span>
                </div>
             </div>
        )}
      </div>
      
      {/* Help text */}
      {status === 'idle' && (
        <div className="mt-8 text-gray-500 text-sm flex flex-col items-center gap-1 bg-white/60 px-4 py-2 rounded-full backdrop-blur-sm shadow-sm relative z-10">
            <span>按回车键提交答案</span>
            {isListening && <span className="text-red-500 font-bold animate-pulse">🎤 正在听... (试着说: "25 提交")</span>}
        </div>
      )}
    </div>
  );
};

export default GameArena;