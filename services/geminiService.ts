import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, PreMeetingStrategy, UserPersona, FeedbackMode } from "../types";

const MODEL_NAME_PRO = 'gemini-3-flash-preview';
const MODEL_NAME_FLASH = 'gemini-3-flash-preview';

/**
 * [API Key 로드] Vercel 및 로컬 환경 변수를 가장 확실하게 탐색합니다.
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
  } catch (e) {
    return text;
  }
}

async function generateContentWithRetry(
  ai: GoogleGenAI, 
  params: any, 
  onProgress?: (m: string) => void,
  retryCount = 0
): Promise<GenerateContentResponse> {
  try {
    // 고속 분석을 위한 Thinking Level 설정
    if (!params.config) params.config = {};
    params.config.thinkingConfig = { thinkingLevel: 'LOW' };

    return await ai.models.generateContent(params);
  } catch (err: any) {
    const errorText = String(err.message || err).toLowerCase();
    const statusCode = err.status || err.code || 0;
    
    if (statusCode === 429 || statusCode === 503 || errorText.includes("quota") || errorText.includes("overloaded")) {
      if (retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 2000;
        onProgress?.(`서버 부하로 재시도 중... (${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return generateContentWithRetry(ai, params, onProgress, retryCount + 1);
      }
    }
    throw err;
  }
}

/**
 * [강력한 지침] 있지도 않은 사실(MD 경력, 환불 정책 등)을 지어내는 행위를 엄격히 금지합니다.
 */
const STRICT_GROUNDING_INSTRUCTION = `
[데이터 무결성 및 가상 정보 생성 절대 금지 원칙]
1. **경력 날조 금지**: 상담자(사용자)를 'MD 출신', '콘텐츠 전략가' 등 데이터에 명시되지 않은 특정 직업군으로 단정하지 마십시오.
2. **정책 날조 금지**: '100% 환불 보장', '3개월 성과 보장', '무료 체험' 등 원본 데이터에 없는 비즈니스 정책이나 보상안을 임의로 제안하지 마십시오.
3. **오지랖 금지**: 상담자의 상황을 "이럴 것이다"라고 넘겨짚지 마십시오. "MD 출신 전문가로서~"와 같은 가짜 서두를 절대 사용하지 마십시오.
4. **증거 기반 분석**: 모든 분석과 지적은 오직 대화 텍스트 내의 실제 발화 내용을 증거로 삼아야 합니다.
5. **분석 이행**: 데이터가 부족하더라도 '분석 불가'라고 끝내지 마십시오. 말투, 대화의 주도권, 질문의 세련미 등 드러난 단서 안에서만 전문가적 견해를 내놓으십시오.
`;

const getSystemInstruction = (persona?: UserPersona, mode: FeedbackMode = 'softened') => {
  const modeInstruction = mode === 'merciless' 
    ? `당신은 매우 직설적이고 뼈를 때리는 수준으로 날카롭게 분석하는 비즈니스 코치입니다. 상담자의 실수를 자비 없이 지적하되, 반드시 팩트에만 근거하십시오.`
    : `당신은 전문적이고 건설적인 비즈니스 코치입니다. 상담자의 실수를 명확히 짚어주되, 성장을 독려하는 톤을 유지하십시오.`;

  return `
당신은 세계 최고의 세일즈 전략가이자 비즈니스 분석가입니다. 
${STRICT_GROUNDING_INSTRUCTION}
사용자 페르소나(${persona?.name || '전문가'})의 전문성을 유지하며 모든 분석은 **한국어**로만 수행하십시오.

[핵심 분석 지침]
1. **SPIN 추출**: 대화 전문에서 상담자가 실제로 던진 SPIN 질문을 누락 없이 추출하십시오. (각 단계별 최소 4개 지향)
2. **권장 스크립트**: 상담자가 실제로 가진 전문 영역 안에서만 말투를 세련되게 다듬어 **정확히 2개**를 제시하십시오.
3. **분석의 질**: 상담자의 심리적 트리거 활용 능력, 시스템적 부재를 정밀하게 진단하십시오. 
4. **사실 확인**: 답변을 내놓기 전 "내가 지금 상담자의 경력을 지어내고 있는가?"를 스스로 검증하십시오.
`;
};

// --- [Schemas 설정: 데이터 구조 완벽 복구] ---
const INSIGHTS_SCHEMA = {
  charlieMorganInsight: {
    type: Type.OBJECT,
    properties: { 
      deepPain: { type: Type.STRING }, 
      gapDefinition: { type: Type.STRING }, 
      bridgePositioning: { type: Type.STRING }, 
      objectionStrategy: { type: Type.STRING } 
    },
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
            situation: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA, description: "최소 4개 추출" }, 
            problem: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA, description: "최소 4개 추출" }, 
            implication: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA, description: "최소 4개 추출" }, 
            needPayoff: { type: Type.ARRAY, items: SPIN_QUESTION_ITEM_SCHEMA, description: "최소 4개 추출" } 
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

// --- [헬퍼 및 메인 실행 함수] ---
function getMimeType(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.txt')) return 'text/plain';
  return 'application/octet-stream';
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = () => reject(new Error("파일 변환 실패"));
    reader.readAsDataURL(file);
  });
}

export const analyzeSalesFile = async (file: File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    
    onProgress?.("팩트 기반 정밀 데이터 분석 중...");
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: "세일즈 대화를 정밀 분석하십시오. 원본에 없는 상담자의 경력이나 사업 정책을 지어내지 마십시오." }] },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: ANALYSIS_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const analyzeSalesText = async (input: string | File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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

export const generatePreMeetingStrategy = async (context: string | File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<PreMeetingStrategy> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const parts: any[] = [];
    if (context instanceof File) {
        const base64 = await fileToBase64(context);
        parts.push({ inlineData: { mimeType: getMimeType(context), data: base64 } });
    } else parts.push({ text: `고객 상황: ${context}` });
    
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts },
        config: { systemInstruction: getSystemInstruction(persona, mode), responseMimeType: "application/json", responseSchema: STRATEGY_SCHEMA } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

export const chatWithSalesCoach = async (message: string, history: ChatMessage[], file?: File, persona?: UserPersona, mode: FeedbackMode = 'softened'): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
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
