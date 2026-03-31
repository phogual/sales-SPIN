
import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, PersuasionAudit, CharlieMorganInsight, CialdiniInsight, FeedbackMode } from '../types';
import { PieChart, Pie, Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis } from 'recharts';

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

const ModuleHeader: React.FC<{ title: string; subtitle: string; color: string; bgColor: string; mode?: FeedbackMode }> = ({ title, subtitle, color, bgColor, mode }) => {
    const isMerciless = mode === 'merciless';
    const finalColor = isMerciless ? 'text-rose-500' : color;
    const finalBgColor = isMerciless ? 'bg-rose-600' : bgColor;
    
    return (
        <div className="flex justify-between items-end border-b-2 border-white/10 pb-2 mb-4 shrink-0">
            <div className="flex items-center gap-4">
                <div className={`w-1.5 h-7 ${finalBgColor} rounded-full shadow-[0_0_10px_rgba(225,29,72,0.3)]`}></div>
                <div className="flex flex-col">
                    <h2 className="text-[26px] font-black text-white uppercase tracking-tighter leading-none">{title}</h2>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">{subtitle}</span>
                </div>
            </div>
            <div className="flex flex-col items-end">
                <span className={`text-[10px] font-black tracking-[0.2em] uppercase italic ${finalColor}`}>{isMerciless ? '냉혹한 전략 분석' : '전략 분석 모듈'}</span>
            </div>
        </div>
    );
};

const AuditCard: React.FC<{ audit: PersuasionAudit; mode?: FeedbackMode }> = ({ audit, mode }) => {
    const isMerciless = mode === 'merciless';
    const accentColor = isMerciless ? 'text-rose-500' : 'text-indigo-400';
    const bgColor = isMerciless ? 'bg-rose-600/40' : 'bg-indigo-500/40';
    const badgeColor = isMerciless ? 'text-rose-400' : 'text-indigo-400';
    const badgeBg = isMerciless ? 'bg-rose-500/10' : 'bg-indigo-500/10';
    const badgeBorder = isMerciless ? 'border-rose-500/20' : 'border-indigo-500/20';

    return (
        <div className="flex flex-col bg-slate-900/40 p-6 rounded-[25px] border border-white/5 relative overflow-hidden h-full shadow-lg">
            <div className={`absolute top-0 left-0 w-1.5 h-full ${bgColor}`}></div>
            <div className="flex justify-between items-start mb-3">
                <span className={`text-[12px] font-black ${accentColor} uppercase tracking-tighter`}>{audit?.principle || "원칙"}</span>
                <div className={`${badgeBg} px-3 py-1 rounded-lg border ${badgeBorder}`}>
                    <span className={`text-[10px] font-black ${badgeColor} uppercase tracking-widest`}>{isMerciless ? 'CRITICAL AUDIT' : 'AUDIT PASS'}</span>
                </div>
            </div>
            <div className="space-y-4 flex-1 flex flex-col justify-center overflow-hidden">
                <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest border-l-2 border-slate-700 pl-2 leading-none">추출된 스크립트</span>
                    <p className="font-medium italic leading-relaxed pl-2 text-slate-300" style={{ fontSize: getDynamicFontSize(audit?.detectedAction, 14, 10, 70) }}>“{audit?.detectedAction || "분석 내용 없음"}”</p>
                </div>
                <div className="flex flex-col gap-1.5 pt-2.5 border-t border-white/5">
                    <span className={`text-[9px] font-black ${isMerciless ? 'text-rose-500' : 'text-indigo-500'} uppercase tracking-widest border-l-2 ${isMerciless ? 'border-rose-800' : 'border-indigo-800'} pl-2 leading-none`}>개선 제안</span>
                    <p className="font-bold leading-snug pl-2 text-white" style={{ fontSize: getDynamicFontSize(audit?.improvement, 17, 12, 90) }}>{audit?.improvement || "개선 방안 준비 중"}</p>
                </div>
            </div>
        </div>
    );
};

const stripTags = (text: string) => text.replace(/\s*\([^)]+\)$/, '').trim();

