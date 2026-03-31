import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { ChatInterface } from './components/ChatInterface';
import { PreMeetingView } from './components/PreMeetingView';
import { PersonaSettings } from './components/PersonaSettings';
import { analyzeSalesFile, analyzeSalesText } from './services/geminiService';
import { AnalysisResult, AppStatus, UserPersona, FeedbackMode } from './types';

// --- [1. 구글 시트 기반 권한 제어 컴포넌트] ---
function AuthGate({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(localStorage.getItem('userEmail'));
  const [authorizedUsers, setAuthorizedUsers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ProTon님의 관리용 구글 시트 ID
    const SHEET_ID = '130AsLYhQu0ZU6e8LY_28arUHTg5WUODHQg3GlR_3agM';
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv`;

    fetch(url)
      .then(res => res.text())
      .then(csvText => {
        const rows = csvText.split('\n').slice(1);
        const data: Record<string, string> = {};
        rows.forEach(row => {
          const columns = row.split(',').map(col => col.replace(/"/g, '').trim());
          const mail = columns[0]?.toLowerCase();
          const date = columns[1];
          if (mail) data[mail] = date || '2099-12-31';
        });
        setAuthorizedUsers(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!email && !isLoading) {
      const input = prompt("긱어스 가입 이메일을 입력해주세요:");
      if (input) {
        const cleaned = input.trim().toLowerCase();
        localStorage.setItem('userEmail', cleaned);
        setEmail(cleaned);
      }
    }
  }, [email, isLoading]);

  if (isLoading) return (
    <div className="flex h-screen items-center justify-center bg-[#020617] text-indigo-400 font-black">
      보안 서버 연결 중...
    </div>
  );

  const today = new Date().toISOString().split('T')[0];
  const expiryDate = email ? authorizedUsers[email] : null;
  const isAuthorized = expiryDate && expiryDate >= today;

  if (isAuthorized) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#020617] text-white p-6 text-center">
      <div className="bg-slate-900/50 p-10 rounded-3xl border border-white/10 shadow-2xl">
        <h1 className="text-2xl font-black mb-4">{expiryDate ? "⏳ 이용 기간 만료" : "🔐 승인 대기 중"}</h1>
        <p className="text-slate-400 mb-8">{expiryDate ? `${email}님의 구독이 종료되었습니다.` : "입력하신 이메일이 결제 명단에 없거나 승인 전입니다."}</p>
        <button onClick={() => { localStorage.removeItem('userEmail'); window.location.reload(); }} className="px-8 py-3 bg-indigo-600 rounded-xl font-bold">다시 입력하기</button>
      </div>
    </div>
  );
}

// --- [2. 메인 앱 컴포넌트] ---
type MainTab = 'PRE_MEETING' | 'SALES_ANALYSIS' | 'AI_COACH';
const ANALYSIS_STEPS = ["데이터 로드...", "SPIN 엔진 가동...", "맥락 분석...", "트리거 탐색...", "개선안 도출...", "스크립트 설계...", "시각화...", "최종 검토..."];

function App() {
  const [mainTab, setMainTab] = useState<MainTab>('PRE_MEETING');
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isServerBusy, setIsServerBusy] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState<{message: string, timestamp: number}[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [persona, setPersona] = useState<UserPersona>({ name: '', background: '', goal: '', isActive: false });
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<FeedbackMode>('merciless'); // 기본 독설 모드
  const [lastAction, setLastAction] = useState<(() => Promise<AnalysisResult>) | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('sales_persona_v2');
    if (saved) { try { setPersona(JSON.parse(saved)); } catch (e) { console.error(e); } }
    const savedMode = localStorage.getItem('feedback_mode');
    if (savedMode) setFeedbackMode(savedMode as FeedbackMode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [mainTab, status]);

  useEffect(() => { localStorage.setItem('feedback_mode', feedbackMode); }, [feedbackMode]);

  useEffect(() => {
    let interval: any, timer: any;
    if (status === AppStatus.ANALYZING) {
      setElapsedTime(0);
      interval = setInterval(() => { setCurrentStepIdx(prev => (prev + 1) % ANALYSIS_STEPS.length); }, 2000);
      timer = setInterval(() => { setElapsedTime(prev => prev + 1); }, 1000);
    }
    return () => { clearInterval(interval); clearInterval(timer); };
  }, [status]);

  const addLog = useCallback((msg: string) => { setLoadingLogs(prev => [...prev, { message: msg, timestamp: Date.now() }]); }, []);
  const handleSavePersona = (newP: UserPersona) => { setPersona(newP); localStorage.setItem('sales_persona_v2', JSON.stringify(newP)); };

  const processAnalysis = async (method: () => Promise<AnalysisResult>) => {
    setLastAction(() => method); setStatus(AppStatus.ANALYZING); setLoadingLogs([]); setErrorMsg(''); setIsServerBusy(false);
    try { 
      const data = await method(); 
      setResult(data); 
      setStatus(AppStatus.SUCCESS); 
    } catch (err: any) {
      const msg = String(err.message || err);
      const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
      setIsServerBusy(isQuota);
      setErrorMsg(isQuota ? "API 할당량 초과 (잠시 후 다시 시도)" : (err.message || '분석 오류 발생'));
      setStatus(AppStatus.ERROR);
    }
  };

  return (
    <AuthGate>
      <div className="min-h-screen bg-[#020617] text-slate-200 font-sans">
        <header className="sticky top-0 z-[60] w-full border-b border-white/5 bg-[#020617]/90 backdrop-blur-xl px-4 sm:px-12 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => { setStatus(AppStatus.IDLE); setResult(null); }}>
             <div className="w-8 h-8 sm:w-9 sm:h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 20V4m-6 16v-6m12 6V10" /></svg>
             </div>
             <div className="flex flex-col">
              <h1 className="text-xs sm:text-lg font-black text-white tracking-tighter uppercase leading-none">SALES <span className="text-cyan-400">DIAGNOSTICS</span></h1>
              <span className="text-[7px] sm:text-[10px] font-bold text-slate-500 tracking-[0.2em] mt-0.5 uppercase">Professional AI Edition V2.2</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-900/80 rounded-full p-1 border border-white/5">
                  <button onClick={() => setFeedbackMode('softened')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${feedbackMode === 'softened' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Soft Advice</button>
                  <button onClick={() => setFeedbackMode('merciless')} className={`px-4 py-1.5 rounded-full text-[10px] font-black transition-all ${feedbackMode === 'merciless' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}>Hard-hitting</button>
              </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {status === AppStatus.IDLE && (
            <div className="flex flex-col items-center gap-10">
              <div className="w-full flex flex-col items-center relative">
                  <div className="flex flex-col lg:flex-row items-center justify-center w-full max-w-4xl gap-6 sm:gap-8 mb-10">
                      <nav className="flex p-1 bg-slate-900/50 rounded-2xl border border-white/5 shadow-xl w-full max-w-lg">
                          {[
                              { id: 'PRE_MEETING', label: '미팅 전략' },
                              { id: 'SALES_ANALYSIS', label: '세일즈 진단' },
                              { id: 'AI_COACH', label: 'AI 코치' }
                          ].map((tab) => (
                              <button key={tab.id} onClick={() => setMainTab(tab.id as MainTab)} className={`flex-1 py-2.5 sm:py-3 rounded-xl text-[10px] sm:text-xs font-black transition-all ${mainTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/5'}`}>{tab.label}</button>
                          ))}
                      </nav>

                      <div className="lg:absolute lg:right-0 flex flex-col items-center">
                          <button onClick={() => setIsPersonaModalOpen(true)} className="group relative flex flex-col items-center transition-all duration-500 hover:scale-110 active:scale-95">
                              <div className="absolute inset-0 bg-purple-600/30 blur-[25px] rounded-full scale-110 opacity-60 group-hover:opacity-100 transition-opacity"></div>
                              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-[1.5px] shadow-[0_0_20px_rgba(168,85,247,0.3)] overflow-hidden">
                                  <div className="w-full h-full rounded-full bg-gradient-to-b from-[#6366f1] via-[#4c1d95] to-[#1e1b4b] flex flex-col items-center justify-center relative">
                                      <div className="mb-0">
                                          <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                          </svg>
                                      </div>
                                      <div className="flex flex-col items-center">
                                          <span className="text-[7px] sm:text-[8.5px] font-black text-white leading-none uppercase">MY PERSONA</span>
                                          <span className="text-[5px] sm:text-[6.5px] font-bold text-cyan-400 mt-0.5 uppercase">AI CORE</span>
                                      </div>
                                      <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-40"></div>
                                  </div>
                              </div>
                              <span className="mt-2 text-[8px] sm:text-[9px] font-black text-cyan-400 uppercase tracking-[0.4em] drop-shadow-[0_0_6px_rgba(34,211,238,0.5)]">{persona.name || 'PREMIUM EXPERT'}</span>
                          </button>
                      </div>
                  </div>

                  <div className="w-full max-w-4xl">
                    {mainTab === 'PRE_MEETING' && <PreMeetingView persona={persona} mode={feedbackMode} />}
                    {mainTab === 'SALES_ANALYSIS' && <FileUpload onFileSelect={(f) => processAnalysis(() => analyzeSalesFile(f, persona, feedbackMode, addLog))} onScriptSelect={(s) => processAnalysis(() => analyzeSalesText(s, persona, feedbackMode, addLog))} />}
                    {mainTab === 'AI_COACH' && <ChatInterface persona={persona} mode={feedbackMode} />}
                  </div>
              </div>
            </div>
          )}

          {status === AppStatus.ANALYZING && (
            <div className="py-20 flex flex-col items-center text-center">
              <div className={`w-24 h-24 border-4 rounded-full animate-spin mb-8 ${feedbackMode === 'merciless' ? 'border-rose-500/10 border-t-rose-500' : 'border-indigo-500/10 border-t-indigo-500'}`}></div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-4">{feedbackMode === 'merciless' ? '냉혹한 심층 분석 중' : '심층 분석 엔진 가동 중'}</h2>
              <p className="text-indigo-400 font-bold">{ANALYSIS_STEPS[currentStepIdx]}</p>
            </div>
          )}

          {status === AppStatus.SUCCESS && result && <AnalysisView result={result} onReset={() => setStatus(AppStatus.IDLE)} mode={feedbackMode} />}
          {status === AppStatus.ERROR && (
            <div className="py-20 text-center">
              <h2 className="text-white mb-6 font-black uppercase tracking-tight">분석에 실패했습니다</h2>
              <div className="bg-slate-900/60 p-6 rounded-2xl border border-white/5 mb-10"><p className="text-slate-300 text-sm">{errorMsg}</p></div>
              <button onClick={handleRetry} className="w-full max-w-xs py-4 bg-indigo-600 rounded-xl font-black">다시 시도</button>
            </div>
          )}
        </main>

        <PersonaSettings isOpen={isPersonaModalOpen} onClose={() => setIsPersonaModalOpen(false)} onSave={handleSavePersona} initialData={persona} />
      </div>
    </AuthGate>
  );
}

export default App;
