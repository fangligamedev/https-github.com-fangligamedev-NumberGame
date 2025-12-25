import { GoogleGenAI, Modality } from "@google/genai";
import { MistakeRecord, Question, ChatMessage, Operator } from "../types";

// Cache backgrounds to avoid regenerating every time we switch tabs
const backgroundCache: Record<number, string> = {};

// Helper: Determine if we should use direct fetch (for OpenAI-compatible Zeabur/Proxies) or Google SDK
const useOpenAIProtocol = () => {
    return process.env.GEMINI_API_KEY?.startsWith('sk-');
};

const initAI = () => {
  if (!process.env.API_KEY) {
    return null;
  }
  
  const options: any = { apiKey: process.env.API_KEY };
  if (process.env.GEMINI_API_BASE_URL) {
    options.baseUrl = process.env.GEMINI_API_BASE_URL;
  }
  
  return new GoogleGenAI(options);
};

// --- Raw Fetch Helper for OpenAI Protocol (Zeabur AI Hub) ---
async function fetchOpenAICompat(
    messages: { role: string; content: string }[], 
    systemInstruction?: string,
    model: string = "gemini-3-flash-preview"
): Promise<string | null> {
    if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_API_BASE_URL) return null;

    try {
        const payloadMessages = [];
        // Gemini 模型的 OpenAI 兼容接口通常对 'system' 角色比较挑剔
        // 我们将系统提示词合并到第一条人类消息中，以获得最高兼容性
        if (systemInstruction) {
            payloadMessages.push({ role: 'user', content: `[系统指令]: ${systemInstruction}\n\n[用户请求]: ${messages[0].content}` });
            payloadMessages.push(...messages.slice(1));
        } else {
            payloadMessages.push(...messages);
        }

        let baseUrl = process.env.GEMINI_API_BASE_URL;
        if (!baseUrl.endsWith('/')) baseUrl += '/';
        const url = `${baseUrl}chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`
            },
            body: JSON.stringify({
                model: model,
                messages: payloadMessages,
                temperature: 0.7,
                response_format: { type: "json_object" } // 强制要求 JSON 格式
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Zeabur/OpenAI Fetch Error:", response.status, errText);
            // 尝试备用模型名称 (带 google/ 前缀)
            if (response.status === 404 && !model.includes('/')) {
                return fetchOpenAICompat(messages, systemInstruction, `google/${model}`);
            }
            return null;
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        console.error("Fetch Error", e);
        return null;
    }
}

// --- Audio Decoding Helpers ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}
// -----------------------------

export const getEncouragement = async (streak: number, level: number): Promise<string> => {
  const prompt = `User is a 3rd grade student in China. Current streak: ${streak}, Level: ${level}. Give a very short, enthusiastic encouragement message in Chinese (Simplified). Max 15 words.`;
  
  if (useOpenAIProtocol()) {
      const text = await fetchOpenAICompat([{ role: 'user', content: prompt }]);
      return text || "你做得真棒！继续加油！";
  }

  const ai = initAI();
  if (!ai) return "你做得真棒！继续加油！";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text || "太棒了！继续挑战！";
  } catch (error) {
    return "太棒了！继续挑战！";
  }
};