const QuestionList: React.FC<{ title: string; questions: { original: string; betterVersion: string }[]; analysis: string; color: string; label: string; mode?: FeedbackMode }> = ({ title, questions, analysis, color, label, mode }) => {
    const isMerciless = mode === 'merciless';
    const finalColor = isMerciless ? 'text-rose-500' : color;
    const dotColor = isMerciless ? 'bg-rose-500' : color.replace('text-', 'bg-');

    return (
        <div className="flex flex-col gap-4 h-full">
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
                <h4 className={`text-[20px] font-black uppercase tracking-tighter flex items-center gap-2.5 ${finalColor}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span> {title} <span className="text-[12px] opacity-60 ml-1">({label})</span>
                </h4>
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{(questions || []).length} ITEMS</span>
            </div>
            
            {/* Critique & Advice */}
            <div className={`${isMerciless ? 'bg-rose-950/20 border-rose-500/20' : 'bg-white/5 border-white/5'} p-4 rounded-[25px] border`}>
                <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-black ${isMerciless ? 'text-rose-500' : 'text-indigo-500'} uppercase tracking-widest`}>
                        {isMerciless ? '냉혹한 비평 및 조언 (Merciless Critique)' : '잘못된 점 및 조언 (Critique & Advice)'}
                    </span>
                </div>
                <p className="text-slate-200 text-[14px] leading-relaxed font-medium italic">
                    {analysis || "분석 데이터가 없습니다."}
                </p>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                {(questions || []).map((q, i) => (
                    <div key={i} className={`${isMerciless ? 'bg-rose-900/10 border-rose-500/10' : 'bg-white/5 border-white/5'} p-4 rounded-2xl border shrink-0`}>
                        <div className="flex gap-2.5 items-start">
                            <span className={`text-[14px] font-black opacity-30 mt-0.5 shrink-0 ${finalColor}`}>{i + 1}</span>
                            <p className="text-slate-100 font-bold leading-tight italic text-[15px]">“{stripTags(q.original)}”</p>
                        </div>
                    </div>
                ))}
                {(!questions || questions.length === 0) && <p className="text-slate-600 italic text-sm pl-2">분석된 데이터가 없습니다.</p>}
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
    const isMerciless = mode === 'merciless';
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
        const color = data[index].color;

        return (
            <text x={x} y={y} fill={color} textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[14px] font-black italic">
                {data[index].name} ({value})
            </text>
        );
    };

    return (
        <div className="flex flex-col gap-4 h-full overflow-hidden">
            <h2 className={`text-[28px] font-black ${isMerciless ? 'text-rose-500' : 'text-white'} italic tracking-tighter uppercase border-b-2 border-white/10 pb-2 shrink-0`}>{title}</h2>
            <div className="flex gap-6 flex-1 overflow-hidden items-stretch">
                {/* Left: Graph Column */}
                <div className="w-[360px] flex flex-col gap-4 shrink-0 py-1">
                    <div className={`bg-[#0b1018] p-4 rounded-[40px] border ${isMerciless ? 'border-rose-500/30' : 'border-white/5'} relative shadow-2xl flex flex-col items-center justify-center aspect-square shrink-0 overflow-visible`}>
                        <div className="w-[300px] h-[300px] relative">
                            <PieChart width={300} height={300}>
                                <Pie 
                                    data={data} 
                                    innerRadius={55} 
                                    outerRadius={80} 
                                    paddingAngle={6} 
                                    dataKey="value" 
                                    stroke="#0b1018"
                                    strokeWidth={3}
                                    isAnimationActive={false}
                                    label={renderCustomizedLabel}
                                    labelLine={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
                                >
                                    { data.map((entry, i) => (
                                        <Cell 
                                            key={i} 
                                            fill={entry.color} 
                                            opacity={1}
                                        />
                                    )) }
                                </Pie>
                            </PieChart>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className={`text-[42px] font-black ${isMerciless ? 'text-rose-500' : 'text-white'} leading-none tracking-tighter italic`}>{total}</span>
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
                                    <div className={`w-2 h-2 rounded-full ${item.color} shadow-[0_0_12px_rgba(0,255,255,0.4)]`}></div>
                                    <span className={`text-[11px] font-black tracking-widest ${item.id === activeCat ? (isMerciless ? 'text-rose-400' : 'text-white') : 'text-slate-400'}`}>{item.label}</span>
                                </div>
                                <span className={`text-[16px] font-black italic ${item.id === activeCat ? (isMerciless ? 'text-rose-500' : 'text-white') : 'text-slate-400'}`}>{item.count}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Detailed Analysis Column */}
                <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    <div className={`bg-slate-900/30 p-5 rounded-[30px] border ${isMerciless ? 'border-rose-500/20' : 'border-white/5'} flex-1 flex flex-col overflow-hidden shadow-inner`}>
                        <QuestionList 
                            title={catTitle} 
                            label={catLabel} 
                            questions={catQuestions} 
                            analysis={catAnalysis}
                            color={catColor} 
                            mode={mode}
                        />
                    </div>
                    <div className={`${isMerciless ? 'bg-rose-600/10 border-rose-500/20' : 'bg-indigo-600/10 border-indigo-500/20'} p-3 rounded-xl border shrink-0`}>
                        <p className="text-[12px] text-slate-300 leading-tight italic">
                            <span className={`${isMerciless ? 'text-rose-500' : 'text-indigo-400'} font-black uppercase tracking-wider`}>Strategy Tip:</span> {activeCat === 'S' ? '상황 파악은 최소화하고 빠르게 고객의 고통(P)으로 진입하십시오.' : 
                                                                         activeCat === 'P' ? '표면적인 문제보다 고객이 숨기고 있는 심층적인 고통을 건드리십시오.' :
                                                                         activeCat === 'I' ? '문제를 해결하지 않았을 때의 기회비용을 극대화하여 시각화하십시오.' :
                                                                         '고객 스스로 솔루션의 가치를 입을 열어 말하게 유도하십시오.'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const MentalSystemDiagnosisPage: React.FC<{ insight: CharlieMorganInsight; mode?: FeedbackMode }> = ({ insight, mode }) => {
    const isMerciless = mode === 'merciless';
    const accentColor = isMerciless ? 'text-rose-500' : 'text-indigo-500';
    const borderColor = isMerciless ? 'border-rose-500/20' : 'border-indigo-500/20';
    const badgeColor = isMerciless ? 'text-rose-500' : 'text-indigo-500';
    const badgeBg = isMerciless ? 'bg-rose-500/10' : 'bg-indigo-500/10';

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex justify-between items-start">
                <h2 className="text-[36px] font-black text-white italic tracking-tighter uppercase">{isMerciless ? '냉혹한' : '멘탈 및'} <span className={isMerciless ? 'text-rose-600' : 'text-indigo-500'}>{isMerciless ? '현실 자각' : '시스템 진단'}</span></h2>
                <div className="text-right pt-1">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-1 block">시스템 청사진</span>
                    <div className={`${badgeBg} px-6 py-2 rounded-full border-2 ${isMerciless ? 'border-rose-500/30' : 'border-indigo-500/20'} text-[11px] font-black ${badgeColor} uppercase tracking-widest italic`}>
                        {isMerciless ? 'REALITY CHECK REPORT' : 'DIAGNOSTIC REPORT'}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-8 flex-1 overflow-hidden">
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-900/40 p-10 rounded-[40px] border border-white/5 flex flex-col gap-4 shadow-lg h-1/2 overflow-hidden justify-center">
                        <h3 className={`text-[14px] font-black ${isMerciless ? 'text-rose-500' : 'text-amber-500'} uppercase tracking-[0.4em] border-l-4 ${isMerciless ? 'border-rose-600' : 'border-amber-500'} pl-4`}>심층 고통 분석 (PAIN)</h3>
                        <p className="leading-[1.6] text-slate-200 font-medium italic" style={{ fontSize: getDynamicFontSize(insight.deepPain, 18, 14, 180) }}>{insight.deepPain}</p>
                    </div>
                    <div className="bg-slate-900/40 p-10 rounded-[40px] border border-white/5 flex flex-col gap-4 shadow-lg h-1/2 overflow-hidden justify-center">
                        <h3 className={`text-[14px] font-black ${isMerciless ? 'text-rose-500' : 'text-amber-500'} uppercase tracking-[0.4em] border-l-4 ${isMerciless ? 'border-rose-600' : 'border-amber-500'} pl-4`}>현재와 미래의 격차 (GAP)</h3>
                        <p className="leading-[1.6] text-slate-200 font-medium italic" style={{ fontSize: getDynamicFontSize(insight.gapDefinition, 18, 14, 180) }}>{insight.gapDefinition}</p>
                    </div>
                </div>
                <div className={`bg-[#0b1018] p-12 rounded-[50px] border-2 ${isMerciless ? 'border-rose-600/30' : 'border-indigo-500/20'} shadow-2xl flex flex-col gap-8 overflow-hidden justify-between relative`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 ${isMerciless ? 'bg-rose-600/5' : 'bg-indigo-500/5'} rounded-full -mr-16 -mt-16 blur-3xl`}></div>
                    <div className="flex flex-col gap-4 relative z-10">
                        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">가교 전략 (THE BRIDGE)</h2>
                        <p className="leading-[1.4] text-white font-bold italic" style={{ fontSize: getDynamicFontSize(insight.bridgePositioning, 26, 20, 100) }}>“{insight.bridgePositioning}”</p>
                    </div>
                    <div className="flex flex-col gap-4 border-t-2 border-white/10 pt-8 relative z-10">
                        <h3 className={`text-[14px] font-black ${isMerciless ? 'text-rose-400' : 'text-indigo-400'} uppercase tracking-[0.4em] border-l-4 ${isMerciless ? 'border-rose-600' : 'border-indigo-500'} pl-4`}>반론 돌파 및 마인드셋 전략</h3>
                        <p className="leading-[1.5] text-slate-300 font-medium italic" style={{ fontSize: getDynamicFontSize(insight.objectionStrategy, 18, 14, 140) }}>{insight.objectionStrategy}</p>
                    </div>
                    <div className={`mt-auto ${isMerciless ? 'bg-rose-700' : 'bg-amber-600'} p-8 rounded-[30px] shadow-2xl relative z-10`}>
                        <p className="text-white font-black text-center text-[20px] tracking-tight uppercase italic leading-tight">“당신의 의지는 죄가 없습니다. 시스템을 교체하십시오.”</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StrategicFeedbackPage: React.FC<{ mistakes: string[]; approaches: string[]; mode?: FeedbackMode }> = ({ mistakes, approaches, mode }) => {
    const isMerciless = mode === 'merciless';
    const accentColor = isMerciless ? 'text-rose-500' : 'text-indigo-500';
    const bgColor = isMerciless ? 'bg-rose-500/10' : 'bg-indigo-500/10';
    const borderColor = isMerciless ? 'border-rose-500/20' : 'border-indigo-500/20';
    const itemBg = isMerciless ? 'bg-black/60' : 'bg-indigo-500/5';
    const itemBorder = isMerciless ? 'border-rose-500/30' : 'border-indigo-500/20';
    const footerBg = isMerciless ? 'bg-rose-600' : 'bg-indigo-600';

    return (
        <div className="flex flex-col gap-8 h-full relative">
            {isMerciless && (
                <div className="absolute -top-10 -right-10 opacity-20 pointer-events-none">
                    <svg className="w-40 h-40 text-rose-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                </div>
            )}
            
            <div className="flex justify-between items-start">
                <h2 className={`text-[48px] font-black italic tracking-tighter uppercase leading-none`}>
                    <span className={isMerciless ? 'text-rose-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'text-indigo-500'}>{isMerciless ? 'Merciless' : 'Strategic'}</span> <span className="text-white">Feedback</span>
                </h2>
                <div className="text-right pt-1">
                    <span className={`text-[12px] ${isMerciless ? 'text-rose-500' : 'text-slate-500'} font-black uppercase tracking-[0.3em] mb-1 block`}>
                        {isMerciless ? '독설적 통찰 (BONE-HITTING)' : '핵심적 통찰 (CORE INSIGHT)'}
                    </span>
                    <div className={`${isMerciless ? 'bg-rose-600/20' : bgColor} px-8 py-2.5 rounded-full border-2 ${isMerciless ? 'border-rose-500' : borderColor} text-[12px] font-black ${isMerciless ? 'text-rose-500' : accentColor} uppercase tracking-widest italic shadow-lg`}>
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
                            <div key={i} className={`${itemBg} p-6 rounded-[30px] border-2 ${itemBorder} flex items-start gap-6 shadow-2xl relative group overflow-hidden`}>
                                {isMerciless && <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-600 group-hover:w-full transition-all duration-500 opacity-20"></div>}
                                <span className={`${isMerciless ? 'text-rose-600' : accentColor} font-black text-3xl italic shrink-0`}>{i+1}</span>
                                <p className="text-slate-100 font-bold italic text-xl leading-relaxed relative z-10">{m}</p>
                            </div>
                        ))}
                        {(!mistakes || mistakes.length === 0) && <p className="text-slate-500 italic pl-4">추출된 데이터가 없습니다.</p>}
                    </div>
                </div>

                <div className="flex flex-col gap-5">
                    <h3 className={`text-[16px] font-black uppercase tracking-[0.5em] border-l-4 ${isMerciless ? 'border-rose-600 text-rose-500' : 'border-emerald-500 text-slate-500'} pl-5`}>
                        {isMerciless ? '생존을 위한 업그레이드 (SURVIVAL PATH)' : '업그레이드 솔루션 (UPGRADE PATH)'}
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {(approaches || []).slice(0, 2).map((a, i) => (
                            <div key={i} className={`${itemBg} p-6 rounded-[30px] border-2 ${itemBorder} flex items-start gap-6 shadow-2xl relative group overflow-hidden`}>
                                {isMerciless && <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-600 group-hover:w-full transition-all duration-500 opacity-10"></div>}
                                <span className="text-emerald-500 font-black text-3xl italic shrink-0">{i+1}</span>
                                <p className="text-slate-100 font-bold italic text-xl leading-relaxed relative z-10">{a}</p>
                            </div>
                        ))}
                        {(!approaches || approaches.length === 0) && <p className="text-slate-500 italic pl-4">추출된 솔루션 데이터가 없습니다.</p>}
                    </div>
                </div>
            </div>

            <div className={`mt-auto ${isMerciless ? 'bg-rose-700' : footerBg} p-8 rounded-[40px] shadow-[0_20px_50px_rgba(225,29,72,0.3)] border-2 border-white/10`}>
                <p className="text-white font-black text-center text-[22px] tracking-tight uppercase italic leading-tight drop-shadow-md">
                    {isMerciless ? '“피드백은 아프지만, 성장은 그 고통의 끝에서 시작됩니다.”' : '“건설적인 피드백은 성장의 가장 빠른 지름길입니다.”'}
                </p>
            </div>
        </div>
    );
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, onReset, mode }) => {
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const page3Ref = useRef<HTMLDivElement>(null);
  const page4Ref = useRef<HTMLDivElement>(null);
  const page5Ref = useRef<HTMLDivElement>(null);
  const page6Ref = useRef<HTMLDivElement>(null);
  const page7Ref = useRef<HTMLDivElement>(null);
  const page8Ref = useRef<HTMLDivElement>(null);
  const page9Ref = useRef<HTMLDivElement>(null);
  const page10Ref = useRef<HTMLDivElement>(null);
  const pageRefs = [page1Ref, page2Ref, page3Ref, page4Ref, page5Ref, page6Ref, page7Ref, page8Ref, page9Ref, page10Ref];
  const [scale, setScale] = useState(1);
  const [editableName, setEditableName] = useState(result?.contactInfo?.name || '분석 대상자');

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
    if (!html2canvas || !jspdfObj || isPdfGenerating) {
        if (!html2canvas || !jspdfObj) alert("라이브러리가 아직 로드되지 않았습니다. 잠시 후 시도해 주세요.");
        return;
    }
    
    setIsPdfGenerating(true);
    setPdfProgress(0);
    
    try {
      const pdf = new jspdfObj.jsPDF({
        orientation: 'l',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const originalScrollPos = window.scrollY;
      window.scrollTo(0, 0);

      // 순차적으로 캡처하여 메모리 부하 감소 및 안정성 확보
      for (let i = 0; i < pageRefs.length; i++) {
        setPdfProgress(i + 1);
        
        // 렌더링 및 스타일 적용 대기
        await new Promise(r => setTimeout(r, 800));
        
        const targetId = `pdf-page-${i}`;
        const element = document.getElementById(targetId);
        if (!element) {
          console.warn(`Page element not found: ${targetId}`);
          continue;
        }
        
        const canvas = await html2canvas(element, { 
          scale: 2,
          backgroundColor: '#0b0e14', 
          useCORS: true,
          logging: false,
          allowTaint: false,
          onclone: (clonedDoc) => {
            const clonedPage = clonedDoc.getElementById(targetId);
            if (clonedPage) {
              clonedPage.style.transform = 'none';
              clonedPage.style.position = 'relative';
              clonedPage.style.display = 'flex';
              clonedPage.style.visibility = 'visible';
              clonedPage.style.opacity = '1';
            }
          }
        });
        
        if (i > 0) pdf.addPage();
        
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210, undefined, 'FAST');
        
        // 메모리 해제
        canvas.width = 0;
        canvas.height = 0;
      }
      
      pdf.save(`Sales_Diagnosis_${editableName}.pdf`);
      window.scrollTo(0, originalScrollPos);
    } catch (e) { 
        console.error("PDF Error:", e);
        alert("PDF 생성 중 오류가 발생했습니다. 브라우저의 메모리가 부족할 수 있습니다.");
    } finally { 
        setIsPdfGenerating(false);
        setPdfProgress(0);
    }
  };

  const totalQs = (result?.spinCounts?.situation || 0) + (result?.spinCounts?.problem || 0) + (result?.spinCounts?.implication || 0) + (result?.spinCounts?.needPayoff || 0);
  const TOTAL_PAGES = 10;

  const PageWrapper = ({ children, index }: React.PropsWithChildren<{ index: number }>) => {
    const isMerciless = mode === 'merciless';
    const isLastPage = index === TOTAL_PAGES - 1;
    
    return (
      <div className="flex justify-center w-full mb-10" style={{ height: `${800 * scale}px` }}>
        <div 
          id={`pdf-page-${index}`}
          ref={pageRefs[index]} 
          className={`${isMerciless ? (isLastPage ? 'bg-[#000000]' : 'bg-[#0a0000]') : 'bg-[#0b0e14]'} text-white overflow-hidden shadow-2xl relative flex flex-col origin-top shrink-0 transition-colors duration-500`} 
          style={{ 
            width: '1131px', 
            height: '800px', 
            transform: `scale(${scale})`,
            border: isMerciless ? (isLastPage ? '12px solid #e11d48' : '2px solid #e11d4844') : 'none'
          }}
        >
          {isMerciless && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,${isLastPage ? '#e11d4830' : '#e11d4810'}_0%,transparent_70%)]`}></div>
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                {isLastPage && (
                    <>
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                        <div className="absolute top-0 left-0 w-full h-60 bg-gradient-to-b from-rose-600/30 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 w-full h-60 bg-gradient-to-t from-rose-600/30 to-transparent"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.08] select-none pointer-events-none flex items-center justify-center">
                            <span className="text-[400px] font-black italic rotate-[-15deg] whitespace-nowrap text-rose-600 tracking-tighter">MERCILESS</span>
                        </div>
                        <div className="absolute top-0 right-0 w-40 h-40 overflow-hidden">
                            <div className="absolute top-8 -right-10 w-64 h-10 bg-rose-600 rotate-45 flex items-center justify-center shadow-[0_0_20px_rgba(225,29,72,0.5)]">
                                <span className="text-[12px] font-black text-white tracking-[0.3em] uppercase italic">FINAL VERDICT</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
          )}
          <div className="flex-1 flex flex-col p-[50px] relative z-10">{children}</div>
          <div className={`h-[40px] flex items-center justify-between px-[50px] ${isMerciless ? (isLastPage ? 'bg-rose-950' : 'bg-[#0f0000]') : 'bg-[#0b1018]'} border-t border-white/5`}>
            <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isMerciless ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-indigo-500'} animate-pulse`}></div>
                <span className={`text-[10px] font-black tracking-widest uppercase ${isMerciless ? 'text-rose-500/60' : 'text-slate-500'}`}>
                    {isMerciless ? 'MERCILESS FEEDBACK ENGINE V2.2' : '세일즈 인텔리전스 엔진 V2.2'}
                </span>
            </div>
            <span className={`text-[10px] font-black tracking-widest uppercase italic ${isMerciless ? 'text-rose-500/60' : 'text-slate-500'}`}>
                PAGE {index + 1} / {TOTAL_PAGES}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1150px] mx-auto pb-32 px-4">
      <div className="flex justify-between items-center bg-slate-900/95 p-5 rounded-3xl border border-white/10 sticky top-4 z-[500] backdrop-blur-xl mb-16 shadow-2xl gap-4">
        <div className="flex flex-col gap-1 w-full max-w-xs">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">분석 대상자</span>
            <input type="text" value={editableName} onChange={(e) => setEditableName(e.target.value)} className="bg-slate-950/50 border border-white/10 rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none w-full" />
        </div>
        <div className="flex gap-2 shrink-0">
            <button onClick={handleDownloadPDF} disabled={isPdfGenerating} className={`px-6 py-3 ${mode === 'merciless' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'} rounded-xl text-xs font-black text-white uppercase min-w-[120px] transition-colors`}>
              {isPdfGenerating ? `Page ${pdfProgress}/${TOTAL_PAGES}...` : 'Save PDF'}
            </button>
            <button onClick={onReset} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 border border-white/10">Close</button>
        </div>
      </div>

      <PageWrapper index={0}>
        <div className="flex justify-between items-start mb-10">
            <div className="flex flex-col">
                <h1 className="text-[64px] font-black text-white leading-[0.9] tracking-tighter uppercase">{mode === 'merciless' ? 'Merciless' : 'Sales'}</h1>
                <h1 className={`text-[64px] font-black ${mode === 'merciless' ? 'text-rose-600 drop-shadow-[0_0_15px_rgba(225,29,72,0.5)]' : 'text-indigo-500'} leading-[0.9] tracking-tighter uppercase`}>Diagnosis</h1>
                <div className={`h-1 w-20 ${mode === 'merciless' ? 'bg-rose-600' : 'bg-indigo-500'} mt-4`}></div>
                <span className={`text-[12px] font-black ${mode === 'merciless' ? 'text-rose-500' : 'text-indigo-400'} uppercase tracking-[0.4em] mt-2 italic`}>
                    {mode === 'merciless' ? '냉혹한 진단 리포트' : '세일즈 정밀 진단'}
                </span>
            </div>
            <div className="text-right flex flex-col items-end pt-2 pr-1">
                <span className={`text-[10px] ${mode === 'merciless' ? 'text-rose-500' : 'text-slate-500'} font-black uppercase tracking-[0.2em] mb-1`}>PROFESSIONAL PROFILE</span>
                <div className="text-xl font-black text-white italic tracking-tight">{editableName}</div>
            </div>
        </div>
        <div className="grid grid-cols-12 gap-10 flex-1 items-center">
            <div className="col-span-5 flex flex-col items-center justify-center">
                <div className="relative w-[300px] h-[300px] flex items-center justify-center">
                    <div className={`absolute inset-0 rounded-full border-[25px] ${mode === 'merciless' ? 'border-rose-500/10' : 'border-indigo-500/10'}`}></div>
                    <div className={`absolute inset-0 rounded-full border-[25px] ${mode === 'merciless' ? 'border-rose-600' : 'border-indigo-500'} border-t-transparent border-r-transparent transform -rotate-45`}></div>
                    <div className="flex flex-col items-center">
                        <span className="text-[90px] font-black text-white leading-none tracking-tighter italic">{formatScore(result?.spinScore || 0)}</span>
                        <div className={`${mode === 'merciless' ? 'bg-rose-600 shadow-rose-600/20' : 'bg-indigo-600 shadow-indigo-600/20'} px-8 py-1.5 rounded-full mt-2 shadow-lg`}>
                            <span className="text-[12px] font-black text-white uppercase tracking-widest italic">SPIN SCORE</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="col-span-7 flex flex-col gap-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1.5 h-6 ${mode === 'merciless' ? 'bg-rose-600' : 'bg-indigo-500'}`}></div>
                    <h3 className={`text-[14px] font-black ${mode === 'merciless' ? 'text-rose-500' : 'text-slate-400'} uppercase tracking-[0.4em]`}>CORE STRENGTHS</h3>
                </div>
                <div className="flex flex-col gap-3">
                    {(result?.strengths || []).slice(0, 4).map((s, i) => (
                        <div key={i} className={`bg-slate-900/40 p-4 rounded-2xl border ${mode === 'merciless' ? 'border-rose-500/10' : 'border-white/5'} flex items-start gap-4 relative overflow-hidden shrink-0`}>
                            <div className={`w-7 h-7 rounded-lg ${mode === 'merciless' ? 'bg-rose-500/20' : 'bg-emerald-500/20'} flex items-center justify-center shrink-0 mt-0.5`}>
                                <svg className={`w-4 h-4 ${mode === 'merciless' ? 'text-rose-400' : 'text-emerald-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <p className="text-slate-200 text-[13px] leading-relaxed font-medium italic">{s}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </PageWrapper>

      <PageWrapper index={1}>
        <QuestioningAnalysisPage 
            title="SPIN 질문"
            catTitle="상황 파악"
            catLabel="Situation"
            catQuestions={result?.spinQuestions?.situation || []}
            catAnalysis={result?.spinAnalysis?.situation || ""}
            catColor="text-cyan-400"
            counts={result?.spinCounts}
            total={totalQs}
            activeCat="S"
            mode={mode}
        />
      </PageWrapper>

      <PageWrapper index={2}>
        <QuestioningAnalysisPage 
            title="SPIN 질문 (Cont.)"
            catTitle="문제 탐색"
            catLabel="Problem"
            catQuestions={result?.spinQuestions?.problem || []}
            catAnalysis={result?.spinAnalysis?.problem || ""}
            catColor="text-blue-500"
            counts={result?.spinCounts}
            total={totalQs}
            activeCat="P"
            mode={mode}
        />
      </PageWrapper>

      <PageWrapper index={3}>
        <QuestioningAnalysisPage 
            title="SPIN 질문 (Cont.)"
            catTitle="시사점 도출"
            catLabel="Implication"
            catQuestions={result?.spinQuestions?.implication || []}
            catAnalysis={result?.spinAnalysis?.implication || ""}
            catColor="text-violet-500"
            counts={result?.spinCounts}
            total={totalQs}
            activeCat="I"
            mode={mode}
        />
      </PageWrapper>

      <PageWrapper index={4}>
        <QuestioningAnalysisPage 
            title="SPIN 질문 (Cont.)"
            catTitle="가치 확인"
            catLabel="Need-Payoff"
            catQuestions={result?.spinQuestions?.needPayoff || []}
            catAnalysis={result?.spinAnalysis?.needPayoff || ""}
            catColor="text-pink-500"
            counts={result?.spinCounts}
            total={totalQs}
            activeCat="N"
            mode={mode}
        />
      </PageWrapper>

      <PageWrapper index={5}>
        <MentalSystemDiagnosisPage 
            insight={result?.charlieMorganInsight} 
            mode={mode}
        />
      </PageWrapper>

      <PageWrapper index={6}>
        <div className="flex flex-col h-full gap-6">
            <ModuleHeader 
                title="설득의 심리학 오딧" 
                subtitle="Persuasion Audit" 
                color="text-amber-400" 
                bgColor="bg-amber-500"
                mode={mode}
            />
            <div className="grid grid-cols-2 gap-6 flex-1 overflow-hidden">
                {(result?.persuasionAudit || []).slice(0, 4).map((audit, i) => (
                    <AuditCard key={i} audit={audit} mode={mode} />
                ))}
                {(!result?.persuasionAudit || result.persuasionAudit.length === 0) && (
                    <div className="col-span-2 flex items-center justify-center opacity-30 italic">
                        설득 데이터 분석 중...
                    </div>
                )}
            </div>
        </div>
      </PageWrapper>

      <PageWrapper index={7}>
        <div className={`flex flex-col h-full ${mode === 'merciless' ? 'bg-rose-950/20 border-rose-500/40' : 'bg-[#0b1018] border-emerald-500/20'} rounded-[40px] border-2 p-12 shadow-2xl relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${mode === 'merciless' ? 'from-rose-600/50 via-rose-400/50 to-rose-600/50' : 'from-emerald-500/50 via-cyan-500/50 to-emerald-500/50'}`}></div>
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4">
                    <div className={`w-2 h-8 ${mode === 'merciless' ? 'bg-rose-600 shadow-[0_0_10px_#e11d48]' : 'bg-emerald-500'} rounded-full`}></div>
                    <h2 className={`text-[28px] font-black ${mode === 'merciless' ? 'text-rose-500' : 'text-emerald-400'} uppercase tracking-tight italic`}>
                        {mode === 'merciless' ? '냉혹한 미팅 전략 팁' : '핵심 미팅 전략 팁'}
                    </h2>
                </div>
                
                <div className="flex flex-col gap-8 mt-4">
                    {/* Use betterApproaches or growthPoints as proxy for tips if tips field is missing in AnalysisResult */}
                    {(result?.betterApproaches || result?.keyMistakes || []).slice(0, 4).map((tip, i) => (
                        <div key={i} className="flex gap-6 items-start group">
                            <div className={`w-2 h-2 rounded-full ${mode === 'merciless' ? 'bg-rose-600 shadow-[0_0_10px_#e11d48]' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'} mt-2.5 shrink-0 group-hover:scale-125 transition-transform`}></div>
                            <p className="text-slate-200 font-medium leading-relaxed italic text-[20px] group-hover:text-white transition-colors">
                                {tip}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="mt-auto pt-10 border-t border-white/5 flex justify-center">
                <p className={`text-[12px] font-black ${mode === 'merciless' ? 'text-rose-500/40' : 'text-emerald-500/40'} uppercase tracking-[0.5em] italic`}>Strategic Conclusion & Action Plan</p>
            </div>
        </div>
      </PageWrapper>

      <PageWrapper index={8}>
        <div className="flex flex-col h-full gap-6">
            {/* Top Section: Growth Points */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <svg className={`w-5 h-5 ${mode === 'merciless' ? 'text-rose-500' : 'text-indigo-400'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464a1 1 0 10-1.414-1.414l.707-.707a1 1 0 001.414 1.414l-.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.243a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM16.182 16.182a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0z" /></svg>
                    <h2 className={`text-[14px] font-black ${mode === 'merciless' ? 'text-rose-500' : 'text-indigo-400'} uppercase tracking-[0.3em]`}>더 큰 성과를 위한 전략적 성장 포인트 (GROWTH POINTS)</h2>
                </div>
                <div className="flex flex-col gap-3">
                    {(result?.growthPoints || []).slice(0, 2).map((p, i) => (
                        <div key={i} className={`bg-[#0f172a] p-6 rounded-[25px] border ${mode === 'merciless' ? 'border-rose-500/20 shadow-rose-900/10' : 'border-white/5 shadow-xl'} flex items-center gap-6`}>
                            <div className={`w-12 h-12 rounded-xl ${mode === 'merciless' ? 'bg-rose-500/10' : 'bg-amber-500/10'} flex items-center justify-center shrink-0`}>
                                <svg className={`w-7 h-7 ${mode === 'merciless' ? 'text-rose-500' : 'text-amber-400'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>
                            </div>
                            <div className="flex flex-col gap-1">
                                <h4 className="text-[18px] font-black text-white italic">{p.title}</h4>
                                <p className="text-slate-300 text-[14px] leading-relaxed font-medium italic">{p.description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom Section: Recommended Scripts */}
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h2 className={`text-[16px] font-black ${mode === 'merciless' ? 'text-rose-500' : 'text-cyan-400'} uppercase tracking-widest`}>마스터를 위한 권장 스크립트</h2>
                    <div className={`w-12 h-1 ${mode === 'merciless' ? 'bg-rose-500/30' : 'bg-cyan-500/30'}`}></div>
                </div>
                <div className="flex flex-col gap-4">
                    {(result?.recommendedScripts || []).slice(0, 2).map((s, i) => (
                        <div key={i} className="flex flex-col gap-2">
                            <div className="flex">
                                <span className={`px-3 py-1 rounded-lg ${mode === 'merciless' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'} font-black text-[9px] uppercase tracking-widest italic`}>추천 화법 (RECOMMENDED)</span>
                            </div>
                            <div className={`bg-[#0f172a] p-6 rounded-[30px] border-2 ${mode === 'merciless' ? 'border-rose-500/30' : 'border-white/5'} relative overflow-hidden shadow-2xl`}>
                                <div className={`absolute top-0 left-0 w-2 h-full ${mode === 'merciless' ? 'bg-rose-500/40' : 'bg-cyan-500/40'}`}></div>
                                <p className="text-white font-black text-[20px] leading-snug italic tracking-tight">“{s.script}”</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto bg-slate-900/80 p-4 rounded-full border border-white/10 text-center">
                <p className="text-slate-500 font-black text-[10px] tracking-[0.4em] uppercase italic">
                    STRATEGIC GROWTH FINAL ASSESSMENT
                </p>
            </div>
        </div>
      </PageWrapper>

      <PageWrapper index={9}>
        <StrategicFeedbackPage 
            mistakes={result?.keyMistakes || []} 
            approaches={result?.betterApproaches || []} 
            mode={mode}
        />
      </PageWrapper>
    </div>
  );
};
