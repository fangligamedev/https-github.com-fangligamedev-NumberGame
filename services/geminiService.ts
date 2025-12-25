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
    model: string = "gemini-3-flash-preview",
    jsonMode: boolean = false
): Promise<string | null> {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    const baseUrl = process.env.GEMINI_API_BASE_URL;

    if (!apiKey || !baseUrl) {
        return `配置错误：缺失 ${!apiKey ? 'API_KEY' : ''} ${!baseUrl ? 'BASE_URL' : ''}。请检查环境变量。`;
    }

    try {
        const payloadMessages = [];
        if (systemInstruction) {
            payloadMessages.push({ role: 'user', content: `[重要指令 - 请遵守]: ${systemInstruction}\n\n[学生当前问题/状态]: ${messages[messages.length - 1].content}` });
        } else {
            payloadMessages.push(...messages);
        }

        let cleanBaseUrl = baseUrl;
        if (!cleanBaseUrl.endsWith('/')) cleanBaseUrl += '/';
        const url = `${cleanBaseUrl}chat/completions`;

        const body: any = {
            model: model,
            messages: payloadMessages,
            temperature: 0.7,
        };

        if (jsonMode) {
            body.response_format = { type: "json_object" };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Zeabur/OpenAI Error:", response.status, errText);
            
            // 如果 404 且没试过加 google/ 前缀，则尝试
            if (response.status === 404 && !model.includes('/')) {
                return fetchOpenAICompat(messages, systemInstruction, `google/${model}`, jsonMode);
            }
            
            return `API 访问失败 (${response.status}): ${errText.substring(0, 100)}`;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return content || "API 响应正常但内容为空，请检查模型支持情况。";
    } catch (e: any) {
        console.error("Fetch Error", e);
        return `网络连接异常: ${e.message}`;
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
      `${m.question.num1} ${m.question.operator} ${m.question.num2} = ? (学生填了: ${m.userAnswer}, 正确答案: ${m.question.answer})`
    ).join("\n");
    
    const system = `你是一位上海小学数学名师。你的任务是分析学生的错题并提供深度的启发式指导。
    不要说"加油"、"注意看题"之类的废话。
    请针对以下错题，找出可能的错误原因（如：进位错误、退位错误、乘法口诀记错、除法余数理解问题等），并用通俗易懂的语言讲解解题思路和技巧。
    鼓励学生思考数学本质，而不是死记硬背。`;
    
    const prompt = `分析以下这些错题并给出针对性的讲解：\n${recentMistakes}`;

    if (useOpenAIProtocol()) {
        const text = await fetchOpenAICompat([{ role: 'user', content: prompt }], system);
        return text || "AI 诊断功能目前不可用，请确认环境变量配置。";
    }

    const ai = initAI();
    if (!ai) return "分析服务暂时不可用。";
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${system}\n\n${prompt}`,
      });
      return response.text || "加油，下次注意看清题目哦！";
    } catch (error) {
      return "老师正在休息，等下再帮你分析哦。";
    }
};

export const chatWithTutor = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  const systemInstruction = `你是一位上海小学数学名师，名字叫“数学岛导师”。
  你的目标是引导学生真正理解数学逻辑，而不是直接给答案。
  对话原则：
  1. 禁止直接给出题目答案。
  2. 采用启发式教学：如果学生问问题，通过提问来引导他们思考（例如：“你觉得这个进位应该加到哪一列呢？”）。
  3. 针对具体的数学概念（如乘法分配律、竖式计算、单位换算）进行深度浅出的讲解。
  4. 使用 emoji 使对话生动，但内容必须干货满满。
  5. 禁止说“加油”、“你真棒”等空洞的鼓励，必须指出具体的进步点或思考方向。`;

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
    return `题目: ${q.bossText ? q.bossText : `${q.num1} ${q.operator} ${q.num2}`} | 正确答案: ${q.answer} | 学生回答: ${ans?.val} | 结果: ${ans?.correct ? '正确' : '错误'}`;
  }).join('\n');

  const system = `你是一位上海小学数学专家。请对学生刚完成的这一关表现进行精准点评。
  要求：
  1. 不要说"太棒了"、"继续努力"这种泛泛而谈的话。
  2. 如果有错题，必须指出具体的数学错误逻辑（例如：三位数加法进位忘记了、两位数乘法竖式位值对齐问题等）。
  3. 如果全对，请给出一个更高维度的数学思考建议或一个巧妙的简算技巧。
  4. 语言要专业且对孩子亲切，字数控制在100字以内。`;

  const prompt = `这是本关的答题记录：\n${summary}`;

  if (useOpenAIProtocol()) {
      const text = await fetchOpenAICompat([{ role: 'user', content: prompt }], system);
      return text || "本关挑战结束！";
  }

  const ai = initAI();
  if (!ai) return "本关挑战结束！";

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${system}\n\n${prompt}`
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
