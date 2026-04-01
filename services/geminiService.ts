import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, PreMeetingStrategy, UserPersona, FeedbackMode } from "../types";

/**
 * [핵심] ProTon님이 확인하신 "잘 돌아가는" 모델로 고정합니다.
 * gemini-3-flash-preview는 현재 가장 빠른 실험적 엔진입니다.
 */
const MODEL_NAME_PRO = 'gemini-3-flash-preview';
const MODEL_NAME_FLASH = 'gemini-3-flash-preview';

/**
 * [API 키 로드] Vercel 환경 변수 우선순위를 재설정하여 'Key missing' 에러를 차단합니다.
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

/**
 * [고속 설정] thinkingLevel을 'LOW'로 설정하여 딜레이를 최소화합니다.
 */
async function generateContentWithRetry(
  ai: GoogleGenAI, 
  params: any, 
  onProgress?: (m: string) => void,
  retryCount = 0
): Promise<GenerateContentResponse> {
  try {
    // Gemini 3 Preview의 빠른 응답을 위한 필수 설정
    const config = {
      ...(params.config || {}),
      thinkingConfig: { thinkingLevel: 'LOW' }
    };
    
    return await ai.models.generateContent({ ...params, config });
  } catch (err: any) {
    const errorText = String(err.message || err).toLowerCase();
    // 503(부하) 또는 429(할당량) 발생 시 짧게 재시도
    if (retryCount < 2 && (errorText.includes("503") || errorText.includes("429") || errorText.includes("quota"))) {
      onProgress?.(`서버 부하로 재접속 중... (${retryCount + 1}/2)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateContentWithRetry(ai, params, onProgress, retryCount + 1);
    }
    throw err;
  }
}

// --- [시스템 지침: 독설 모드 강화] ---
const getSystemInstruction = (persona?: UserPersona, mode: FeedbackMode = 'merciless') => {
  const intensity = mode === 'merciless' 
    ? "상담자의 무능함과 실수를 매우 날카롭고 직설적으로 비판하십시오. '이대로 가면 망한다'는 위기감을 주어야 합니다."
    : "전문적인 코치로서 실수를 명확히 짚어주되 건설적인 성장을 독려하십시오.";

  return `당신은 세계 최고의 세일즈 전략가입니다. ${intensity}
모든 분석은 오직 제공된 데이터에 기반하여 **한국어**로만 작성하십시오. 절대 거짓 정보를 지어내지 마십시오.`;
};

/**
 * [데이터 스키마] AnalysisResult 구조에 맞춘 정밀 설계
 */
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

// --- [공통 분석 함수] ---
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error("파일 변환 실패"));
    reader.readAsDataURL(file);
  });
}

function getMimeType(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.txt')) return 'text/plain';
  return file.type || 'application/octet-stream';
}

export const analyzeSalesFile = async (file: File, persona?: UserPersona, mode: FeedbackMode = 'merciless', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API 키를 찾을 수 없습니다. Vercel 설정을 확인하세요.");
    const ai = new GoogleGenAI({ apiKey });
    const base64 = await fileToBase64(file);
    
    onProgress?.("Gemini 3 고속 엔진 가동 중...");
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts: [{ inlineData: { mimeType: getMimeType(file), data: base64 } }, { text: "세일즈 대화를 분석하십시오." }] },
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
