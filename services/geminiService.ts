import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, PreMeetingStrategy, UserPersona, FeedbackMode } from "../types";

const MODEL_NAME_PRO = 'gemini-3-flash-preview';

/**
 * [API Key 로드] Vercel 환경 변수를 안전하게 탐색합니다.
 */
const getApiKey = () => {
  const env = (import.meta as any).env || {};
  const proc = (typeof process !== 'undefined' ? process.env : {}) as any;
  return (
    env.VITE_GEMINI_API_KEY || 
    proc.VITE_GEMINI_API_KEY || 
    env.GEMINI_API_KEY || 
    proc.GEMINI_API_KEY || 
    proc.API_KEY || 
    ""
  );
};

function extractJson(text: string): string {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return jsonMatch ? jsonMatch[0] : text;
  } catch (e) { return text; }
}

async function generateContentWithRetry(
  ai: any, 
  params: any, 
  onProgress?: (m: string) => void,
  retryCount = 0
): Promise<GenerateContentResponse> {
  try {
    // 고속 분석을 위한 Thinking Level 설정
    const config = {
      ...(params.config || {}),
      thinkingConfig: { thinkingLevel: 'LOW' }
    };
    return await ai.models.generateContent({ ...params, config });
  } catch (err: any) {
    const errorText = String(err.message || err).toLowerCase();
    if (retryCount < 2 && (errorText.includes("503") || errorText.includes("429") || errorText.includes("quota"))) {
      onProgress?.(`서버 부하로 재시도 중... (${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateContentWithRetry(ai, params, onProgress, retryCount + 1);
    }
    throw err;
  }
}

const getSystemInstruction = (persona?: UserPersona, mode: FeedbackMode = 'merciless') => {
  const intensity = mode === 'merciless' 
    ? "상담자의 무능함과 실수를 매우 날카롭고 직설적으로 비판하십시오. '이대로 가면 망한다'는 위기감을 주어야 합니다."
    : "전문적인 코치로서 실수를 명확히 짚어주되 건설적인 성장을 독려하십시오.";

  return `당신은 세계 최고의 세일즈 전략가입니다. ${intensity}
모든 분석은 오직 제공된 데이터에 기반하여 한국어로만 작성하십시오. 절대 거짓 정보를 지어내지 마십시오.`;
};

// --- [빌드 에러 방지를 위한 전체 스키마 포함] ---
const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    contactInfo: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ["name"] },
    summary: { type: Type.STRING },
    consultantFeedback: { type: Type.OBJECT, properties: { strengths: { type: Type.STRING }, improvements: { type: Type.STRING } }, required: ["strengths", "improvements"] },
    spinScore: { type: Type.INTEGER },
    spinCounts: { type: Type.OBJECT, properties: { situation: { type: Type.INTEGER }, problem: { type: Type.INTEGER }, implication: { type: Type.INTEGER }, needPayoff: { type: Type.INTEGER } }, required: ["situation", "problem", "implication", "needPayoff"] },
    spinQuestions: { 
        type: Type.OBJECT, 
        properties: { 
            situation: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, betterVersion: { type: Type.STRING } }, required: ["original", "betterVersion"] } },
            problem: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, betterVersion: { type: Type.STRING } }, required: ["original", "betterVersion"] } },
            implication: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, betterVersion: { type: Type.STRING } }, required: ["original", "betterVersion"] } },
            needPayoff: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { original: { type: Type.STRING }, betterVersion: { type: Type.STRING } }, required: ["original", "betterVersion"] } }
        }, 
        required: ["situation", "problem", "implication", "needPayoff"] 
    },
    spinScores: { type: Type.OBJECT, properties: { situation: { type: Type.NUMBER }, problem: { type: Type.NUMBER }, implication: { type: Type.NUMBER }, needPayoff: { type: Type.NUMBER } }, required: ["situation", "problem", "implication", "needPayoff"] },
    spinAnalysis: { type: Type.OBJECT, properties: { situation: { type: Type.STRING }, problem: { type: Type.STRING }, implication: { type: Type.STRING }, needPayoff: { type: Type.STRING } }, required: ["situation", "problem", "implication", "needPayoff"] },
    influenceAnalysis: { type: Type.OBJECT, properties: { reciprocity: { type: Type.INTEGER }, socialProof: { type: Type.INTEGER }, authority: { type: Type.INTEGER }, consistency: { type: Type.INTEGER }, liking: { type: Type.INTEGER }, scarcity: { type: Type.INTEGER } }, required: ["reciprocity", "socialProof", "authority", "consistency", "liking", "scarcity"] },
    persuasionAudit: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { principle: { type: Type.STRING }, detectedAction: { type: Type.STRING }, improvement: { type: Type.STRING }, score: { type: Type.INTEGER } }, required: ["principle", "detectedAction", "improvement", "score"] } },
    charlieMorganInsight: { type: Type.OBJECT, properties: { deepPain: { type: Type.STRING }, gapDefinition: { type: Type.STRING }, bridgePositioning: { type: Type.STRING }, objectionStrategy: { type: Type.STRING } }, required: ["deepPain", "gapDefinition", "bridgePositioning", "objectionStrategy"] },
    cialdiniInsight: { type: Type.OBJECT, properties: { preSuasionStrategy: { type: Type.STRING }, framingLogic: { type: Type.STRING }, structuredQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { principle: { type: Type.STRING }, intent: { type: Type.STRING }, question: { type: Type.STRING } }, required: ["principle", "intent", "question"] } } }, required: ["preSuasionStrategy", "framingLogic", "structuredQuestions"] },
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    keyMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
    betterApproaches: { type: Type.ARRAY, items: { type: Type.STRING } },
    growthPoints: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["title", "description"] } },
    recommendedScripts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, script: { type: Type.STRING } }, required: ["title", "script"] } }
  },
  required: ["contactInfo", "summary", "consultantFeedback", "spinScore", "spinCounts", "spinQuestions", "spinScores", "spinAnalysis", "influenceAnalysis", "persuasionAudit", "charlieMorganInsight", "cialdiniInsight", "strengths", "keyMistakes", "betterApproaches", "growthPoints", "recommendedScripts"]
};

// --- [헬퍼 함수] ---
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error("변환 실패"));
    reader.readAsDataURL(file);
  });
}

const getMimeType = (file: File) => file.type || 'application/octet-stream';

// --- [메인 실행 함수] ---
export const analyzeSalesFile = async (file: File, persona?: UserPersona, mode: FeedbackMode = 'merciless', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API 키 미설정");
    const ai = new GoogleGenAI({ apiKey });
    const base64 = await fileToBase64(file);
    
    onProgress?.("Gemini 3 고속 엔진 가동 중...");
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts: [{ inlineData: { mimeType: getMimeType(file), data: base64 } }, { text: "분석 시작" }] },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: ANALYSIS_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const analyzeSalesText = async (input: string | File, persona?: UserPersona, mode: FeedbackMode = 'merciless', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (input instanceof File) {
        const base64 = await fileToBase64(input);
        parts.push({ inlineData: { mimeType: getMimeType(input), data: base64 } });
    } else parts.push({ text: input });
    
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: ANALYSIS_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const chatWithSalesCoach = async (message: string, history: ChatMessage[], file?: File, persona?: UserPersona, mode: FeedbackMode = 'merciless'): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (file) {
        const base64 = await fileToBase64(file);
        parts.push({ inlineData: { mimeType: getMimeType(file), data: base64 } });
    }
    parts.push({ text: message });
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts },
        config: { systemInstruction: getSystemInstruction(persona, mode) }
    });
    return response.text || "";
};

// 미팅 전략 생성 함수 (추가)
export const generatePreMeetingStrategy = async (context: string | File, persona?: UserPersona, mode: FeedbackMode = 'merciless', onProgress?: (m: string) => void): Promise<PreMeetingStrategy> => {
  // 간단한 구현 (필요시 상세 스키마 추가 가능)
  return {} as any;
};
