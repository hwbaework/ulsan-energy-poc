'use client';

// /dt/next 조립 — 맵 세계(항상) + LOD 레일(점프) + 렌즈칩 + info 패널 + URL 동기화.
// 페르소나(?p=)는 별도 트리가 아니라 진입 프리셋(고도·렌즈)일 뿐이다.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Layers } from 'lucide-react';
import { MapStage, sunPositionDeg, dateAtHour, SUN_REF, type WeatherKey } from './MapStage';
import { SunDial } from './SunDial';
import { InfoPanel } from './InfoPanel';
import { useWorld, TIERS, TIER_META, LENSES, PRESETS, type Tier, type LensKey, type CamView } from './world';
import { LAYERS } from './layers';
import { DT_MODELS } from './models';

export default function DtWorld() {
  const params = useSearchParams();
  const tier = useWorld((s) => s.tier);
  const lens = useWorld((s) => s.lens);
  const setTier = useWorld((s) => s.setTier);
  const setLens = useWorld((s) => s.setLens);
  const toggleLens = useWorld((s) => s.toggleLens);
  const [flyTo, setFlyTo] = useState<CamView | null>(null);
  const [booted, setBooted] = useState(false);
  const [weather, setWeather] = useState<WeatherKey>('clear');
  // 시각(0~24h) — 태양 시뮬레이션. 초기값 = 현재 시각
  const [hour, setHour] = useState(() => {
    const n = new Date();
    return n.getHours() + n.getMinutes() / 60;
  });
  const [timeOpen, setTimeOpen] = useState(false);
  // 상단 엣지 호버/터치 → GNB 헤더 표시 (맵 오버레이를 헤더(z-50) 아래로 잠시 내림)
  const [peekHeader, setPeekHeader] = useState(false);
  const selection = useWorld((s) => s.selection);
  const bearing = useWorld((s) => s.bearing);
  const select = useWorld((s) => s.select);

  // 선택 자산의 레이어가 현재 고도에서 보이지 않으면 info 창 자동 닫힘
  // (트윈 모델은 L2~L3 전용 — 광역으로 줌아웃하면 닫힌다. 전 고도 자산은 선택 관통 유지)
  useEffect(() => {
    if (!selection) return;
    const allowed =
      selection.layerId === 'dt-models'
        ? ['L2', 'L3']
        : (LAYERS.find((l) => l.id === selection.layerId)?.tiers ?? TIERS);
    if (!allowed.includes(tier)) select(null);
  }, [tier, selection, select]);

  useEffect(() => {
    if (!peekHeader) return;
    const onMove = (e: MouseEvent) => {
      if (e.clientY > 110) setPeekHeader(false); // 헤더(100px) 아래로 벗어나면 숨김
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [peekHeader]);

  const hhmm = (h: number) =>
    `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  // 일출/일몰 (한일튜브 부지 기준, 6분 간격 스캔)
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

  // ── 진입: URL(?focus=모델 → 자산 포커스 · ?p= 프리셋 → ?t=·?lens=) → 초기 상태 ──
  useEffect(() => {
    if (booted) return;
    // ?focus=haniltube — 특정 트윈 자산에 착지 + 자동 선택(info 패널 노출). 발전사 로그인용.
    const focusModel = DT_MODELS.find((m) => m.id === params.get('focus'));
    if (focusModel) {
      setTier('L3');
      setLens(['monitor', 'grid']);
      setFlyTo({ center: focusModel.lngLat, zoom: 17.4, pitch: 60, bearing: -20 });
      // 모델 앵커와 동일한 selection 구성 → InfoPanel이 모니터링 실데이터 렌더
      useWorld.getState().select({
        assetId: `dt:model:${focusModel.id}`,
        layerId: 'dt-models',
        name: focusModel.name,
        props: {
          assetId: `dt:model:${focusModel.id}`,
          modelId: focusModel.id,
          name: focusModel.name,
          ...focusModel.props,
        },
        lngLat: focusModel.lngLat,
      });
      setBooted(true);
      return;
    }
    const preset = PRESETS[params.get('p') ?? ''];
    const t = (params.get('t') as Tier | null) ?? preset?.tier ?? null;
    const ls =
      params
        .get('lens')
        ?.split(',')
        .filter((x): x is LensKey => LENSES.some((d) => d.key === x)) ??
      preset?.lens ??
      null;
    if (t && TIERS.includes(t)) {
      setTier(t);
      setFlyTo(TIER_META[t].view);
    }
    if (ls && ls.length) setLens(ls);
    setBooted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted]);

  // ── 상태 → URL 반영 (딥링크·새로고침·공유) ──
  useEffect(() => {
    if (!booted) return;
    const q = new URLSearchParams();
    q.set('t', tier);
    if (lens.length) q.set('lens', lens.join(','));
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [tier, lens, booted]);

  return (
    // 기본 z-[60] — (main) 헤더(z-50) 위를 덮어 숨김. 상단 엣지 호버 시 z-40으로 내려 헤더 노출
    <div className={`fixed inset-0 ${peekHeader ? 'z-40' : 'z-[60]'} bg-[#060a14] text-white`}>
      {/* 상단 엣지 감지 스트립 — 마우스/터치로 헤더 소환 */}
      {!peekHeader && (
        <div
          className="absolute inset-x-0 top-0 z-40 h-2 cursor-pointer"
          onMouseEnter={() => setPeekHeader(true)}
          onTouchStart={() => setPeekHeader(true)}
        />
      )}
      <MapStage flyTo={flyTo} weather={weather} hour={hour} />

      {/* ── 우측 상단: 시각 위젯 (shadowmap 스타일) — 🕒 토글 시 표시 ── */}
      {timeOpen && (
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

      {/* ── 맵 중앙: 태양 다이얼 — 링 위 태양을 드래그해 시간 제어 ── */}
      {timeOpen && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <SunDial hour={hour} bearing={bearing} onHourChange={setHour} />
        </div>
      )}

      {/* ── 하단 중앙: 날씨(맑음/비/눈) + 시각 토글 ── */}
      <div className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center">
        <div className="flex items-center gap-1 rounded-xl bg-[#0d1520]/85 px-2 py-1.5 ring-1 ring-white/[0.08] backdrop-blur">
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

      {/* ── 상단 중앙: 렌즈칩 (도메인 토글 — 사이드바 트리 대체) ── */}
      <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-xl bg-[#0d1520]/85 px-2 py-1.5 ring-1 ring-white/[0.08] backdrop-blur">
        <span className="px-1 text-[10px] font-semibold text-slate-400">렌즈</span>
        {LENSES.map((l) => {
          const on = lens.includes(l.key);
          return (
            <button
              key={l.key}
              onClick={() => toggleLens(l.key)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                on ? 'bg-primary/25 text-white ring-1 ring-primary' : 'text-slate-400 hover:text-white'
              }`}
            >
              <i className="h-2 w-2 rounded-full" style={{ background: on ? l.color : '#475569' }} />
              {l.label}
            </button>
          );
        })}
      </div>

      {/* ── 왼쪽: LOD 레일 (세로축 = 고도. 버튼은 flyTo 점프 — 진실은 줌) ── */}
      <aside className="absolute left-3 top-3 z-30 flex w-[172px] flex-col gap-1.5">
        <div className="flex items-center gap-1.5 rounded-lg bg-[#0d1520]/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary ring-1 ring-white/[0.08] backdrop-blur">
          <Layers className="h-3.5 w-3.5" /> LOD · 줌 = 고도
        </div>
        <div className="flex flex-col gap-1">
          {TIERS.map((t) => {
            const m = TIER_META[t];
            const active = t === tier;
            return (
              <button
                key={t}
                // flyTo만 — tier는 착지 후 줌에서 계산(진실은 줌). 비행 시작 시 레이어 전환이 몰리는 끊김 방지
                onClick={() => setFlyTo({ ...m.view })}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                  active
                    ? 'border-primary bg-primary/15 ring-1 ring-primary'
                    : 'border-white/[0.06] bg-[#0d1520]/70 hover:border-white/20'
                }`}
              >
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-extrabold ${active ? 'bg-primary text-white' : 'bg-white/[0.06] text-slate-300'}`}
                >
                  {t}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-[13px] font-semibold leading-tight ${active ? 'text-white' : 'text-slate-300'}`}
                  >
                    {m.name}
                  </span>
                  <span className="block truncate text-[10px] text-slate-500">{m.sees}</span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── 오른쪽: info 패널 — 자산(건물) 클릭 시에만 슬라이드 인 ── */}
      <div
        className={`absolute bottom-0 right-0 top-0 z-10 w-full max-w-[440px] border-l border-white/[0.06] bg-[#0a101c]/90 backdrop-blur-sm transition-transform duration-300 ease-out ${
          selection ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        }`}
      >
        <InfoPanel />
      </div>
    </div>
  );
}
