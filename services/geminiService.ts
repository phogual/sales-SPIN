import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, PreMeetingStrategy, UserPersona, FeedbackMode } from "../types";

const MODEL_NAME_PRO = 'gemini-3-flash-preview';
const MODEL_NAME_FLASH = 'gemini-3-flash-preview';

/**
 * [API Key 로드] Vercel 및 로컬 환경 변수를 안전하게 탐색합니다.
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
 * [가장 강력한 지침] 팩트 체크를 강제하고 가상의 정체성 생성을 금지합니다.
 */
const STRICT_GROUNDING_INSTRUCTION = `
[데이터 무결성 및 가공 정보 생성 절대 금지 원칙]
1. **정체성 날조 금지**: 상담자(사용자)를 'MD 출신', '큐텐/바른생각 경력자' 등으로 마음대로 규정하지 마십시오. 데이터에 직업이 명시되지 않았다면 그냥 '상담자'로만 호칭하십시오.
2. **비즈니스 정책 조작 금지**: '3개월 무료', '성과 미달 시 100% 환불', 'Keyman 제안' 등 데이터에 없는 보상 정책을 절대로 지어내지 마십시오.
3. **가공의 수치 금지**: '전환율 300% 상승', '수익 5배 보장' 등 근거 없는 목표 수치를 스크립트에 넣지 마십시오.
4. **오지랖 분석 차단**: 상담자의 내면 심리나 상황을 "에고가 강하다", "열등감이 있다"라고 함부로 단정하지 마십시오. 오직 대화의 기술적/전략적 측면만 분석하십시오.
5. **무조건적 증거주의**: 모든 권장 스크립트와 피드백은 "상담자가 대화 중 실제로 말한 내용"을 바탕으로 그 표현 방식만 다듬어야 합니다.
`;

const getSystemInstruction = (persona?: UserPersona, mode: FeedbackMode = 'softened') => {
  const modeInstruction = mode === 'merciless' 
    ? `당신은 매우 직설적이고 날카롭게 분석하는 비즈니스 코치입니다. 상담자의 실수를 팩트 위주로 자비 없이 지적하십시오. 없는 사실을 지어내는 무능한 조언은 즉시 파기하십시오.`
    : `당신은 전문적이고 건설적인 비즈니스 코치입니다. 상담자의 실수를 명확히 짚어주되 성장을 독려하십시오.`;

  return `
당신은 세계 최고의 세일즈 전략가입니다. 
${STRICT_GROUNDING_INSTRUCTION}
사용자 페르소나(${persona?.name || '전문가'})의 전문성을 유지하며 모든 분석은 **한국어**로만 수행하십시오.

[필독: 스크립트 생성 규칙]
- 상담자의 실제 대화 내용에서 '말투'와 '구조'만 전문가답게 수정하십시오.
- 상담자가 "나 MD야"라고 하지 않았다면, 스크립트에 절대로 "MD"라는 단어를 쓰지 마십시오.
- 상담자가 "환불해줄게"라고 하지 않았다면, 스크립트에 "환불"이라는 단어를 절대 쓰지 마십시오.
- 만약 데이터가 너무 부족하다면 "추가 정보 필요"라고 명시하고, 거짓으로 칸을 채우지 마십시오.
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

// --- [헬퍼 함수] ---
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

// --- [메인 실행 함수] ---
export const analyzeSalesFile = async (file: File, persona?: UserPersona, mode: FeedbackMode = 'softened', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    
    onProgress?.("데이터 정밀 분석 중...");
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: "세일즈 대화를 분석하십시오. 소스 데이터에 없는 상담자의 이력이나 비즈니스 정책은 절대적으로 배제하십시오." }] },
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
