import { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const CHART_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
];

interface ChartWrapperProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  height?: number;
  className?: string;
}

function ChartWrapper({ title, description, children, height = 300, className }: ChartWrapperProps) {
  return (
    <div className={cn('rounded-xl bg-[#1a2332] ring-1 ring-white/[0.06] p-5', className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
          {description && <p className="mt-0.5 text-xs text-slate-400">{description}</p>}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

type TooltipEntry = { color?: string; name?: string; value?: number };

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
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
      className="rounded-lg bg-[#0f1720] ring-1 ring-white/10 px-3 py-2 shadow-xl text-xs transition-all duration-300 ease-out"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(4px)',
      }}
    >
      <p className="font-medium text-slate-400 mb-1">{cached.label}</p>
      {cached.payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-400">{entry.name}:</span>
          <span className="font-medium text-white">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

const axisStyle = { fontSize: 11, fill: '#64748b' };
const gridStyle = { stroke: 'rgba(255,255,255,0.04)' };

// ── Line Chart ──

interface LineChartData {
  [key: string]: string | number;
}

interface RmsLineChartProps {
  data: LineChartData[];
  xKey: string;
  lines: { key: string; name: string; color?: string }[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
}

export function RmsLineChart({ data, xKey, lines, title, description, height, className }: RmsLineChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        {lines.map((line, i) => (
          <Line
            key={line.key}
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </LineChart>
    </ChartWrapper>
  );
}

// ── Area Chart ──

interface RmsAreaChartProps {
  data: LineChartData[];
  xKey: string;
  areas: { key: string; name: string; color?: string }[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  stacked?: boolean;
}

export function RmsAreaChart({ data, xKey, areas, title, description, height, className, stacked }: RmsAreaChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <AreaChart data={data}>
        <defs>
          {areas.map((area, i) => {
            const color = area.color ?? CHART_COLORS[i % CHART_COLORS.length];
            return (
              <linearGradient key={area.key} id={`gradient-${area.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        {areas.map((area, i) => (
          <Area
            key={area.key}
            type="monotone"
            dataKey={area.key}
            name={area.name}
            stroke={area.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            fill={`url(#gradient-${area.key})`}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </AreaChart>
    </ChartWrapper>
  );
}

// ── Bar Chart ──

interface RmsBarChartProps {
  data: LineChartData[];
  xKey: string;
  bars: { key: string; name: string; color?: string }[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  stacked?: boolean;
}

export function RmsBarChart({ data, xKey, bars, title, description, height, className, stacked }: RmsBarChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <BarChart data={data} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        {bars.map((bar, i) => (
          <Bar
            key={bar.key}
            dataKey={bar.key}
            name={bar.name}
            fill={bar.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </BarChart>
    </ChartWrapper>
  );
}

// ── Pie / Donut Chart ──

interface PieData {
  name: string;
  value: number;
  color?: string;
}

interface RmsPieChartProps {
  data: PieData[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  donut?: boolean;
}

export function RmsPieChart({ data, title, description, height = 280, className, donut = false }: RmsPieChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={donut ? '55%' : 0}
          outerRadius="80%"
          dataKey="value"
          stroke="none"
          labelLine={false}
          label={({ name, percent }: { name?: string; percent?: number }) =>
            `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
        >
          {data.map((entry, i) => (
            <Cell key={entry.name} fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ChartWrapper>
  );
}

// ── Stacked Area + Line Combo Chart (자원별 누적 + 비교 라인) ──

interface AreaLineChartProps {
  data: LineChartData[];
  xKey: string;
  areas: { key: string; name: string; color?: string }[];
  lines: { key: string; name: string; color?: string; dashed?: boolean }[];
  stacked?: boolean;
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  yUnit?: string;
}

export function RmsAreaLineChart({
  data,
  xKey,
  areas,
  lines,
  stacked = true,
  title,
  description,
  height,
  className,
  yUnit,
}: AreaLineChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} unit={yUnit} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        {areas.map((a, i) => {
          const color = a.color ?? CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Area
              key={a.key}
              type="monotone"
              dataKey={a.key}
              name={a.name}
              stackId={stacked ? '1' : undefined}
              stroke={color}
              fill={color}
              fillOpacity={0.25}
              strokeWidth={1.5}
            />
          );
        })}
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color ?? CHART_COLORS[(areas.length + i) % CHART_COLORS.length]}
            strokeWidth={2}
            strokeDasharray={l.dashed ? '6 4' : undefined}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </ComposedChart>
    </ChartWrapper>
  );
}

// ── Bar + Line Combo Chart (실적 막대 + 목표 점선 라인) ──

interface BarLineChartProps {
  data: LineChartData[];
  xKey: string;
  bars: { key: string; name: string; color?: string; barSize?: number; radius?: number }[];
  lines: { key: string; name: string; color?: string; dashed?: boolean }[];
  title?: string;
  description?: string;
  height?: number;
  className?: string;
  yUnit?: string;
  yDomain?: [number | 'auto', number | 'auto'];
}

export function RmsBarLineChart({
  data,
  xKey,
  bars,
  lines,
  title,
  description,
  height,
  className,
  yUnit,
  yDomain,
}: BarLineChartProps) {
  return (
    <ChartWrapper title={title} description={description} height={height} className={className}>
      <ComposedChart data={data}>
        <CartesianGrid strokeDasharray="3 3" {...gridStyle} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={45} unit={yUnit} domain={yDomain} />
        <Tooltip content={<CustomTooltip />} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
        {bars.map((b, i) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name}
            fill={b.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            radius={[b.radius ?? 4, b.radius ?? 4, 0, 0]}
            barSize={b.barSize ?? 22}
          />
        ))}
        {lines.map((l, i) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.name}
            stroke={l.color ?? CHART_COLORS[(bars.length + i) % CHART_COLORS.length]}
            strokeWidth={2}
            strokeDasharray={l.dashed ? '6 4' : undefined}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </ComposedChart>
    </ChartWrapper>
  );
}

export { CHART_COLORS };
