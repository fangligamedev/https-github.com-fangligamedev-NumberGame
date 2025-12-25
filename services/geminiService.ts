import { GoogleGenAI, Modality } from "@google/genai";
import { MistakeRecord, Question, ChatMessage, Operator } from "../types";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.warn("Gemini API Key missing");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

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

// ... existing getEncouragement ...
export const getEncouragement = async (streak: number, level: number): Promise<string> => {
  const ai = initAI();
  if (!ai) return "你做得真棒！继续加油！";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User is a 3rd grade student in China. Current streak: ${streak}, Level: ${level}. 
      Give a very short, enthusiastic encouragement message in Chinese (Simplified). Max 15 words.`,
    });
    return response.text || "太棒了！继续挑战！";
  } catch (error) {
    console.error("AI Error", error);
    return "太棒了！继续挑战！";
  }
};

// ... existing analyzeMistakes ...
export const analyzeMistakes = async (mistakes: MistakeRecord[]): Promise<string> => {
    // ... keep existing implementation details ...
    const ai = initAI();
    if (!ai) return "分析服务暂时不可用。";
  
    if (mistakes.length === 0) return "没有错题，太完美了！";
  
    const recentMistakes = mistakes.slice(-5).map(m => 
      `${m.question.num1} ${m.question.operator} ${m.question.num2} = ? (User: ${m.userAnswer}, Correct: ${m.question.answer})`
    ).join("\n");
  
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Role: Math tutor for 3rd grader. Analyze mistakes:\n${recentMistakes}\nOutput: Short, encouraging advice in Chinese.`,
      });
      return response.text || "加油，下次注意看清题目哦！";
    } catch (error) {
      return "加油，下次注意看清题目哦！";
    }
};

// New: Chat with the tutor
export const chatWithTutor = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  const ai = initAI();
  if (!ai) return "我现在有点累，稍后再聊吧。";

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are a friendly, patient, and fun math tutor for a Chinese 3rd-grade student named "小小探险家". 
        Your goal is to help them love math. 
        - Do NOT just give answers to math problems. Guide them to solve it step-by-step.
        - Use emojis. 
        - Keep responses concise (under 50 words) unless explaining a concept.
        - Encourage them to ask questions about "why" and "how".
        - If they say they are frustrated, comfort them.`,
      },
    });

    const response = await chat.sendMessage({ message: newMessage });
    return response.text || "我没听清，能再说一遍吗？";
  } catch (error) {
    console.error("Chat Error", error);
    return "我好像掉线了，请检查网络。";
  }
};

// New: Generate Speech from Text
export const generateSpeech = async (text: string): Promise<AudioBuffer | null> => {
  const ai = initAI();
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

// New: Analyze a completed stage
export const analyzeStage = async (questions: Question[], answers: {qId: string, correct: boolean, val: number}[]): Promise<string> => {
  const ai = initAI();
  if (!ai) return "本关挑战结束！";

  const summary = questions.map(q => {
    const ans = answers.find(a => a.qId === q.id);
    return `Q: ${q.bossText ? q.bossText : `${q.num1}${q.operator}${q.num2}`} | Correct Answer: ${q.answer} | User Result: ${ans?.correct ? 'Correct' : `Wrong (answered ${ans?.val})`}`;
  }).join('\n');

  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this math game stage performance for a 3rd grader:
        ${summary}
        
        Provide a 2-sentence feedback in Chinese. 
        1. Praise what they did well.
        2. Point out one specific thing to improve (if any errors) or give a high-five.`
    });
    return response.text || "做得不错！继续挑战下一关吧！";
  } catch (e) {
      return "关卡完成！继续加油！";
  }
};

export const generateBossQuestion = async (level: number, operators: Operator[]): Promise<{text: string, answer: number} | null> => {
    const ai = initAI();
    if (!ai) return null;

    const opString = operators.join(', ');

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate a fun math word problem (Boss Battle) for a 3rd grader.
            Level context: Numbers up to 1000.
            Allowed Operations: ${opString}.
            Language: Chinese (Simplified).
            Theme: Fantasy RPG (Dragons, Treasure, Magic) or Space.
            Format: JSON object with "question" (string) and "answer" (number).
            Example: {"question": "恶龙抓走了公主！你需要3把钥匙才能打开笼子，每把钥匙需要25个魔法石。你现在有10个魔法石，还需要多少个？", "answer": 65}`,
            config: {
                responseMimeType: "application/json"
            }
        });
        
        const text = response.text;
        if(text) {
             const result = JSON.parse(text);
             return { text: result.question, answer: Number(result.answer) };
        }
        return null;
    } catch (e) {
        console.error("Boss Gen Error", e);
        return null;
    }
}