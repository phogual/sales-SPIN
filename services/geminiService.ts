import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, PreMeetingStrategy, UserPersona, FeedbackMode } from "../types";

/**
 * [속도 및 안정성 최적화]
 * 현재 가장 안정적이고 빠른 정식 버전 모델을 사용하여 503 오류를 최소화합니다.
 */
const MODEL_NAME_PRO = 'gemini-1.5-flash';
const MODEL_NAME_FLASH = 'gemini-1.5-flash';

/**
 * [API 키 로드 로직]
 * Vercel의 모든 환경 변수(VITE_, process.env 등)를 뒤져서 키를 찾아냅니다.
 */
const getApiKey = () => {
  const env = (import.meta as any).env || {};
  const proc = (typeof process !== 'undefined' ? process.env : {}) as any;
  return (
    env.VITE_GEMINI_API_KEY || 
    env.GEMINI_API_KEY || 
    proc.VITE_GEMINI_API_KEY || 
    proc.GEMINI_API_KEY || 
    proc.API_KEY || 
    ""
  );
};

/**
 * AI 응답 텍스트에서 순수 JSON만 추출하는 헬퍼 함수
 */
function extractJson(text: string): string {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return jsonMatch ? jsonMatch[0] : text;
  } catch (e) {
    return text;
  }
}

/**
 * [재시도 로직 개선]
 * 서버 부하(503) 시 대기 시간을 조절하여 체감 속도를 높입니다.
 */
