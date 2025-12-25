import React, { useState, useEffect } from 'react';
import { generateGameImage } from '../services/geminiService';
import { Image, Loader2, Wand2, Key, Info } from 'lucide-react';

const ImageGenerator: React.FC = () => {
  const [hasKey, setHasKey] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkKey = async () => {
      try {
          // @ts-ignore
          if (window.aistudio && window.aistudio.hasSelectedApiKey) {
              // @ts-ignore
              const selected = await window.aistudio.hasSelectedApiKey();
              setHasKey(selected);
          }
      } catch (e) {
          console.error("Error checking key", e);
      }
  };

  useEffect(() => {
      checkKey();
  }, []);

  const handleConnect = async () => {
      try {
          // @ts-ignore
          if (window.aistudio && window.aistudio.openSelectKey) {
              // @ts-ignore
              await window.aistudio.openSelectKey();
              // Assume success after dialog interaction or check again
              await checkKey();
          }
      } catch (e) {
          console.error("Error selecting key", e);
          setError("连接失败，请重试");
      }
  };

  const handleGenerate = async () => {
      if (!prompt.trim()) return;
      
      setLoading(true);
      setError(null);
      setGeneratedImage(null);

      try {
          const result = await generateGameImage(prompt, size);
          if (result) {
              setGeneratedImage(result);
          } else {
              setError("生成失败，请尝试其他描述。");
          }
      } catch (e: any) {
          if (e.message && e.message.includes("Requested entity was not found")) {
              setError("API Key 无效，请重新连接。");
              setHasKey(false);
          } else {
              setError("生成出错，请稍后重试。");
          }
      } finally {
          setLoading(false);
      }
  };

  if (!hasKey) {
      return (
          <div className="bg-white rounded-3xl p-8 shadow-xl border border-blue-100 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="bg-blue-100 p-6 rounded-full mb-6 animate-bounce-small">
                  <Key size={48} className="text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2 font-cartoon">开启 AI 创意工坊</h2>
              <p className="text-gray-500 mb-8 max-w-md">
                  使用 Gemini Nano Banana Pro 生成超酷的游戏素材！<br/>需要连接您的 Google Cloud 项目才能使用此高级功能。
              </p>
              <button 
                  onClick={handleConnect}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
              >
                  <Key size={20} /> 连接我的 API Key
              </button>
              <div className="mt-6 text-xs text-gray-400">
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-blue-500 flex items-center gap-1">
                      <Info size={12} /> 查看计费说明
                  </a>
              </div>
          </div>
      );
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2 font-cartoon">
            <Wand2 className="text-purple-500" /> 创意工坊 (Image Gen)
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        描述你想要的画面
                    </label>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="例如：一个充满数学符号的魔法森林，有一只聪明的狮子戴着眼镜..."
                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl p-4 h-32 focus:border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-100 transition-all resize-none"
                    />
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">
                        清晰度 (Resolution)
                    </label>
                    <div className="flex gap-4">
                        {(['1K', '2K', '4K'] as const).map((s) => (
                            <button
                                key={s}
                                onClick={() => setSize(s)}
                                className={`flex-1 py-2 rounded-xl font-bold border-2 transition-all ${
                                    size === s 
                                    ? 'bg-purple-100 border-purple-500 text-purple-700' 
                                    : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleGenerate}
                    disabled={loading || !prompt}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                    {loading ? '正在绘制中...' : '开始生成'}
                </button>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
                        {error}
                        {error.includes("API Key") && (
                            <button onClick={handleConnect} className="ml-2 underline font-bold">重置 Key</button>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-gray-100 rounded-2xl flex items-center justify-center min-h-[300px] border-2 border-dashed border-gray-300 relative overflow-hidden group">
                {generatedImage ? (
                    <div className="relative w-full h-full">
                        <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a 
                                href={generatedImage} 
                                download={`math-quest-art-${Date.now()}.png`}
                                className="bg-white text-gray-800 font-bold py-2 px-6 rounded-full shadow-lg hover:scale-105 transition-transform"
                            >
                                下载图片
                            </a>
                        </div>
                    </div>
                ) : (
                    <div className="text-gray-400 text-center">
                        {loading ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <Loader2 size={48} className="animate-spin mb-4 text-purple-400" />
                                <p>AI 正在挥舞画笔...</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <Image size={48} className="mb-2 opacity-50" />
                                <p>预览区域</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default ImageGenerator;
