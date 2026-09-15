import { useState, useCallback, useRef, useEffect, type WheelEvent } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface DataPoint {
  [key: string]: string | number;
}

interface ScrollableLineProps {
  key: string;
  name: string;
  color: string;
  type?: 'line' | 'area';
}

interface ScrollableChartProps {
  data: DataPoint[];
  xKey: string;
  lines: ScrollableLineProps[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  initialWindow?: number;
  minWindow?: number;
  maxWindow?: number;
}

type TooltipEntry = { color?: string; name?: string; value?: number };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  const [visible, setVisible] = useState(false);
  const [cached, setCached] = useState<{ payload: TooltipEntry[]; label?: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (active && payload?.length) {
      clearTimeout(timerRef.current);
      setCached({ payload, label });
      window.requestAnimationFrame(() => {
        setVisible(true);
      });
    } else {
      setVisible(false);
      timerRef.current = setTimeout(() => setCached(null), 400);
    }
    return () => clearTimeout(timerRef.current);
  }, [active, payload, label]);

  if (!cached) return null;

  return (
    <div
      className="rounded-lg bg-[#0f1720] ring-1 ring-white/10 px-3 py-2.5 shadow-xl text-xs transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(4px)',
      }}
    >
      <p className="font-medium text-white mb-1.5">{cached.label}</p>
      {cached.payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{entry.name}</span>
          </div>
          <span className="font-semibold text-white tabular-nums">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

const axisStyle = { fontSize: 11, fill: '#64748b' };

export function ScrollableChart({
  data,
  xKey,
  lines,
  title,
  description,
  height = 360,
  className,
  initialWindow = 30,
  minWindow = 7,
  maxWindow = 90,
}: ScrollableChartProps) {
  const total = data.length;
  const [windowSize, setWindowSize] = useState(Math.min(initialWindow, total));
  const [offset, setOffset] = useState(Math.max(0, total - initialWindow));
  const chartRef = useRef<HTMLDivElement>(null);

  const visibleData = data.slice(offset, offset + windowSize);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Zoom
        setWindowSize((prev) => {
          const next = Math.round(prev + (e.deltaY > 0 ? 5 : -5));
          const clamped = Math.max(minWindow, Math.min(maxWindow, next, total));
          setOffset((o) => Math.min(o, total - clamped));
          return clamped;
        });
      } else {
        // Pan
        setOffset((prev) => {
          const step = e.deltaY > 0 ? 3 : -3;
          return Math.max(0, Math.min(total - windowSize, prev + step));
        });
      }
    },
    [windowSize, total, minWindow, maxWindow],
  );

  const progress = total > windowSize ? offset / (total - windowSize) : 0;
  const zoomPercent = Math.round((windowSize / total) * 100);

  const hasArea = lines.some((l) => l.type === 'area');
  const ChartComponent = hasArea ? AreaChart : LineChart;

  return (
    <div className={cn('rounded-xl bg-[#1a2332] ring-1 ring-white/[0.06]', className)}>
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-2">
        <div>
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="tabular-nums">
            {offset + 1}–{Math.min(offset + windowSize, total)} / {total}
          </span>
          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-400 tabular-nums">{zoomPercent}%</span>
        </div>
      </div>

      {/* Chart area */}
      <div
        ref={chartRef}
        onWheel={handleWheel}
        className="px-2 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <ResponsiveContainer width="100%" height={height}>
          <ChartComponent data={visibleData}>
            <defs>
              {lines
                .filter((l) => l.type === 'area')
                .map((line) => (
                  <linearGradient key={`grad-${line.key}`} id={`scroll-grad-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={line.color} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={line.color} stopOpacity={0} />
                  </linearGradient>
                ))}
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
            <XAxis
              dataKey={xKey}
              tick={axisStyle}
              axisLine={false}
              tickLine={false}
              interval={Math.max(0, Math.floor(windowSize / 8) - 1)}
            />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<ChartTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8', paddingTop: 8 }} />
            {lines.map((line) =>
              line.type === 'area' ? (
                <Area
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  fill={`url(#scroll-grad-${line.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ) : (
                <Line
                  key={line.key}
                  type="monotone"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ),
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Scrollbar + controls */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-1">
        {/* Mini track */}
        <div className="relative flex-1 h-1.5 rounded-full bg-white/[0.04]">
          <div
            className="absolute top-0 h-full rounded-full bg-blue-500/30 transition-all duration-100"
            style={{
              left: `${progress * (100 - (windowSize / total) * 100)}%`,
              width: `${Math.max(8, (windowSize / total) * 100)}%`,
            }}
          />
        </div>

        {/* Zoom buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setWindowSize((w) => {
                const next = Math.max(minWindow, w - 7);
                setOffset((o) => Math.min(o, total - next));
                return next;
              });
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors text-xs font-bold"
            aria-label="확대"
          >
            +
          </button>
          <button
            onClick={() => {
              setWindowSize((w) => {
                const next = Math.min(maxWindow, total, w + 7);
                setOffset((o) => Math.min(o, total - next));
                return next;
              });
            }}
            className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors text-xs font-bold"
            aria-label="축소"
          >
            −
          </button>
        </div>
      </div>

      {/* Help text */}
      <div className="px-5 pb-3 text-[10px] text-slate-600 text-center">
        스크롤: 탐색 &nbsp;·&nbsp; ⌘+스크롤: 확대/축소 &nbsp;·&nbsp; 또는 +/− 버튼
      </div>
    </div>
  );
}