async function generateContentWithRetry(
  ai: GoogleGenAI, 
  params: any, 
  onProgress?: (m: string) => void,
  retryCount = 0
): Promise<GenerateContentResponse> {
  try {
    return await ai.models.generateContent(params);
  } catch (err: any) {
    const errorText = String(err.message || err).toLowerCase();
    const statusCode = err.status || err.code || 0;
    
    if (statusCode === 429 || statusCode === 503 || errorText.includes("quota") || errorText.includes("overloaded")) {
      if (retryCount < 2) {
        const waitTime = 2000;
        onProgress?.(`서버 응답 지연으로 재접속 중... (${retryCount + 1}/2)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return generateContentWithRetry(ai, params, onProgress, retryCount + 1);
      }
    }
    throw err;
  }
}

// --- [원본 프롬프트 지침 유지] ---
const STRICT_GROUNDING_INSTRUCTION = `
[데이터 무결성 및 피드백 원칙]
1. 당신은 오직 사용자가 제공한 텍스트/파일 데이터에만 기반하여 응답해야 합니다.
2. 소스에 없는 성공 사례, 특정 인물 스토리 등을 지어내지 마십시오.
3. 단순한 응원보다는 실질적인 개선 방향을 제시하는 데 집중하십시오.
4. 상담자의 실수나 시스템적 결함은 명확하게 지적하되, 비난이 아닌 성장을 위한 '전문가적 조언'의 톤을 유지하십시오.
5. 상황에 따라 해석이 달라질 수 있는 부분은 유연하게 표현하되, 핵심적인 패착은 확실히 짚어주십시오.
`;

const getSystemInstruction = (persona?: UserPersona, mode: FeedbackMode = 'softened') => {
  const modeInstruction = mode === 'merciless' 
    ? `당신은 매우 직설적이고 뼈를 때리는 수준으로 날카롭게 분석하는 비즈니스 코치입니다. 상담자의 실수를 자비 없이 지적하고, 이대로 가면 망한다는 경각심을 일깨워주십시오. 독설적이지만 성장을 위한 진심 어린 조언을 담으십시오.`
    : `당신은 전문적이고 건설적인 비즈니스 코치입니다. 상담자의 실수를 명확히 짚어주되, 대화의 흐름을 부드럽게 이어가며 성장을 독려하는 톤을 유지하십시오. 상황에 따른 유연한 해석을 포함하여 전문적인 조언을 제공하십시오.`;

  return `
당신은 세계 최고의 세일즈 전략가이자, ${modeInstruction} 
${STRICT_GROUNDING_INSTRUCTION}
사용자 페르소나(${persona?.name || '전문가'})의 전문성을 유지하며, 대화의 흐름을 부드럽게 이어가되 실수는 날카롭게 분석하십시오.

[핵심 지침: SPIN 기반 통합 분석 및 한국어 출력]
1. 언어 제한: 모든 분석 내용, 질문, 스크립트, 요약은 반드시 **한국어**로만 작성하십시오.
2. SPIN 통합 로직: 대화 전문에서 상담자가 실제로 던진 모든 SPIN 질문을 누락 없이 추출하십시오.
`;
};

// --- [원본 데이터 스키마 유지] ---
const INSIGHTS_SCHEMA = {
  charlieMorganInsight: {
    type: Type.OBJECT,
    properties: { deepPain: { type: Type.STRING }, gapDefinition: { type: Type.STRING }, bridgePositioning: { type: Type.STRING }, objectionStrategy: { type: Type.STRING } },
    required: ["deepPain", "gapDefinition", "bridgePositioning", "objectionStrategy"]
  },
  cialdiniInsight: {
    type: Type.OBJECT,
    properties: {
      preSuasionStrategy: { type: Type.STRING },
      framingLogic: { type: Type.STRING },
      structuredQuestions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { principle: { type: Type.STRING }, intent: { type: Type.STRING }, question: { type: Type.STRING } },
          required: ["principle", "intent", "question"]
        }
      }
    },
    required: ["preSuasionStrategy", "framingLogic", "structuredQuestions"]
  }
};

const STRATEGY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clientContext: { type: Type.STRING },
    strategySummary: { type: Type.STRING },
    charlieMorganInsight: INSIGHTS_SCHEMA.charlieMorganInsight,
    cialdiniInsight: INSIGHTS_SCHEMA.cialdiniInsight,
    spinQuestions: { 
        type: Type.OBJECT, 
        properties: { 
            situation: { type: Type.ARRAY, items: { type: Type.STRING } }, 
            problem: { type: Type.ARRAY, items: { type: Type.STRING } }, 
            implication: { type: Type.ARRAY, items: { type: Type.STRING } }, 
            needPayoff: { type: Type.ARRAY, items: { type: Type.STRING } } 
        },
        required: ["situation", "problem", "implication", "needPayoff"]
    },
    spinScores: {
        type: Type.OBJECT,
        properties: { situation: { type: Type.NUMBER }, problem: { type: Type.NUMBER }, implication: { type: Type.NUMBER }, needPayoff: { type: Type.NUMBER } },
        required: ["situation", "problem", "implication", "needPayoff"]
    },
    spinAnalysis: {
        type: Type.OBJECT,
        properties: { situation: { type: Type.STRING }, problem: { type: Type.STRING }, implication: { type: Type.STRING }, needPayoff: { type: Type.STRING } },
        required: ["situation", "problem", "implication", "needPayoff"]
    },
    persuasionStrategies: { 
        type: Type.ARRAY, 
        items: { 
            type: Type.OBJECT, 
            properties: { principle: { type: Type.STRING }, description: { type: Type.STRING }, script: { type: Type.STRING } },
            required: ["principle", "description", "script"]
        } 
    },
    tips: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["clientContext", "strategySummary", "charlieMorganInsight", "cialdiniInsight", "spinQuestions", "spinScores", "spinAnalysis", "persuasionStrategies", "tips"]
};

const SPIN_QUESTION_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    original: { type: Type.STRING },
    betterVersion: { type: Type.STRING }
  },
  required: ["original", "betterVersion"]
};

const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    contactInfo: { type: Type.OBJECT, properties: { name: { type: Type.STRING } }, required: ["name"] },
    summary: { type: Type.STRING },
    consultantFeedback: {
        type: Type.OBJECT,
        properties: { strengths: { type: Type.STRING }, improvements: { type: Type.STRING } },
        required: ["strengths", "improvements"]
    },
    spinScore: { type: Type.INTEGER },
    spinCounts: { type: Type.OBJECT, properties: { situation: { type: Type.INTEGER }, problem: { type: Type.INTEGER }, implication: { type: Type.INTEGER }, needPayoff: { type: Type.INTEGER } }, required: ["situation", "problem", "implication", "needPayoff"] },
    spinQuestions: { 
        type: Type.OBJECT, 
        properties: { 
            situation: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA }, 
            problem: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA }, 
            implication: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA }, 
            needPayoff: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA } 
        }, 
        required: ["situation", "problem", "implication", "needPayoff"] 
    },
    spinScores: { type: Type.OBJECT, properties: { situation: { type: Type.NUMBER }, problem: { type: Type.NUMBER }, implication: { type: Type.NUMBER }, needPayoff: { type: Type.NUMBER } }, required: ["situation", "problem", "implication", "needPayoff"] },
    spinAnalysis: {
        type: Type.OBJECT,
        properties: { situation: { type: Type.STRING }, problem: { type: Type.STRING }, implication: { type: Type.STRING }, needPayoff: { type: Type.STRING } },
        required: ["situation", "problem", "implication", "needPayoff"]
    },
    influenceAnalysis: { type: Type.OBJECT, properties: { reciprocity: { type: Type.INTEGER }, socialProof: { type: Type.INTEGER }, authority: { type: Type.INTEGER }, consistency: { type: Type.INTEGER }, liking: { type: Type.INTEGER }, scarcity: { type: Type.INTEGER } }, required: ["reciprocity", "socialProof", "authority", "consistency", "liking", "scarcity"] },
    persuasionAudit: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { principle: { type: Type.STRING }, detectedAction: { type: Type.STRING }, improvement: { type: Type.STRING }, score: { type: Type.INTEGER } }, required: ["principle", "detectedAction", "improvement", "score"] } },
    charlieMorganInsight: INSIGHTS_SCHEMA.charlieMorganInsight,
    cialdiniInsight: INSIGHTS_SCHEMA.cialdiniInsight,
    strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
    keyMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
    betterApproaches: { type: Type.ARRAY, items: { type: Type.STRING } },
    growthPoints: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["title", "description"] } },
    recommendedScripts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, script: { type: Type.STRING } }, required: ["title", "script"] } }
  },
  required: ["contactInfo", "summary", "consultantFeedback", "spinScore", "spinCounts", "spinQuestions", "spinScores", "spinAnalysis", "influenceAnalysis", "persuasionAudit", "charlieMorganInsight", "cialdiniInsight", "strengths", "keyMistakes", "betterApproaches", "growthPoints", "recommendedScripts"]
};

// --- [분석 함수 및 헬퍼 로직] ---
function getMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (name.endsWith('.mp3')) return 'audio/mpeg';
  if (name.endsWith('.wav')) return 'audio/wav';
  if (name.endsWith('.m4a')) return 'audio/mp4';
  if (name.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error("파일 읽기 실패"));
    reader.readAsDataURL(file);
  });
}

export const analyzeSalesFile = async (file: File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API 키를 찾을 수 없습니다.");
    const ai = new GoogleGenAI({ apiKey });
    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    
    onProgress?.("데이터 정밀 분석 엔진 가동 중...");
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: "세일즈 대화를 분석하십시오." }] },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: ANALYSIS_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const analyzeSalesText = async (input: string | File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (input instanceof File) {
        const base64 = await fileToBase64(input);
        const mimeType = getMimeType(input);
        parts.push({ inlineData: { mimeType, data: base64 } });
    } else parts.push({ text: input });
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: ANALYSIS_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const generatePreMeetingStrategy = async (context: string | File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<PreMeetingStrategy> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (context instanceof File) {
        const base64 = await fileToBase64(context);
        const mimeType = getMimeType(context);
        parts.push({ inlineData: { mimeType, data: base64 } });
    } else parts.push({ text: `고객 상황: ${context}` });
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: STRATEGY_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const chatWithSalesCoach = async (message: string, history: ChatMessage[], file?: File, persona?: UserPersona, mode: FeedbackMode = 'softened'): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (file) {
        const base64 = await fileToBase64(file);
        const mimeType = getMimeType(file);
        parts.push({ inlineData: { mimeType, data: base64 } });
    }
    parts.push({ text: message });
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts },
        config: { systemInstruction: getSystemInstruction(persona, mode) }
    });
    return response.text || "";
};