export const analyzeMistakes = async (mistakes: MistakeRecord[]): Promise<string> => {
    if (mistakes.length === 0) return "没有错题，太完美了！";
  
    const recentMistakes = mistakes.slice(-5).map(m => 
      `${m.question.num1} ${m.question.operator} ${m.question.num2} = ? (User: ${m.userAnswer}, Correct: ${m.question.answer})`
    ).join("\n");
    const prompt = `Analyze mistakes:\n${recentMistakes}\nOutput: Short, encouraging advice in Chinese.`;
    const system = `Role: Math tutor for 3rd grader.`;

    if (useOpenAIProtocol()) {
        const text = await fetchOpenAICompat([{ role: 'user', content: prompt }], system);
        return text || "加油，下次注意看清题目哦！";
    }

    const ai = initAI();
    if (!ai) return "分析服务暂时不可用。";
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${system} ${prompt}`,
      });
      return response.text || "加油，下次注意看清题目哦！";
    } catch (error) {
      return "加油，下次注意看清题目哦！";
    }
};

export const chatWithTutor = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  const systemInstruction = `You are a friendly, patient, and fun math tutor for a Chinese 3rd-grade student named "小小探险家". 
  Your goal is to help them love math. 
  - Do NOT just give answers to math problems. Guide them to solve it step-by-step.
  - Use emojis. 
  - Keep responses concise (under 50 words) unless explaining a concept.
  - Encourage them to ask questions about "why" and "how".
  - If they say they are frustrated, comfort them.`;

  if (useOpenAIProtocol()) {
      // Map history to OpenAI format
      const messages = history.map(h => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text }));
      messages.push({ role: 'user', content: newMessage });
      
      const text = await fetchOpenAICompat(messages, systemInstruction);
      return text || "API未返回任何内容，请检查配置。";
  }

  const ai = initAI();
  if (!ai) return "我现在有点累，稍后再聊吧。";

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: { systemInstruction },
      history: history.map(h => ({ role: h.role, parts: [{ text: h.text }] }))
    });

    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "我没听清，能再说一遍吗？";
  } catch (error) {
    console.error("Chat Error", error);
    return "我好像掉线了，请检查网络。";
  }
};

export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  const ai = initAI(); // Image/Audio generation might still need Google SDK if Zeabur supports it via standard endpoint, 
                       // OR we need to skip if using OpenAI protocol if Zeabur doesn't support audio via OpenAI chat completions.
                       // Currently assuming Zeabur might not support Google-specific TTS via OpenAI endpoint easily.
                       // We will try Google SDK anyway for TTS as it uses a specific endpoint that might be proxied differently.
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      outputAudioContext,
      24000,
      1,
    );
    
    return audioBuffer;
  } catch (e) {
    console.error("TTS Error", e);
    return null;
  }
};

export const analyzeStage = async (questions: Question[], answers: {qId: string, correct: boolean, val: number}[]): Promise<string> => {
  const summary = questions.map(q => {
    const ans = answers.find(a => a.qId === q.id);
    return `Q: ${q.bossText ? q.bossText : `${q.num1}${q.operator}${q.num2}`} | Correct Answer: ${q.answer} | User Result: ${ans?.correct ? 'Correct' : `Wrong (answered ${ans?.val})`}`;
  }).join('\n');

  const prompt = `Analyze this math game stage performance for a 3rd grader:
  ${summary}
  Provide a 2-sentence feedback in Chinese. 
  1. Praise what they did well.
  2. Point out one specific thing to improve (if any errors) or give a high-five.`;

  if (useOpenAIProtocol()) {
      const text = await fetchOpenAICompat([{ role: 'user', content: prompt }]);
      return text || "做得不错！继续挑战下一关吧！";
  }

  const ai = initAI();
  if (!ai) return "本关挑战结束！";

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
    });
    return response.text || "做得不错！继续挑战下一关吧！";
  } catch (e) {
      return "关卡完成！继续加油！";
  }
};

export const generateBossQuestion = async (level: number, operators: Operator[], stageNum: number): Promise<{text: string, answer: number} | null> => {
    const opString = operators.join(', ');
    
    // Determine Difficulty Context based on Stage (Shanghai 3rd Grade+ Standards)
    let difficultyContext = "";
    if (stageNum <= 10) {
        difficultyContext = "上海小学三年级水平。三位数加减法，或两位数乘一位数。有趣的数学故事。";
    } else if (stageNum <= 20) {
        difficultyContext = "三年级进阶。包含括号的混合运算，三位数加减混合，或简单的除法应用题。";
    } else if (stageNum <= 30) {
        difficultyContext = "三年级/四年级水平。两位数乘两位数，或三位数除以一位数。逻辑性较强的应用题。";
    } else if (stageNum <= 50) {
        difficultyContext = "中高年级水平。多步混合运算(四则运算综合)，数字在500以内。包含单位换算或简单的几何面积逻辑。";
    } else {
        difficultyContext = "高年级挑战。大数综合运算(1000以内)，复杂的多步逻辑推理，或者是数阵图/巧算类题目。";
    }

    const prompt = `你是一个小学数学老师。请生成一个有趣的Boss战数学应用题。
    关卡: ${stageNum}
    难度要求: ${difficultyContext}
    允许的运算符号: ${opString}.
    语言: 简体中文。
    主题: 奇幻冒险(巨龙、宝藏、魔法)或太空探索。
    
    输出格式必须是严格的 JSON 对象: {"question": "题目文本", "answer": 答案数字}
    例子: {"question": "恶龙抓走了公主！你需要3把钥匙才能打开笼子，每把钥匙需要25个魔法石。你现在有10个魔法石，还需要多少个？", "answer": 65}`;

    // --- 本地保底题库 (如果 AI 生成失败，则从这里随机选一个) ---
    const fallbackQuestions = [
        { text: "巨龙守护着金币！它左爪抓着 45 枚金币，右爪抓着 38 枚金币。巨龙一共抓着多少枚金币？", answer: 83 },
        { text: "小魔法师有 100 毫升魔药，配置一瓶隐身药水需要 15 毫升。他配置了 4 瓶后，还剩下多少毫升魔药？", answer: 40 },
        { text: "太空飞船有 3 个推进器，每个推进器每秒消耗 12 个能量块。如果推进器工作 5 秒，一共消耗多少个能量块？", answer: 180 },
        { text: "你有 64 颗魔法豆，要平均分给 8 个小精灵。每个小精灵能得到几颗？", answer: 8 },
        { text: "勇者在森林里发现了 5 棵苹果树，每棵树上结了 12 个红苹果和 8 个绿苹果。请问一共有多少个苹果？", answer: 100 }
    ];

    try {
        if (useOpenAIProtocol()) {
            const text = await fetchOpenAICompat([{ role: 'user', content: prompt }], undefined, "gemini-3-flash-preview");
            if(text) {
                 const jsonMatch = text.match(/\{[\s\S]*\}/);
                 if (jsonMatch) {
                     const result = JSON.parse(jsonMatch[0]);
                     return { text: result.question, answer: Number(result.answer) };
                 }
            }
        } else {
            const ai = initAI();
            if (ai) {
                const response = await ai.models.generateContent({
                    model: "gemini-3-flash-preview",
                    contents: prompt,
                    config: { responseMimeType: "application/json" }
                });
                const text = response.text;
                if(text) {
                     const result = JSON.parse(text);
                     return { text: result.question, answer: Number(result.answer) };
                }
            }
        }
    } catch (e) {
        console.error("AI Boss Gen Error, using fallback.", e);
    }

    // 最后的保底：如果所有 API 都失败了，随机返回一个本地题目
    return fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
};

// --- AUTOMATED BACKGROUND GENERATION ---
const ZONES = [
    "Lush Green Forest, bright sunlight, cute animals", // 1
    "Sunny Desert with pyramids and cactus, cartoon style", // 2
    "Magical Ice Kingdom, snow and crystals", // 3
    "Active Volcano area with safe paths, cartoon style", // 4
    "Mysterious Purple Magic City, floating islands", // 5
    "Underwater Ocean World, colorful coral and fish", // 6
    "Crystal Cave with glowing gems", // 7
    "Sky Kingdom, clouds and rainbows", // 8
    "Candy Land, sweets and chocolates", // 9
    "Deep Space with planets and rocket ships" // 10
];

export const getZoneBackground = async (zoneIndex: number, forceRefresh: boolean = false): Promise<string | null> => {
    // zoneIndex is 1-based (1 to 10 usually)
    const cacheKey = zoneIndex;
    if (!forceRefresh && backgroundCache[cacheKey]) {
        return backgroundCache[cacheKey];
    }

    // Zeabur OpenAI proxy likely does NOT support Image Generation via /v1/images/generations compatible with Gemini 2.5 Flash Image params
    // We will stick to Google SDK for images if possible, or skip if key is SK-based and proxy is strictly chat
    // However, user asked for Gemini 3 Flash Preview mainly. 
    // Image gen might fail if using SK key with Google SDK. 
    // We will try Google SDK anyway as it's the best bet for "gemini-2.5-flash-image".
    
    const ai = initAI(); 
    if (!ai) return null;

    const theme = ZONES[(zoneIndex - 1) % ZONES.length];
    
    const prompt = `Vector art style game background of ${theme}. 
    Aesthetic: Clean flat vector illustration, vibrant colors, geometric shapes, minimal shading. 
    Suitable for a children's math educational game map. No text. Aspect Ratio 1:1.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Matching Zeabur AI Hub model code
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: "1K"
                },
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                backgroundCache[cacheKey] = base64; // Cache it
                return base64;
            }
        }
        return null;
    } catch (e) {
        console.error("Background Gen Error", e);
        return null;
    }
};

export const generateGameImage = async (prompt: string, size: '1K' | '2K' | '4K'): Promise<string | null> => {
    const ai = initAI();
    if (!ai) return null;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Matching Zeabur AI Hub model code
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "1:1",
                    imageSize: size
                },
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                const base64EncodeString: string = part.inlineData.data;
                const imageUrl = `data:${part.inlineData.mimeType};base64,${base64EncodeString}`;
                return imageUrl;
            }
        }
        return null;
    } catch (e) {
        console.error("Image Gen Error", e);
        throw e;
    }
};
