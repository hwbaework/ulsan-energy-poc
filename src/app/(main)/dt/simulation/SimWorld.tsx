'use client';

// /dt/simulation — 지붕형 태양광 수익 시뮬레이션 세계 (수용가향).
// ① 맵 클릭 → 한일튜브 트윈 설치(먼지 이펙트) ② 설비 설정(위치 실측 일사량 자동)
// ③ 실행 → 태양 휠이 낮밤을 3바퀴 돌며 계산 연출 ④ 수익 결과 대시보드
// UI는 공용 디자인 시스템(SectionCard·StatCard·Input·Button·DescriptionList)으로 구성.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, RotateCcw, Trash2, Zap, Sun as SunIcon, Leaf, Coins, X } from 'lucide-react';
import { SectionCard, StatCard, StatsGrid, DescriptionList } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { sunPositionDeg, dateAtHour, SUN_REF, type WeatherKey } from '../next/MapStage';
import { SunDial } from '../next/SunDial';
import { SimStage } from './SimStage';
import { BuildingSearchPanel } from './BuildingSearchPanel';
import { runProfitSim, won, type SimResult } from './simEngine';
import { openAnalysisReport } from '../scout/report';

type Phase = 'place' | 'config' | 'running' | 'result';

const MONTHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SPIN_CYCLES = 3; // 태양 휠 회전 바퀴 수
const SPIN_STEP = 0.45; // hour/frame
const SPIN_INTERVAL_MS = 28;

