import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResult, ChatMessage, PreMeetingStrategy, UserPersona, FeedbackMode } from "../types";

/**
 * [최적화] ProTon님이 확인하신 "잘 돌아가는" Gemini 3 프리뷰 모델로 고정합니다.
 */
const MODEL_NAME_PRO = 'gemini-3-flash-preview';
const MODEL_NAME_FLASH = 'gemini-3-flash-preview';

/**
 * [API 키 로직] Vercel 환경 변수를 가장 확실하게 읽어오는 방식입니다.
 */
const getApiKey = () => {
  const env = (import.meta as any).env || {};
  const proc = (typeof process !== 'undefined' ? process.env : {}) as any;
  return env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || proc.VITE_GEMINI_API_KEY || proc.GEMINI_API_KEY || proc.API_KEY || "";
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
    // Gemini 3 Preview 모델은 'LOW' 씽킹 레벨에서 가장 빠릅니다.
    if (!params.config) params.config = {};
    params.config.thinkingConfig = { thinkingLevel: 'LOW' };
    
    return await ai.models.generateContent(params);
  } catch (err: any) {
    const errorText = String(err.message || err).toLowerCase();
    if (retryCount < 2 && (errorText.includes("503") || errorText.includes("quota"))) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return generateContentWithRetry(ai, params, onProgress, retryCount + 1);
    }
    throw err;
  }
}

// --- [ProTon님의 독설 모드 프롬프트 지침] ---
const getSystemInstruction = (persona?: UserPersona, mode: FeedbackMode = 'merciless') => {
  const modeInstruction = mode === 'merciless' 
    ? `상담자의 무능함과 실수를 '뼈 때리는' 수준으로 날카롭고 직설적으로 지적하십시오. 이대로 가면 망한다는 위기감을 주어야 합니다.`
    : `전문적이고 건설적인 비즈니스 코치로서 실수를 명확히 짚어주되 성장을 독려하십시오.`;

  return `
당신은 세계 최고의 세일즈 전략가입니다. ${modeInstruction}
오직 제공된 데이터에만 기반하여 한국어로 분석하십시오. 팩트가 아닌 것을 지어내지 마십시오. 
`;
};

// --- [데이터 스키마 및 분석 함수 로직 (기존과 동일)] ---
// ... (기존 ANALYSIS_SCHEMA 및 analyzeSalesFile 등의 함수가 이어서 들어갑니다)

export const analyzeSalesFile = async (file: File, persona?: UserPersona, mode: FeedbackMode = 'merciless', onProgress?: (m: string) => void): Promise<AnalysisResult> => {
    const key = getApiKey();
    const ai = new GoogleGenAI({ apiKey: key });
    const base64 = await fileToBase64(file);
    const mimeType = getMimeType(file);
    
    onProgress?.("Gemini 3 고속 엔진 분석 중...");
    const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME_PRO,
        contents: { parts: [{ inlineData: { mimeType, data: base64 } }, { text: "세일즈 대화를 정밀 분석하십시오." }] },
        config: { 
          systemInstruction: getSystemInstruction(persona, mode), 
          responseMimeType: "application/json", 
          responseSchema: ANALYSIS_SCHEMA 
        } as any
    }, onProgress);
    return JSON.parse(extractJson(response.text || "{}"));
};

// ... (이하 analyzeSalesText, chatWithSalesCoach 로직 포함)
