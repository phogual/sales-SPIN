import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, PersuasionAudit, CharlieMorganInsight, CialdiniInsight, FeedbackMode } from '../types';
import { PieChart, Pie, Cell } from 'recharts';

interface AnalysisViewProps {
  result: AnalysisResult;
  onReset: () => void;
  mode?: FeedbackMode;
}

const getDynamicFontSize = (text: string = '', baseSize: number, minSize: number, maxLength: number) => {
  const len = text ? text.length : 0;
  if (len === 0) return `${baseSize}px`;
  if (len < maxLength * 0.4) return `${baseSize * 1.2}px`;
  if (len <= maxLength) return `${baseSize}px`;
  const ratio = Math.max(minSize / baseSize, 1 - (len - maxLength) / (maxLength * 1.5));
  return `${baseSize * ratio}px`;
};

const formatScore = (score: any): number => {
    const num = Number(score);
    if (isNaN(num)) return 0;
    if (num > 0 && num <= 10) return num * 10;
    return num;
};

const stripTags = (text: string) => text.replace(/\s*\([^)]+\)$/, '').trim();

/**
 * [수정] QuestionList: 1~7페이지에서는 눈 보호를 위해 무조건 다크 테마를 유지합니다.
 */
const QuestionList: React.FC<{ title: string; questions: { original: string; betterVersion: string }[]; analysis: string; color: string; label: string; mode?: FeedbackMode }> = ({ title, questions, analysis, color, label, mode }) => {
    // 마지막 페이지가 아니므로 isMerciless를 false로 강제하여 다크 테마 유지
    const isMercilessEffect = false; 
    const finalColor = color;
    const dotColor = color.replace('text-', 'bg-');

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h4 className={`text-[20px] font-black uppercase tracking-tighter flex items-center gap-2.5 ${finalColor}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span> {title} <span className="text-[12px] opacity-60 ml-1">({label})</span>
                </h4>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{(questions || []).length} ITEMS</span>
            </div>
            
            <div className="bg-white/5 border-white/5 p-4 rounded-[25px] border">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">잘못된 점 및 조언 (Critique & Advice)</span>
                </div>
                <p className="text-slate-200 text-[14px] leading-relaxed font-medium italic">
                    {analysis || "분석 데이터가 없습니다."}
                </p>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {(questions || []).map((q, i) => (
                    <div key={i} className="bg-white/5 border-white/5 p-4 rounded-2xl border shrink-0">
                        <div className="flex gap-2.5 items-start">
                            <span className={`text-[14px] font-black opacity-30 mt-0.5 shrink-0 ${finalColor}`}>{i + 1}</span>
                            <p className="text-slate-100 font-bold leading-tight italic text-[15px]">“{stripTags(q.original)}”</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const QuestioningAnalysisPage: React.FC<{ 
    title: string; 
    catTitle: string; 
    catLabel: string;
    catQuestions: { original: string; betterVersion: string }[]; 
    catAnalysis: string;
    catColor: string;
    counts: any;
    total: number;
    activeCat: 'S' | 'P' | 'I' | 'N';
    mode?: FeedbackMode;
}> = ({ title, catTitle, catLabel, catQuestions, catAnalysis, catColor, counts, total, activeCat, mode }) => {
    const data = [
        { name: 'S', value: counts?.situation || 0, color: '#00ffff' }, 
        { name: 'P', value: counts?.problem || 0, color: '#3b82f6' }, 
        { name: 'I', value: counts?.implication || 0, color: '#a855f7' }, 
        { name: 'N', value: counts?.needPayoff || 0, color: '#ff2d55' }
    ];

    const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value }: any) => {
        if (value === 0) return null;
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 20;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill={data[index].color} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[14px] font-black italic">
                {data[index].name} ({value})
            </text>
        );
    };

    return (
        <div className="flex flex-col gap-4 h-full overflow-hidden">
            <h2 className="text-[28px] font-black text-white italic tracking-tighter uppercase border-b-2 border-white/10 pb-2 shrink-0">{title}</h2>
            <div className="flex gap-6 flex-1 overflow-hidden items-stretch">
                <div className="w-[360px] flex flex-col gap-4 shrink-0 py-1">
                    <div className="bg-[#0b1018] p-4 rounded-[40px] border border-white/5 relative shadow-2xl flex flex-col items-center justify-center aspect-square shrink-0">
                        <div className="w-[300px] h-[300px] relative">
                            <PieChart width={300} height={300}>
                                <Pie data={data} innerRadius={55} outerRadius={80} paddingAngle={6} dataKey="value" stroke="#0b1018" strokeWidth={3} isAnimationActive={false} label={renderCustomizedLabel}>
                                    { data.map((entry, i) => <Cell key={i} fill={entry.color} />) }
                                </Pie>
                            </PieChart>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-[42px] font-black text-white leading-none tracking-tighter italic">{total}</span>
                                <span className="text-[8px] font-black text-slate-500 tracking-[0.3em] uppercase">TOTAL QS</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 px-2">
                        {[
                            { id: 'S', label: 'SITUATION', count: counts?.situation || 0, color: 'bg-[#00ffff]' },
                            { id: 'P', label: 'PROBLEM', count: counts?.problem || 0, color: 'bg-[#3b82f6]' },
                            { id: 'I', label: 'IMPLICATION', count: counts?.implication || 0, color: 'bg-[#a855f7]' },
                            { id: 'N', label: 'NEED-PAYOFF', count: counts?.needPayoff || 0, color: 'bg-[#ff2d55]' }
                        ].map((item, i) => (
                            <div key={i} className={`flex justify-between items-center border-b border-white/5 pb-1 transition-all duration-300 ${item.id === activeCat ? 'opacity-100 scale-105' : 'opacity-60'}`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                                    <span className={`text-[11px] font-black tracking-widest ${item.id === activeCat ? 'text-white' : 'text-slate-400'}`}>{item.label}</span>
                                </div>
                                <span className={`text-[16px] font-black italic ${item.id === activeCat ? 'text-white' : 'text-slate-400'}`}>{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    <div className="bg-slate-900/30 p-5 rounded-[30px] border border-white/5 flex-1 flex flex-col overflow-hidden shadow-inner">
                        <QuestionList title={catTitle} label={catLabel} questions={catQuestions} analysis={catAnalysis} color={catColor} mode={mode} />
                    </div>
                    <div className="bg-indigo-600/10 border-indigo-500/20 p-3 rounded-xl border shrink-0">
                        <p className="text-[12px] text-slate-300 leading-tight italic">
                            <span className="text-indigo-400 font-black uppercase tracking-wider">Strategy Tip:</span> {activeCat === 'S' ? '상황 파악은 최소화하고 빠르게 고객의 고통(P)으로 진입하십시오.' : activeCat === 'P' ? '표면적인 문제보다 고객이 숨기고 있는 심층적인 고통을 건드리십시오.' : activeCat === 'I' ? '문제를 해결하지 않았을 때의 기회비용을 극대화하여 시각화하십시오.' : '고객 스스로 솔루션의 가치를 입을 열어 말하게 유도하십시오.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * [수정] StrategicFeedbackPage: 마지막 페이지이므로 하드 모드일 때 빨간색 테마를 화려하게 적용합니다.
 */
const StrategicFeedbackPage: React.FC<{ mistakes: string[]; approaches: string[]; mode?: FeedbackMode }> = ({ mistakes, approaches, mode }) => {
    const isMerciless = mode === 'merciless';
    const accentColor = isMerciless ? 'text-rose-500' : 'text-indigo-500';
    const itemBg = isMerciless ? 'bg-black/60' : 'bg-indigo-500/5';
    const itemBorder = isMerciless ? 'border-rose-500/30' : 'border-indigo-500/20';

    return (
        <div className="flex flex-col gap-8 h-full relative">
            <div className="flex justify-between items-start">
                <h2 className={`text-[48px] font-black italic tracking-tighter uppercase leading-none`}>
                    <span className={isMerciless ? 'text-rose-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'text-indigo-500'}>{isMerciless ? 'Merciless' : 'Strategic'}</span> <span className="text-white">Feedback</span>
                </h2>
                <div className="text-right pt-1">
                    <span className={`text-[12px] ${isMerciless ? 'text-rose-500' : 'text-slate-500'} font-black uppercase tracking-[0.3em] mb-1 block`}>
                        {isMerciless ? '독설적 통찰 (BONE-HITTING)' : '핵심적 통찰 (CORE INSIGHT)'}
                    </span>
                    <div className={`${isMerciless ? 'bg-rose-600/20 border-rose-500' : 'bg-indigo-500/10 border-indigo-500/20'} px-8 py-2.5 rounded-full border-2 text-[12px] font-black ${isMerciless ? 'text-rose-500' : 'text-indigo-500'} uppercase tracking-widest italic shadow-lg`}>
                        {isMerciless ? 'CRITICAL REALITY CHECK' : 'CORE IMPROVEMENT ADVICE'}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8 flex-1 overflow-hidden">
                <div className="flex flex-col gap-5">
                    <h3 className={`text-[16px] font-black uppercase tracking-[0.5em] border-l-4 ${isMerciless ? 'border-rose-600 text-rose-500' : 'border-indigo-500 text-slate-500'} pl-5`}>
                        {isMerciless ? '치명적 패착 (CRITICAL MISTAKES)' : '핵심 개선 과제 (CORE IMPROVEMENTS)'}
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {(mistakes || []).slice(0, 3).map((m, i) => (
                            <div key={i} className={`${itemBg} p-6 rounded-[30px] border-2 ${itemBorder} flex items-start gap-6 shadow-2xl relative overflow-hidden group`}>
                                {isMerciless && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-600 group-hover:w-full transition-all duration-500 opacity-10"></div>}
                                <span className={`${isMerciless ? 'text-rose-600' : accentColor} font-black text-3xl italic shrink-0`}>{i+1}</span>
                                <p className="text-slate-100 font-bold italic text-xl leading-relaxed z-10">{m}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    <h3 className={`text-[16px] font-black uppercase tracking-[0.5em] border-l-4 ${isMerciless ? 'border-rose-600 text-rose-500' : 'border-emerald-500 text-slate-500'} pl-5`}>
                        {isMerciless ? '생존을 위한 업그레이드 (SURVIVAL PATH)' : '업그레이드 솔루션 (UPGRADE PATH)'}
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {(approaches || []).slice(0, 2).map((a, i) => (
                            <div key={i} className={`${itemBg} p-6 rounded-[30px] border-2 ${itemBorder} flex items-start gap-6 shadow-2xl relative overflow-hidden group`}>
                                {isMerciless && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600 group-hover:w-full transition-all duration-500 opacity-10"></div>}
                                <span className="text-emerald-500 font-black text-3xl italic shrink-0">{i+1}</span>
                                <p className="text-slate-100 font-bold italic text-xl leading-relaxed z-10">{a}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={`mt-auto ${isMerciless ? 'bg-rose-700' : 'bg-indigo-600'} p-8 rounded-[40px] shadow-2xl border-2 border-white/10`}>
                <p className="text-white font-black text-center text-[22px] tracking-tight uppercase italic leading-tight">
                    {isMerciless ? '“피드백은 아프지만, 성장은 그 고통의 끝에서 시작됩니다.”' : '“건설적인 피드백은 성장의 가장 빠른 지름길입니다.”'}
                </p>
            </div>
        </div>
    );
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, onReset, mode }) => {
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [scale, setScale] = useState(1);
  const [editableName, setEditableName] = useState(result?.contactInfo?.name || '분석 대상자');
  const TOTAL_PAGES = 8; // 6-7페이지 삭제로 최종 8페이지 구성

  const pageRefs = [
      useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), 
      useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), 
      useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)
  ];

  useEffect(() => {
    const updateScale = () => {
      const containerWidth = window.innerWidth - 32; 
      setScale(containerWidth < 1131 ? containerWidth / 1131 : 1);
    };
    window.addEventListener('resize', updateScale);
    updateScale();
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  const handleDownloadPDF = async () => {
    const html2canvas = (window as any).html2canvas;
    const jspdfObj = (window as any).jspdf;
    if (!html2canvas || !jspdfObj || isPdfGenerating) return;
    setIsPdfGenerating(true);
    setPdfProgress(0);
    try {
      const pdf = new jspdfObj.jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });
      for (let i = 0; i < TOTAL_PAGES; i++) {
        setPdfProgress(i + 1);
        await new Promise(r => setTimeout(r, 700));
        const element = document.getElementById(`pdf-page-${i}`);
        if (!element) continue;
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0b0e14', useCORS: true, logging: false });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
      }
      pdf.save(`Sales_Diagnosis_${editableName}.pdf`);
    } catch (e) { console.error(e); } finally { setIsPdfGenerating(false); setPdfProgress(0); }
  };

  /**
   * [수정] PageWrapper: merciless 모드여도 마지막 페이지만 특수 테마(레드)를 적용합니다.
   */
  const PageWrapper = ({ children, index }: React.PropsWithChildren<{ index: number }>) => {
    const isMerciless = mode === 'merciless';
    const isLastPage = index === TOTAL_PAGES - 1;
    
    // merciless 모드일지라도 마지막 8페이지가 아니면 기본 다크 테마 유지
    const bgClass = (isMerciless && isLastPage) ? 'bg-[#000000]' : 'bg-[#0b0e14]';
    const borderStyle = (isMerciless && isLastPage) ? '12px solid #e11d48' : 'none';
    
    return (
      <div className="flex justify-center w-full mb-10" style={{ height: `${800 * scale}px` }}>
        <div 
          id={`pdf-page-${index}`}
          ref={pageRefs[index]}
          className={`${bgClass} text-white overflow-hidden shadow-2xl relative flex flex-col origin-top shrink-0 transition-colors duration-500`} 
          style={{ 
            width: '1131px', height: '800px', transform: `scale(${scale})`,
            border: borderStyle
          }}
        >
          {isMerciless && isLastPage && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#e11d4830_0%,transparent_70%)]"></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.08] flex items-center justify-center">
                    <span className="text-[400px] font-black italic rotate-[-15deg] whitespace-nowrap text-rose-600 tracking-tighter">MERCILESS</span>
                </div>
                <div className="absolute top-0 right-0 w-40 h-40 overflow-hidden">
                    <div className="absolute top-8 -right-10 w-64 h-10 bg-rose-600 rotate-45 flex items-center justify-center shadow-lg">
                        <span className="text-[12px] font-black text-white tracking-widest uppercase italic">FINAL VERDICT</span>
                    </div>
                </div>
            </div>
          )}
          <div className="flex-1 flex flex-col p-[50px] relative z-10">{children}</div>
          <div className={`h-[40px] flex items-center justify-between px-[50px] ${isMerciless && isLastPage ? 'bg-rose-950' : 'bg-[#0b1018]'} border-t border-white/5`}>
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-500">세일즈 인텔리전스 엔진 V2.2</span>
            <span className="text-[10px] font-black tracking-widest uppercase italic text-slate-500">PAGE {index + 1} / {TOTAL_PAGES}</span>
          </div>
        </div>
      </div>
    );
  };

  const totalQs = (result?.spinCounts?.situation || 0) + (result?.spinCounts?.problem || 0) + (result?.spinCounts?.implication || 0) + (result?.spinCounts?.needPayoff || 0);

  return (
    <div className="w-full max-w-[1150px] mx-auto pb-32 px-4">
      {/* 상단 툴바 */}
      <div className="flex justify-between items-center bg-slate-900/95 p-5 rounded-3xl border border-white/10 sticky top-4 z-[500] backdrop-blur-xl mb-16 shadow-2xl">
        <div className="flex flex-col gap-1 w-full max-w-xs">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">분석 대상자</span>
            <input type="text" value={editableName} onChange={(e) => setEditableName(e.target.value)} className="bg-slate-950/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none w-full" />
        </div>
        <div className="flex gap-2">
            <button onClick={handleDownloadPDF} disabled={isPdfGenerating} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-black text-white uppercase min-w-[120px]">
              {isPdfGenerating ? `Page ${pdfProgress}/${TOTAL_PAGES}...` : 'Save PDF'}
            </button>
            <button onClick={onReset} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 border border-white/10">Close</button>
        </div>
      </div>

      {/* 1페이지: 인트로 */}
      <PageWrapper index={0}>
        <div className="flex justify-between items-start mb-10">
            <div className="flex flex-col">
                <h1 className="text-[64px] font-black text-white leading-[0.9] tracking-tighter uppercase">Sales</h1>
                <h1 className="text-[64px] font-black text-indigo-500 leading-[0.9] tracking-tighter uppercase">Diagnosis</h1>
                <div className="h-1 w-20 bg-indigo-500 mt-4"></div>
                <span className="text-[12px] font-black text-indigo-400 uppercase tracking-[0.4em] mt-2 italic">세일즈 정밀 진단</span>
            </div>
            <div className="text-right pt-2 pr-1">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1 block">PROFESSIONAL PROFILE</span>
                <div className="text-xl font-black text-white italic tracking-tight">{editableName}</div>
            </div>
        </div>
        <div className="grid grid-cols-12 gap-10 flex-1 items-center">
            <div className="col-span-5 flex flex-col items-center justify-center">
                <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-[25px] border-indigo-500/10"></div>
                    <div className="absolute inset-0 rounded-full border-[25px] border-indigo-500 border-t-transparent border-r-transparent transform -rotate-45"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[90px] font-black text-white leading-none tracking-tighter italic">{formatScore(result?.spinScore || 0)}</span>
                        <div className="bg-indigo-600 px-8 py-1.5 rounded-full mt-2 shadow-lg"><span className="text-[12px] font-black text-white uppercase tracking-widest italic">SPIN SCORE</span></div>
                    </div>
                </div>
            </div>
            <div className="col-span-7 flex flex-col gap-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-1.5 h-6 bg-indigo-500"></div>
                    <h3 className="text-[14px] font-black text-slate-400 uppercase tracking-[0.4em]">CORE STRENGTHS</h3>
                </div>
                <div className="flex flex-col gap-3">
                    {(result?.strengths || []).slice(0, 4).map((s, i) => (
                        <div key={i} className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex items-start gap-4 shadow-sm">
                            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <p className="text-slate-200 text-[13px] leading-relaxed font-medium italic">{s}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </PageWrapper>

      {/* 2-5페이지: SPIN 단계 분석 */}
      <PageWrapper index={1}>
        <QuestioningAnalysisPage title="SPIN 질문" catTitle="상황 파악" catLabel="Situation" catQuestions={result?.spinQuestions?.situation || []} catAnalysis={result?.spinAnalysis?.situation || ""} catColor="text-cyan-400" counts={result?.spinCounts} total={totalQs} activeCat="S" mode={mode} />
      </PageWrapper>
      <PageWrapper index={2}>
        <QuestioningAnalysisPage title="SPIN 질문 (Cont.)" catTitle="문제 탐색" catLabel="Problem" catQuestions={result?.spinQuestions?.problem || []} catAnalysis={result?.spinAnalysis?.problem || ""} catColor="text-blue-500" counts={result?.spinCounts} total={totalQs} activeCat="P" mode={mode} />
      </PageWrapper>
      <PageWrapper index={3}>
        <QuestioningAnalysisPage title="SPIN 질문 (Cont.)" catTitle="시사점 도출" catLabel="Implication" catQuestions={result?.spinQuestions?.implication || []} catAnalysis={result?.spinAnalysis?.implication || ""} catColor="text-violet-500" counts={result?.spinCounts} total={totalQs} activeCat="I" mode={mode} />
      </PageWrapper>
      <PageWrapper index={4}>
        <QuestioningAnalysisPage title="SPIN 질문 (Cont.)" catTitle="가치 확인" catLabel="Need-Payoff" catQuestions={result?.spinQuestions?.needPayoff || []} catAnalysis={result?.spinAnalysis?.needPayoff || ""} catColor="text-pink-500" counts={result?.spinCounts} total={totalQs} activeCat="N" mode={mode} />
      </PageWrapper>

      {/* 6페이지: 전략 팁 (기존 7페이지) */}
      <PageWrapper index={5}>
        <div className="flex flex-col h-full bg-[#0b1018] border-emerald-500/20 rounded-[40px] border-2 p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-emerald-500/50"></div>
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4">
                    <div className="w-2 h-8 bg-emerald-500 rounded-full"></div>
                    <h2 className="text-[28px] font-black text-emerald-400 uppercase tracking-tight italic">핵심 미팅 전략 팁</h2>
                </div>
                <div className="flex flex-col gap-8 mt-4">
                    {(result?.betterApproaches || result?.keyMistakes || []).slice(0, 4).map((tip, i) => (
                        <div key={i} className="flex gap-6 items-start group">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981] mt-2.5 shrink-0 transition-transform group-hover:scale-125"></div>
                            <p className="text-slate-200 font-medium leading-relaxed italic text-[20px] group-hover:text-white transition-colors">{tip}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="mt-auto pt-10 border-t border-white/5 flex justify-center">
                <p className="text-[12px] font-black text-emerald-500/40 uppercase tracking-[0.5em] italic">Strategic Action Plan</p>
            </div>
        </div>
      </PageWrapper>

      {/* 7페이지: 성장 포인트 및 스크립트 (기존 8-9페이지 통합) */}
      <PageWrapper index={6}>
        <div className="flex flex-col h-full gap-8">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3"><h2 className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.3em]">전략적 성장 포인트 (GROWTH POINTS)</h2></div>
                <div className="flex flex-col gap-3">
                    {(result?.growthPoints || []).slice(0, 2).map((p, i) => (
                        <div key={i} className="bg-[#0f172a] p-6 rounded-[25px] border border-white/5 flex items-center gap-6 shadow-xl">
                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                                <svg className="w-7 h-7 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                            </div>
                            <div className="flex flex-col gap-1">
                                <h4 className="text-[18px] font-black text-white italic">{p.title}</h4>
                                <p className="text-slate-300 text-[14px] leading-relaxed font-medium italic">{p.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-4">
                <h2 className="text-[16px] font-black text-cyan-400 uppercase tracking-widest">마스터를 위한 권장 스크립트</h2>
                <div className="flex flex-col gap-4">
                    {(result?.recommendedScripts || []).slice(0, 2).map((s, i) => (
                        <div key={i} className="flex flex-col gap-2">
                            <div className="flex"><span className="px-3 py-1 rounded-lg bg-cyan-500/10 border-cyan-500/20 text-cyan-400 font-black text-[9px] uppercase tracking-widest italic">추천 화법 (RECOMMENDED)</span></div>
                            <div className="bg-[#0f172a] p-6 rounded-[30px] border-2 border-white/5 relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 left-0 w-2 h-full bg-cyan-500/40"></div>
                                <p className="text-white font-black text-[20px] leading-snug italic tracking-tight">“{s.script}”</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </PageWrapper>

      {/* 8페이지: 최종 피드백 (여기서만 하드 모드 레드 테마 발동) */}
      <PageWrapper index={7}>
        <StrategicFeedbackPage mistakes={result?.keyMistakes || []} approaches={result?.betterApproaches || []} mode={mode} />
      </PageWrapper>
    </div>
  );
};