export default function SimWorld() {
  const [weather, setWeather] = useState<WeatherKey>('clear');
  const [hour, setHour] = useState(() => {
    const n = new Date();
    return n.getHours() + n.getMinutes() / 60;
  });
  const [timeOpen, setTimeOpen] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(-25);
  const [clearSignal, setClearSignal] = useState(0);
  const [peekHeader, setPeekHeader] = useState(false);

  // 시뮬레이션 상태
  const [phase, setPhase] = useState<Phase>('place');
  const [placedAt, setPlacedAt] = useState<[number, number] | null>(null);
  const [placeSignal, setPlaceSignal] = useState<{ key: number; lngLat: [number, number] } | null>(null);
  const [recenterSignal, setRecenterSignal] = useState<{ key: number; lngLat: [number, number] } | null>(null);
  const place = (lngLat: [number, number]) => setPlaceSignal((p) => ({ key: (p?.key ?? 0) + 1, lngLat }));
  const recenter = (lngLat: [number, number]) => setRecenterSignal((p) => ({ key: (p?.key ?? 0) + 1, lngLat }));
  const [dailyIrr, setDailyIrr] = useState(3.9);
  const [capacityKw, setCapacityKw] = useState(500);
  const [smp, setSmp] = useState(114.96);
  const [recPrice, setRecPrice] = useState(71945);
  const [recWeight, setRecWeight] = useState(1.5);
  const [result, setResult] = useState<SimResult | null>(null);
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hourBackupRef = useRef(12);

  useEffect(() => {
    if (!peekHeader) return;
    const onMove = (e: MouseEvent) => {
      if (e.clientY > 110) setPeekHeader(false);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [peekHeader]);

  const hhmm = (h: number) =>
    `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const sunTimes = useMemo(() => {
    let rise: number | null = null,
      set: number | null = null;
    let prev = sunPositionDeg(dateAtHour(0), SUN_REF.lat, SUN_REF.lng).altitudeDeg;
    for (let h = 0.1; h <= 24; h += 0.1) {
      const alt = sunPositionDeg(dateAtHour(h), SUN_REF.lat, SUN_REF.lng).altitudeDeg;
      if (prev < 0 && alt >= 0) rise = h;
      if (prev >= 0 && alt < 0) set = h;
      prev = alt;
    }
    return { rise, set };
  }, []);

  // 설치 → 위치 실측 일사량(NASA 격자) 자동 조회 → 설정 단계
  const onPlaced = (lngLat: [number, number]) => {
    setPlacedAt(lngLat);
    setResult(null);
    setPhase('config');
    const [lng, lat] = lngLat;
    fetch(`/api/mapserver/irradiance?bbox=${lng - 0.06},${lat - 0.06},${lng + 0.06},${lat + 0.06}&z=10`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: GeoJSON.FeatureCollection | null) => {
        const feats = d?.features ?? [];
        if (!feats.length) return;
        let best = feats[0]!,
          bd = Infinity;
        for (const f of feats) {
          const [x, y] = (f.geometry as GeoJSON.Point).coordinates as [number, number];
          const dd = (x - lng) ** 2 + (y - lat) ** 2;
          if (dd < bd) {
            bd = dd;
            best = f;
          }
        }
        const v = Number((best.properties as { value?: unknown })?.value);
        if (Number.isFinite(v) && v > 0) setDailyIrr(v);
      })
      .catch(() => {});
  };

  // 실행 — 건물로 줌인(scout 동일) → 태양 휠 3바퀴 연출 후 결과
  const runSim = () => {
    if (phase === 'running') return;
    if (placedAt) recenter(placedAt); // 설치 건물로 카메라 인입
    hourBackupRef.current = hour;
    setPhase('running');
    setTimeOpen(true); // 휠 강제 표시
    let spun = 0;
    const total = SPIN_CYCLES * 24;
    spinRef.current = setInterval(() => {
      spun += SPIN_STEP;
      setHour((h) => (h + SPIN_STEP) % 24);
      if (spun >= total) {
        if (spinRef.current) clearInterval(spinRef.current);
        spinRef.current = null;
        setHour(hourBackupRef.current);
        setResult(runProfitSim({ capacityKw, dailyIrr, smp, recPrice, recWeight }));
        setTimeOpen(false);
        setPhase('result');
      }
    }, SPIN_INTERVAL_MS);
  };
  useEffect(
    () => () => {
      if (spinRef.current) clearInterval(spinRef.current);
    },
    [],
  );

  const reset = () => {
    setClearSignal((v) => v + 1);
    setPlacedAt(null);
    setResult(null);
    setPhase('place');
  };

  const maxMonthly = result ? Math.max(...result.monthlyKwh) : 1;
  const num = (v: number, digits = 0) => v.toLocaleString('ko-KR', { maximumFractionDigits: digits });

  return (
    <div className={`fixed inset-0 ${peekHeader ? 'z-40' : 'z-[60]'} bg-[#060a14] text-white`}>
      {!peekHeader && (
        <div
          className="absolute inset-x-0 top-0 z-40 h-2 cursor-pointer"
          onMouseEnter={() => setPeekHeader(true)}
          onTouchStart={() => setPeekHeader(true)}
        />
      )}

      <SimStage
        weather={weather}
        hour={hour}
        rotationDeg={rotationDeg}
        capacityKw={capacityKw}
        clearSignal={clearSignal}
        placeSignal={placeSignal}
        recenterSignal={recenterSignal}
        onPlaced={onPlaced}
      />

      {/* ── 좌측 하단: 내 건물 절감 테스트 (주소검색 → 임시마커 → 클릭 설치) ── */}
      <div className="absolute bottom-4 left-3 z-30">
        <BuildingSearchPanel
          hasPlaced={placedAt != null}
          onPick={(lng, lat) => place([lng, lat])}
          onRecenter={() => {
            if (placedAt) recenter(placedAt);
          }}
        />
      </div>

      {/* ── 상단 중앙: 단계 스텝퍼 ── */}
      <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-[#0d1520]/90 px-3 py-1.5 text-[11px] font-semibold ring-1 ring-white/[0.08] backdrop-blur">
        {(
          [
            ['place', '① 위치 설치'],
            ['config', '② 설비 설정'],
            ['running', '③ 계산'],
            ['result', '④ 결과'],
          ] as [Phase, string][]
        ).map(([k, label]) => (
          <span key={k} className={k === phase ? 'text-primary' : 'text-slate-500'}>
            {label}
          </span>
        ))}
      </div>

      {/* ── 좌측: 단계별 패널 ── */}
      <aside className="absolute left-3 top-3 z-30 w-[260px]">
        <SectionCard
          title={
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> 수익 시뮬레이션
            </span>
          }
          className="bg-[#0d1520]/95 backdrop-blur"
        >
          {phase === 'place' && (
            <p className="text-xs leading-relaxed text-slate-400">
              맵을 클릭해 지붕형 태양광 건물(한일튜브 트윈)을 설치하세요. 설치 위치의 실측 일사량(NASA)으로 수익을
              계산합니다.
            </p>
          )}

          {(phase === 'config' || phase === 'result') && (
            <div className="space-y-3">
              <div className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-[11px] text-slate-300">
                ☀️ 이 위치 일사량 <b className="text-amber-300">{dailyIrr.toFixed(2)} kWh/㎡/일</b>
                <span className="block text-[10px] text-slate-500">NASA POWER 실측 격자 자동 적용</span>
                {placedAt && (
                  <span className="block text-[10px] tabular-nums text-slate-500">
                    📍 {placedAt[1].toFixed(5)}, {placedAt[0].toFixed(5)}
                  </span>
                )}
              </div>
              <Input
                label="설치용량 (kW)"
                type="number"
                value={capacityKw}
                onChange={(e) => setCapacityKw(Number(e.target.value))}
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="SMP (원/kWh)"
                  type="number"
                  value={smp}
                  onChange={(e) => setSmp(Number(e.target.value))}
                />
                <Input
                  label="REC (원)"
                  type="number"
                  value={recPrice}
                  onChange={(e) => setRecPrice(Number(e.target.value))}
                />
              </div>
              <Input
                label="REC 가중치 (지붕형 1.5)"
                type="number"
                step={0.1}
                value={recWeight}
                onChange={(e) => setRecWeight(Number(e.target.value))}
              />
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3" /> 건물 회전
                  </span>
                  <span className="tabular-nums text-white">{rotationDeg}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <Button variant="primary" className="w-full" onClick={runSim}>
                <Zap className="mr-1.5 h-4 w-4" /> {phase === 'result' ? '다시 계산' : '시뮬레이션 실행'}
              </Button>
            </div>
          )}

          {phase === 'running' && (
            <div className="py-2 text-center">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
              <p className="text-xs text-slate-300">태양 궤적 분석 중…</p>
              <p className="mt-1 text-[10px] text-slate-500">20년 발전량 · SMP/REC 수익 계산</p>
            </div>
          )}

          {phase !== 'place' && (
            <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={reset}>
              <Trash2 className="mr-1 h-3 w-3" /> 초기화
            </Button>
          )}
        </SectionCard>
      </aside>

      {/* ── 우측: 결과 대시보드 ── */}
      <div
        className={`absolute bottom-0 right-0 top-0 z-10 w-full max-w-[400px] overflow-y-auto border-l border-white/[0.06] bg-[#0a101c]/95 px-4 py-4 backdrop-blur-sm transition-transform duration-300 ease-out ${
          phase === 'result' && result ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        {result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <SunIcon className="h-4 w-4 text-amber-400" />
              <span className="min-w-0 flex-1 truncate text-base font-bold">지붕태양광 수익 분석</span>
              <button onClick={() => setPhase('config')} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {capacityKw}kW · {dailyIrr.toFixed(2)}kWh/㎡/일 · SMP {smp} · REC {num(recPrice)} × {recWeight}
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
                  { label: `SMP 매출 (${smp}원/kWh)`, value: won(result.smpRevenue) },
                  {
                    label: `REC 매출 (${num(result.recWeighted, 1)} REC × ${recWeight})`,
                    value: won(result.recRevenue),
                  },
                ]}
              />
            </SectionCard>

            <SectionCard title="월별 예상 발전량 (kWh)">
              <div className="flex items-end gap-1">
                {result.monthlyKwh.map((v, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5">
                    <div
                      className="w-full rounded-t bg-primary/70"
                      style={{ height: `${Math.max(2, (v / maxMonthly) * 84)}px` }}
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
              <div className="mt-2 max-h-36 overflow-y-auto rounded-lg bg-black/20">
                <table className="w-full text-center text-[10px]">
                  <thead className="sticky top-0 bg-[#0d1520] text-slate-400">
                    <tr>
                      <th className="py-1">년차</th>
                      <th>발전(MWh)</th>
                      <th>수익</th>
                      <th>누적</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    {result.rows.map((r) => (
                      <tr key={r.year} className="border-t border-white/[0.04]">
                        <td className="py-0.5">{r.year}</td>
                        <td>{num(r.genMwh, 0)}</td>
                        <td>{won(r.revenue)}</td>
                        <td>{won(r.accumulated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

            <Button
              variant="primary"
              className="w-full"
              onClick={() =>
                openAnalysisReport(
                  {
                    name: '한일튜브 트윈 (시뮬레이션)',
                    address: placedAt ? `${placedAt[1].toFixed(5)}, ${placedAt[0].toFixed(5)}` : undefined,
                    estKw: capacityKw,
                    irr: dailyIrr,
                    smp,
                    recPrice,
                    recWeight,
                  },
                  result,
                )
              }
            >
              📄 분석보고서 보기
            </Button>

            <p className="text-[10px] leading-relaxed text-slate-500">
              효율 75% · 월별 계절계수 적용 · TOE=MWh×0.229, tCO₂=TOE×2.37, 식재=tCO₂×151.5. 일사량은 설치 위치의 NASA
              POWER 위성 기후값.
            </p>
          </div>
        )}
      </div>

      {/* ── 우측 상단: 시각 위젯 ── */}
      {timeOpen && phase !== 'result' && (
        <div className="absolute right-3 top-3 z-30 w-[340px] rounded-xl bg-[#0d1520]/90 px-4 py-3 ring-1 ring-white/[0.08] backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
            <span className="text-xl font-extrabold tabular-nums text-white">{hhmm(hour)}</span>
            <span>
              일출 {sunTimes.rise != null ? hhmm(sunTimes.rise) : '—'} · 일몰{' '}
              {sunTimes.set != null ? hhmm(sunTimes.set) : '—'}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={24}
            step={0.1}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            disabled={phase === 'running'}
            className="w-full accent-amber-400"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
            <span>00시</span>
            <span>06시</span>
            <span>12시</span>
            <span>18시</span>
            <span>24시</span>
          </div>
        </div>
      )}

      {/* ── 맵 중앙: 태양 다이얼 (시뮬레이션 계산 중엔 자동 회전 연출) ── */}
      {timeOpen && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <SunDial hour={hour} bearing={-20} onHourChange={phase === 'running' ? () => {} : setHour} />
        </div>
      )}

      {/* ── 하단 중앙: 날씨 + 시각 토글 ── */}
      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-[#0d1520]/85 px-2 py-1.5 ring-1 ring-white/[0.08] backdrop-blur">
        <span className="px-1 text-[10px] font-semibold text-slate-400">날씨</span>
        {(
          [
            ['clear', '☀️ 맑음'],
            ['rain', '🌧 비'],
            ['snow', '❄️ 눈'],
          ] as [WeatherKey, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setWeather(k)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              k === weather ? 'bg-primary text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-white/[0.1]" />
        <button
          onClick={() => setTimeOpen((v) => !v)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
            timeOpen ? 'bg-primary text-white' : 'text-slate-300 hover:text-white'
          }`}
        >
          🕒 {hhmm(hour)}
        </button>
      </div>
    </div>
  );
}
