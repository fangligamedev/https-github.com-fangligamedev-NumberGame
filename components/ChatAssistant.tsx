import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Mic, Send, X, Volume2, Loader2, Minimize2, StopCircle } from 'lucide-react';
import { chatWithTutor, generateSpeech } from '../services/geminiService';
import { ChatMessage } from '../types';

const ChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'init', role: 'model', text: '你好呀！我是你的数学小助手。遇到不会的题可以问我，或者我们可以聊聊数学的乐趣！👋' }
  ]);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Audio State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
        stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current = null;
    }
    setPlayingId(null);
  };

  const playMessageAudio = async (text: string, msgId: string) => {
    // If clicking the same message that is playing, stop it.
    if (playingId === msgId) {
        stopAudio();
        return;
    }

    // Stop any current audio
    stopAudio();

    setAudioLoadingId(msgId);
    
    // Init Audio Context if needed
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    
    // Resume context if suspended (browser requirement)
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }

    const audioBuffer = await generateSpeech(text);
    setAudioLoadingId(null);

    if (audioBuffer && audioContextRef.current) {
        setPlayingId(msgId);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
            setPlayingId(null);
            sourceNodeRef.current = null;
        };
        source.start();
        sourceNodeRef.current = source;
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const aiResponseText = await chatWithTutor(messages, input);
    
    const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: aiResponseText };
    setMessages(prev => [...prev, aiMsg]);
    setLoading(false);
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("您的浏览器不支持语音输入，请使用 Chrome。");
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        setIsListening(true);
        stopAudio(); // Stop TTS if user starts speaking
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
        console.error(event.error);
        setIsListening(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 z-50 animate-bounce-small"
      >
        <MessageCircle size={32} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-blue-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 p-1 rounded-full">
            <Volume2 size={18} />
          </div>
          <span className="font-bold font-cartoon">AI 导师</span>
        </div>
        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded transition">
          <Minimize2 size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed shadow-sm relative group ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white rounded-br-none' 
                : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
            }`}>
              {msg.text}
              
              {/* TTS Button for Model Messages */}
              {msg.role === 'model' && (
                  <button 
                    onClick={() => playMessageAudio(msg.text, msg.id)}
                    disabled={audioLoadingId === msg.id}
                    className={`absolute -right-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${
                        playingId === msg.id 
                            ? 'bg-red-100 text-red-500 opacity-100' 
                            : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {audioLoadingId === msg.id ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : playingId === msg.id ? (
                        <StopCircle size={14} />
                    ) : (
                        <Volume2 size={14} />
                    )}
                  </button>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-500 p-3 rounded-2xl rounded-bl-none flex items-center gap-2 text-xs">
              <Loader2 className="animate-spin" size={14} /> 思考中...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
        <button 
          onClick={startListening}
          className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          title="语音输入"
        >
          <Mic size={20} />
        </button>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="问问老师..."
          className="flex-1 bg-gray-100 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <button 
          onClick={handleSend} 
          disabled={!input.trim() || loading}
          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 transition"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatAssistant;