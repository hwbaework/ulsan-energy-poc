'use client';

// /dt/scout — 울산 산단 입지 스카우팅 (컨설턴트·관리자).
// UI는 공용 디자인 시스템(SectionCard·StatCard·ProgressBar·Button·Badge·DescriptionList)으로 구성 — 타 도메인과 UX 일치.
import { useEffect, useRef, useState } from 'react';
import { Trophy, Sun as SunIcon, Zap, Leaf, Coins, X, MapPin, Building2, Ruler } from 'lucide-react';
import { SectionCard, StatCard, StatsGrid, DescriptionList } from '@/components/features';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar/ProgressBar';
import { type WeatherKey } from '../next/MapStage';
import { SunDial } from '../next/SunDial';
import { ScoutStage, type LeadFeature } from './ScoutStage';
import { runProfitSim, won, type SimResult } from '../simulation/simEngine';
import { openAnalysisReport } from './report';

type Phase = 'browse' | 'running' | 'result';

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SPIN_CYCLES = 2.5;
const SPIN_STEP = 0.45;
const SPIN_INTERVAL_MS = 28;
const GRADE_BADGE: Record<string, 'warning' | 'primary' | 'default'> = { S: 'warning', A: 'primary', B: 'default' };
const GRADE_RANK_STYLE: Record<string, string> = {
  S: 'bg-amber-400 text-black',
  A: 'bg-orange-400 text-black',
  B: 'bg-slate-500 text-white',
};

export default function ScoutWorld() {
  const [weather] = useState<WeatherKey>('clear');
  const [hour, setHour] = useState(13);
  const [leads, setLeads] = useState<LeadFeature[]>([]);
  const [lead, setLead] = useState<LeadFeature | null>(null);
  const [phase, setPhase] = useState<Phase>('browse');
  const [result, setResult] = useState<SimResult | null>(null);
  const [placeSignal, setPlaceSignal] = useState<{
    key: number;
    lngLat: [number, number];
    sizeM: number;
    rotationDeg: number;
  } | null>(null);
  const [flyTo, setFlyTo] = useState<{ key: number; lngLat: [number, number]; zoom: number } | null>(null);
  const [clearSignal, setClearSignal] = useState(0);
  const [peekHeader, setPeekHeader] = useState(false);
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hourBackupRef = useRef(13);

  useEffect(() => {
    if (!peekHeader) return;
    const onMove = (e: MouseEvent) => {
      if (e.clientY > 110) setPeekHeader(false);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [peekHeader]);
  useEffect(
    () => () => {
      if (spinRef.current) clearInterval(spinRef.current);
    },
    [],
  );

  const selectLead = (l: LeadFeature | null, fly = false) => {
    if (phase === 'running') return;
    setLead(l);
    setResult(null);
    setPhase('browse');
    if (l && fly) setFlyTo({ key: (flyTo?.key ?? 0) + 1, lngLat: l.lngLat, zoom: 15.2 });
  };

  // 수익 시뮬 — 트윈 설치(먼지) + 태양 휠 회전 연출 → 결과
  const runSim = () => {
    if (!lead || phase === 'running') return;
    // 건물 크기를 지붕면적에 맞춤 — GLB 원본 footprint(126.45×78.82 ≈ 9,967㎡)의 최장변 기준 스케일
    const GLB_AREA = 9967,
      GLB_LONG = 126.45;
    const roof = lead.roofM2 > 0 ? lead.roofM2 : 3000;
    const sizeM = Math.min(280, Math.max(30, GLB_LONG * Math.sqrt(roof / GLB_AREA)));
    setPlaceSignal({ key: (placeSignal?.key ?? 0) + 1, lngLat: lead.lngLat, sizeM, rotationDeg: lead.bearingDeg });
    hourBackupRef.current = hour;
    setPhase('running');
    let spun = 0;
    const total = SPIN_CYCLES * 24;
    spinRef.current = setInterval(() => {
      spun += SPIN_STEP;
      setHour((h) => (h + SPIN_STEP) % 24);
      if (spun >= total) {
        if (spinRef.current) clearInterval(spinRef.current);
        spinRef.current = null;
        setHour(hourBackupRef.current);
        setResult(
          runProfitSim({
            capacityKw: Math.round(lead.estKw),
            dailyIrr: lead.irr || 3.9,
            smp: 114.96,
            recPrice: 71945,
            recWeight: 1.5,
          }),
        );
        setPhase('result');
      }
    }, SPIN_INTERVAL_MS);
  };

  const closeSim = () => {
    setClearSignal((v) => v + 1);
    setResult(null);
    setPhase('browse');
  };

  const num = (v: number, d = 0) => v.toLocaleString('ko-KR', { maximumFractionDigits: d });
  const maxMonthly = result ? Math.max(...result.monthlyKwh) : 1;

  return (
    <div className={`fixed inset-0 ${peekHeader ? 'z-40' : 'z-[60]'} bg-[#060a14] text-white`}>
      {!peekHeader && (
        <div
          className="absolute inset-x-0 top-0 z-40 h-2 cursor-pointer"
          onMouseEnter={() => setPeekHeader(true)}
          onTouchStart={() => setPeekHeader(true)}
        />
      )}

      <ScoutStage
        weather={weather}
        hour={hour}
        placeSignal={placeSignal}
        clearSignal={clearSignal}
        selectedId={lead?.assetId ?? null}
        onLeads={setLeads}
        onLeadSelect={(l) => selectLead(l)}
        flyTo={flyTo}
      />

      {/* ── 좌측: 후보 랭킹 ── */}
      <aside className="absolute left-3 top-3 z-30 w-[250px]">
        <SectionCard
          title={
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-400" /> 후보 지붕 랭킹
            </span>
          }
          count={leads.length}
          countUnit="곳"
          className="bg-[#0d1520]/95 backdrop-blur"
        >
          <div className="max-h-[62vh] space-y-1 overflow-y-auto">
            {leads.map((l) => (
              <button
                key={l.assetId}
                onClick={() => selectLead(l, true)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  lead?.assetId === l.assetId ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-white/[0.05]'
                }`}
              >
                <span
                  className={`w-6 shrink-0 rounded text-center text-[10px] font-extrabold ${GRADE_RANK_STYLE[l.grade] ?? GRADE_RANK_STYLE.B}`}
                >
                  {l.rank}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{l.name}</span>
                  <span className="block text-[10px] text-slate-500">
                    {Math.round(l.estKw)}kW · {l.score.toFixed(0)}점
                  </span>
                </span>
              </button>
            ))}
            {leads.length === 0 && <p className="py-2 text-xs text-slate-500">후보 로딩 중…</p>}
          </div>
        </SectionCard>
      </aside>

      {/* ── 우측: 리드 카드 / 시뮬 결과 ── */}
      <div
        className={`absolute bottom-0 right-0 top-0 z-10 w-full max-w-[400px] overflow-y-auto border-l border-white/[0.06] bg-[#0a101c]/95 px-4 py-4 backdrop-blur-sm transition-transform duration-300 ease-out ${
          lead ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        {lead && phase !== 'result' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={GRADE_BADGE[lead.grade] ?? 'default'}>{lead.grade}급</Badge>
              <span className="min-w-0 flex-1 truncate text-base font-bold">{lead.name}</span>
              <button onClick={() => selectLead(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              <MapPin className="mr-1 inline h-3 w-3 text-primary" />
              {lead.complex} · 종합 <b className="text-white">{lead.score.toFixed(1)}점</b> (전체 {lead.rank}위)
            </p>

            <StatsGrid columns={2}>
              <StatCard icon={<Ruler className="h-5 w-5" />} label="지붕면적" value={`${num(lead.roofM2)} ㎡`} />
              <StatCard
                icon={<Zap className="h-5 w-5" />}
                label="추정 설치용량"
                value={`${num(lead.estKw)} kW`}
                sub="면적×60%×0.2kW"
              />
            </StatsGrid>

            <SectionCard title="점수 구성">
              <div className="space-y-2.5">
                <ProgressBar label="지붕 규모" value={lead.sRoof} max={35} variant="primary" />
                <ProgressBar label="일사량" value={lead.sIrr} max={20} variant="warning" />
                <ProgressBar label="계통 근접" value={lead.sGrid} max={20} variant="success" />
                <ProgressBar label="추정 수요" value={lead.sDemand} max={25} variant="primary" />
              </div>
            </SectionCard>

            <SectionCard title="리드 정보">
              <DescriptionList
                columns={1}
                items={[
                  { label: '추정 연 사용량', value: `${num(lead.estDemandMwh)} MWh (원단위 추정)` },
                  { label: '일사량', value: `${lead.irr.toFixed(2)} kWh/㎡/일 (NASA)` },
                  { label: '최근접 변전소', value: `${num(lead.subDistM)} m` },
                  { label: '주소', value: lead.address },
                ]}
              />
            </SectionCard>

            {phase === 'running' ? (
              <div className="py-2 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                <p className="text-xs text-slate-300">트윈 설치 · 태양 궤적 분석 중…</p>
              </div>
            ) : (
              <Button variant="primary" size="lg" className="w-full" onClick={runSim}>
                <Zap className="mr-1.5 h-4 w-4" /> 수익 시뮬 실행 ({num(lead.estKw)}kW)
              </Button>
            )}

            <p className="text-[10px] leading-relaxed text-slate-500">
              출처: OSM 건물 표본(공공데이터 결합 전) · 일사량 NASA POWER · 계통 OSM 실측. 사용량은 업종 원단위 기반
              추정치.
            </p>
          </div>
        )}

        {lead && phase === 'result' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SunIcon className="h-4 w-4 text-amber-400" />
              <span className="min-w-0 flex-1 truncate text-base font-bold">{lead.name} 수익 분석</span>
              <button onClick={closeSim} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {num(lead.estKw)}kW · {lead.irr.toFixed(2)}kWh/㎡/일 · SMP 114.96 · REC 71,945 × 1.5
            </p>

            <StatsGrid columns={2}>
              <StatCard
                icon={<Building2 className="h-5 w-5" />}
                label="연 발전량"
                value={`${num(result.annualKwh / 1000, 1)} MWh`}
              />
              <StatCard icon={<Coins className="h-5 w-5" />} label="연 수익 (1차년도)" value={won(result.year1Total)} />
            </StatsGrid>

            <SectionCard title="1차년도 수익 구성">
              <DescriptionList
                columns={1}
                items={[
                  { label: 'SMP 매출', value: won(result.smpRevenue) },
                  { label: `REC 매출 (${num(result.recWeighted, 1)} REC)`, value: won(result.recRevenue) },
                ]}
              />
            </SectionCard>

            <SectionCard title="월별 예상 발전량 (kWh)">
              <div className="flex items-end gap-1">
                {result.monthlyKwh.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${Math.max(2, (v / maxMonthly) * 72)}px` }}
                      title={`${MONTHS[i]}월 ${Math.round(v).toLocaleString('ko-KR')} kWh`}
                    />
                    <span className="text-[9px] text-slate-500">{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="20년 운영 (연 0.5% 열화)">
              <DescriptionList
                columns={1}
                items={[
                  { label: '총 발전량', value: `${num(result.totalGenKwh / 1000)} MWh` },
                  { label: '총 수익', value: <b className="text-amber-300">{won(result.totalRevenue)}</b> },
                ]}
              />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400">
                <div className="rounded-lg bg-white/[0.04] p-1.5">
                  🛢️<div className="text-xs font-bold text-white">{num(result.env.toe, 1)}</div>TOE
                </div>
                <div className="rounded-lg bg-white/[0.04] p-1.5">
                  ☁️<div className="text-xs font-bold text-white">{num(result.env.tco2, 1)}</div>tCO₂
                </div>
                <div className="rounded-lg bg-white/[0.04] p-1.5">
                  <Leaf className="mx-auto h-3 w-3 text-emerald-400" />
                  <div className="text-xs font-bold text-white">{num(result.env.trees)}</div>그루
                </div>
              </div>
            </SectionCard>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={runSim}>
                다시 계산
              </Button>
              <Button variant="primary" onClick={() => openAnalysisReport(lead, result)}>
                📄 분석보고서 보기
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── 맵 중앙: 태양 휠 (시뮬 연출 중에만) ── */}
      {phase === 'running' && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <SunDial hour={hour} bearing={-20} onHourChange={() => {}} />
        </div>
      )}
    </div>
  );
}
