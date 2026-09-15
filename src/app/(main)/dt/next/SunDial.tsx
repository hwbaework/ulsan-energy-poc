'use client';

// 맵 중앙 태양 다이얼 (shadowmap 스타일) — 나침반 링 위에 태양 궤적과 현재 태양 위치를 그리고,
// 태양 핸들을 링 위로 드래그하면 방위각을 시각으로 역산해 시간이 바뀐다.
// 방위각은 맵 베어링을 보정해 실제 지도 방위와 일치시킨다.
import { useRef } from 'react';
import { sunPositionDeg, dateAtHour, SUN_REF } from './MapStage';

const R = 150; // 링 반지름(px)
const PAD = 44; // 라벨 여백
const SIZE = (R + PAD) * 2;
const C = SIZE / 2;

function hhmm(h: number): string {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
}

export function SunDial({
  hour,
  bearing,
  onHourChange,
}: {
  hour: number;
  bearing: number;
  onHourChange: (h: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const toXY = (azimuthDeg: number, r = R) => {
    const a = ((azimuthDeg - bearing) * Math.PI) / 180; // 화면각 = 방위각 - 맵 베어링
    return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) };
  };

  const sun = sunPositionDeg(dateAtHour(hour), SUN_REF.lat, SUN_REF.lng);
  const sunXY = toXY(sun.azimuthDeg);
  const up = sun.altitudeDeg > 0;

  // 매시 궤적 틱 (낮 = 노랑, 밤 = 회색)
  const ticks = Array.from({ length: 24 }, (_, h) => {
    const p = sunPositionDeg(dateAtHour(h), SUN_REF.lat, SUN_REF.lng);
    return { ...toXY(p.azimuthDeg), up: p.altitudeDeg > 0, h };
  });

  // 화면 좌표 → 방위각 → 가장 가까운 시각 역산
  const pointToHour = (clientX: number, clientY: number): number => {
    const el = svgRef.current;
    if (!el) return hour;
    const rect = el.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const screenDeg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const target = (screenDeg + bearing + 360) % 360;
    let best = hour,
      bd = Infinity;
    for (let h = 0; h < 24; h += 0.05) {
      const az = sunPositionDeg(dateAtHour(h), SUN_REF.lat, SUN_REF.lng).azimuthDeg;
      const d = Math.min(Math.abs(az - target), 360 - Math.abs(az - target));
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return Math.round(best * 20) / 20;
  };

  const cardinal = (['N', 'E', 'S', 'W'] as const).map((label, i) => {
    const p = toXY(i * 90, R + 24);
    return { label, ...p };
  });

  return (
    <svg
      ref={svgRef}
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="pointer-events-none select-none"
      onPointerMove={(e) => {
        if (draggingRef.current) onHourChange(pointToHour(e.clientX, e.clientY));
      }}
      onPointerUp={(e) => {
        draggingRef.current = false;
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      }}
    >
      {/* 링 — 밝은 지도 위에서도 읽히도록 어두운 톤 + 흰 하이라이트 이중선 */}
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(15,23,42,0.5)" strokeWidth="2.5" />
      <circle cx={C} cy={C} r={R} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1" />
      <circle cx={C} cy={C} r={R - 14} fill="none" stroke="rgba(15,23,42,0.2)" strokeWidth="1" />
      {/* 방위 라벨 */}
      {cardinal.map((cp) => (
        <text
          key={cp.label}
          x={cp.x}
          y={cp.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="14"
          fontWeight="800"
          fill={cp.label === 'N' ? '#f87171' : 'rgba(255,255,255,0.85)'}
          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.5)', strokeWidth: 3 }}
        >
          {cp.label}
        </text>
      ))}
      {/* 매시 궤적 틱 */}
      {ticks.map((t) => (
        <circle
          key={t.h}
          cx={t.x}
          cy={t.y}
          r={t.up ? 3 : 2}
          fill={t.up ? 'rgba(250,204,21,0.9)' : 'rgba(148,163,184,0.5)'}
        />
      ))}
      {/* 태양 → 중심 광선 */}
      <line
        x1={C}
        y1={C}
        x2={sunXY.x}
        y2={sunXY.y}
        stroke={up ? 'rgba(250,204,21,0.65)' : 'rgba(148,163,184,0.4)'}
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      {/* 태양 핸들 (드래그) */}
      <g
        className="pointer-events-auto cursor-grab"
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
      >
        <circle
          cx={sunXY.x}
          cy={sunXY.y}
          r={16}
          fill={up ? '#facc15' : '#64748b'}
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="2"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
        />
        <text x={sunXY.x} y={sunXY.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize="13">
          ☀️
        </text>
        {/* 시각 배지 */}
        <rect
          x={sunXY.x - 26}
          y={sunXY.y - 42}
          width={52}
          height={20}
          rx={6}
          fill="rgba(13,21,32,0.92)"
          stroke="rgba(255,255,255,0.15)"
        />
        <text
          x={sunXY.x}
          y={sunXY.y - 31}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="11"
          fontWeight="800"
          fill="#fff"
        >
          {hhmm(hour)}
        </text>
      </g>
    </svg>
  );
}
