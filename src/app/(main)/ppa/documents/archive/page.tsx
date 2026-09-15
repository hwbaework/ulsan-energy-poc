'use client';

import { useMemo, useState } from 'react';
import {
  FileText,
  Download,
  Printer,
  ChevronDown,
  Calendar as CalendarIcon,
  Sun,
  Wallet,
  TrendingDown,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { RmsBarLineChart } from '@/components/ui/Chart';
import { cn, exportPdf } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { usePpaContracts } from '@/hooks/ppa/usePpa';

/* ───────────────────────── Types ─────────────────────────
   이전 RE100/CFE 247/CDP 보고서 제거 — 한일튜브 운영 범위 외 (외부 평가/매칭률 인증
   인프라가 없어 이행 불가). 운영 결과 요약 형태의 연간 보고서만 유지.
*/

type ReportStatus = 'submitted' | 'draft' | 'upcoming';

const STATUS_META: Record<ReportStatus, { label: string; tone: string; bg: string; ring: string; icon: LucideIcon }> = {
  submitted: {
    label: '발급완료',
    tone: 'text-emerald-300',
    bg: 'bg-emerald-500/[0.08]',
    ring: 'ring-emerald-500/30',
    icon: CheckCircle2,
  },
  draft: {
    label: '진행 중',
    tone: 'text-amber-300',
    bg: 'bg-amber-500/[0.08]',
    ring: 'ring-amber-500/30',
    icon: Clock,
  },
  upcoming: {
    label: '예정',
    tone: 'text-slate-400',
    bg: 'bg-slate-500/[0.08]',
    ring: 'ring-slate-500/30',
    icon: AlertCircle,
  },
};

interface AnnualReport {
  id: string;
  year: number;
  status: ReportStatus;
  generatedAt: string | null;
  totalGenerationKwh: number;
  totalRentKrw: number;
  totalGridSavingKrw: number;
  totalNetSavingKrw: number;
}

interface MonthlySummary {
  month: string; // "YYYY-MM"
  generationKwh: number;
  rentKrw: number;
  gridSavingKrw: number;
  netSavingKrw: number;
}

/* ───────────────────────── 한일튜브 실측 데이터 ───────────────────────── */
//   계약 시작: 2026-01-15
//   2024/2025년: 계약 전 → 보고서 없음 (예정 상태)
//   2026년: 2~5월 운영 실측 (5월 진행 중) → 진행 중 상태

const MONTHLY_2026: MonthlySummary[] = [
  { month: '2월', generationKwh: 25_474, rentKrw: 3_005_952, gridSavingKrw: 5_500_000, netSavingKrw: 2_494_048 },
  { month: '3월', generationKwh: 41_563, rentKrw: 4_904_448, gridSavingKrw: 5_900_000, netSavingKrw: 995_552 },
  { month: '4월', generationKwh: 51_272, rentKrw: 4_746_240, gridSavingKrw: 6_133_200, netSavingKrw: 1_386_960 },
  { month: '5월', generationKwh: 53_999, rentKrw: 4_998_792, gridSavingKrw: 6_458_280, netSavingKrw: 1_459_488 }, // API 실값 (한일튜브 plant 17514, 5/29 기준 진행 중). 단가 ₩119.6 한전 / ₩92.6 라씨 정합
];

function sumMonthly(
  monthly: MonthlySummary[],
  key: keyof Pick<MonthlySummary, 'generationKwh' | 'rentKrw' | 'gridSavingKrw' | 'netSavingKrw'>,
) {
  return monthly.reduce((s, m) => s + (m[key] as number), 0);
}

const REPORTS: AnnualReport[] = [
  {
    id: 'r-2026',
    year: 2026,
    status: 'draft',
    generatedAt: null,
    totalGenerationKwh: sumMonthly(MONTHLY_2026, 'generationKwh'),
    totalRentKrw: sumMonthly(MONTHLY_2026, 'rentKrw'),
    totalGridSavingKrw: sumMonthly(MONTHLY_2026, 'gridSavingKrw'),
    totalNetSavingKrw: sumMonthly(MONTHLY_2026, 'netSavingKrw'),
  },
];

const MONTHLY_BY_YEAR: Record<number, MonthlySummary[]> = {
  2026: MONTHLY_2026,
};

/* "2026-02" → "2월" — 차트 라벨용 */
function formatMonthLabel(period: string): string {
  const [, pm] = period.split('-').map(Number);
  return pm ? `${pm}월` : period;
}

/* ───────────────────────── Page ───────────────────────── */

export default function PpaReportPage() {
  const { data: _apiContracts } = usePpaContracts();
  const [selectedYear, setSelectedYear] = useState<number>(REPORTS[0]?.year ?? 2026);
  const addToast = useToastStore((s) => s.add);

  const yearOptions = useMemo(() => [...new Set(REPORTS.map((r) => r.year))].sort((a, b) => b - a), []);

  const selectedReport = useMemo(() => REPORTS.find((r) => r.year === selectedYear), [selectedYear]);

  const monthlyForYear = MONTHLY_BY_YEAR[selectedYear] ?? [];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '문서', path: '/ppa/documents' }, { label: '연간 보고서' }]} />

      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">보고서</h1>
          <p className="mt-1 text-sm text-slate-400">
            직접 PPA 연간 운영 실적 종합 — 발전량 · PPA 요금 · 한전 절감 · 순절감
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dropdown
            align="right"
            trigger={
              <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08]">
                <CalendarIcon size={14} className="text-slate-500" />
                <span className="text-xs text-slate-500">연도</span>
                <span className="font-medium">{selectedYear}년</span>
                <ChevronDown size={14} className="text-slate-500" />
              </button>
            }
          >
            {yearOptions.map((y) => (
              <DropdownItem key={y} onClick={() => setSelectedYear(y)}>
                {y}년
              </DropdownItem>
            ))}
          </Dropdown>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (!selectedReport) {
                addToast('error', '보고서가 없습니다');
                return;
              }
              exportPdf(
                `운영보고서_${selectedYear}`,
                `${selectedYear}년 연간 운영 보고서`,
                ['항목', '값'],
                [
                  ['연간 발전량', `${(selectedReport.totalGenerationKwh / 1000).toFixed(1)} MWh`],
                  ['PPA 요금 합계', `₩${selectedReport.totalRentKrw.toLocaleString()}`],
                  ['한전 절감', `₩${selectedReport.totalGridSavingKrw.toLocaleString()}`],
                  ['순 절감', `₩${selectedReport.totalNetSavingKrw.toLocaleString()}`],
                ],
              );
            }}
          >
            <Download size={14} className="mr-1.5" />
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* KPI 4 — 연간 누적 */}
      {selectedReport ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<Sun size={18} className="text-amber-400" />}
            label="연간 발전량"
            value={`${(selectedReport.totalGenerationKwh / 1000).toFixed(1)} MWh`}
            sub={`${monthlyForYear.length}개월 실측`}
          />
          <KpiCard
            icon={<Wallet size={18} className="text-rose-400" />}
            label="연간 PPA 요금 (총 청구)"
            value={`₩${selectedReport.totalRentKrw.toLocaleString()}`}
          />
          <KpiCard
            icon={<TrendingDown size={18} className="text-emerald-400" />}
            label="연간 한전 절감"
            value={`₩${selectedReport.totalGridSavingKrw.toLocaleString()}`}
          />
          <KpiCard
            icon={<Activity size={18} className="text-emerald-300" />}
            label="연간 순절감"
            value={`₩${selectedReport.totalNetSavingKrw.toLocaleString()}`}
            highlight
          />
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-500">
          {selectedYear}년 보고서 데이터가 없습니다
        </div>
      )}

      {/* 월별 추이 차트 */}
      {monthlyForYear.length > 0 && (
        <SectionCard
          title="월별 PPA 요금 vs 한전 절감 추이"
          description={`${selectedYear}년 · ${monthlyForYear.length}개월 누적`}
        >
          <div>
            <RmsBarLineChart
              data={monthlyForYear.map((m) => ({
                month: formatMonthLabel(m.month),
                rent: Math.round(m.rentKrw / 1000),
                saving: Math.round(m.gridSavingKrw / 1000),
                net: Math.round(m.netSavingKrw / 1000),
              }))}
              xKey="month"
              bars={[
                { key: 'rent', name: 'PPA 요금 (천원)', color: '#F43F5E' },
                { key: 'saving', name: '한전 절감 (천원)', color: '#10B981' },
              ]}
              lines={[{ key: 'net', name: '순절감 (천원)', color: '#6366F1' }]}
              yUnit="천원"
              height={280}
            />
          </div>
        </SectionCard>
      )}

      {/* 월별 명세 표 */}
      {monthlyForYear.length > 0 && (
        <SectionCard title="월별 명세" description={`${selectedYear}년 운영 실적 정합 (정산 페이지와 동일 값)`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-white/[0.06] text-xs text-slate-500 bg-white/[0.02]">
                  <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">월</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">발전량</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-rose-300">PPA 요금</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap text-emerald-400">한전 절감</th>
                  <th className="px-3 py-2.5 font-medium whitespace-nowrap">순절감</th>
                </tr>
              </thead>
              <tbody>
                {[...monthlyForYear].reverse().map((m) => (
                  <tr key={m.month} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-3 py-3 text-slate-300 tabular-nums text-xs whitespace-nowrap">
                      {formatMonthLabel(m.month)}
                    </td>
                    <td className="px-3 py-3 text-slate-300 tabular-nums text-xs">
                      {(m.generationKwh / 1000).toFixed(1)} MWh
                    </td>
                    <td className="px-3 py-3 text-rose-300 font-bold tabular-nums text-xs">
                      ₩{m.rentKrw.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-emerald-400 tabular-nums text-xs">
                      ₩{m.gridSavingKrw.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-xs font-semibold">
                      <span className={cn(m.netSavingKrw >= 0 ? 'text-emerald-400' : 'text-amber-400')}>
                        {m.netSavingKrw >= 0 ? '+' : ''}₩{m.netSavingKrw.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {monthlyForYear.length > 1 && (
                <tfoot>
                  <tr className="bg-white/[0.02]">
                    <td className="px-3 py-3 text-sm text-slate-400">합계</td>
                    <td className="px-3 py-3 text-slate-200 font-semibold tabular-nums text-xs">
                      {(sumMonthly(monthlyForYear, 'generationKwh') / 1000).toFixed(1)} MWh
                    </td>
                    <td className="px-3 py-3 text-rose-200 font-bold tabular-nums text-xs">
                      ₩{sumMonthly(monthlyForYear, 'rentKrw').toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-emerald-300 font-bold tabular-nums text-xs">
                      ₩{sumMonthly(monthlyForYear, 'gridSavingKrw').toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-emerald-300 font-bold tabular-nums text-xs">
                      ₩{sumMonthly(monthlyForYear, 'netSavingKrw').toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </SectionCard>
      )}

      {/* 보고서 발급 이력 */}
      <SectionCard title="발급 이력" description={`${REPORTS.length}건 — 연간 보고서`}>
        <div className="divide-y divide-white/[0.04]">
          {REPORTS.length === 0 ? (
            <div className="px-62 text-center text-sm text-slate-500">발급 이력이 없습니다</div>
          ) : (
            REPORTS.map((r) => {
              const sm = STATUS_META[r.status];
              return (
                <div key={r.id} className="flex items-center gap-3 px-6 py-3 hover:bg-white/[0.02] transition-colors">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-amber-500/[0.10] ring-1 ring-amber-500/30">
                    <FileText size={14} className="text-amber-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{r.year}년 운영 보고서</p>
                    <p className="text-[11px] text-slate-500">
                      {r.status === 'submitted'
                        ? `발급일 ${r.generatedAt}`
                        : r.status === 'draft'
                          ? '운영 진행 중 (연말 발급 예정)'
                          : '연도 시작 전'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1',
                      sm.bg,
                      sm.tone,
                      sm.ring,
                    )}
                  >
                    <sm.icon size={10} />
                    {sm.label}
                  </span>
                  <div className="flex items-center gap-1 ml-3">
                    <button
                      onClick={() =>
                        exportPdf(
                          `운영보고서_${r.year}`,
                          `${r.year}년 운영 보고서`,
                          ['항목', '값'],
                          [
                            ['연간 발전량', `${(r.totalGenerationKwh / 1000).toFixed(1)} MWh`],
                            ['PPA 요금 합계', `₩${r.totalRentKrw.toLocaleString()}`],
                            ['한전 절감', `₩${r.totalGridSavingKrw.toLocaleString()}`],
                            ['순 절감', `₩${r.totalNetSavingKrw.toLocaleString()}`],
                          ],
                        )
                      }
                      className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                      title="미리보기"
                    >
                      <FileText size={14} />
                    </button>
                    <button
                      onClick={() =>
                        exportPdf(
                          `운영보고서_${r.year}`,
                          `${r.year}년 운영 보고서`,
                          ['항목', '값'],
                          [
                            ['연간 발전량', `${(r.totalGenerationKwh / 1000).toFixed(1)} MWh`],
                            ['PPA 요금 합계', `₩${r.totalRentKrw.toLocaleString()}`],
                            ['한전 절감', `₩${r.totalGridSavingKrw.toLocaleString()}`],
                            ['순 절감', `₩${r.totalNetSavingKrw.toLocaleString()}`],
                          ],
                        )
                      }
                      className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                      title="다운로드"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => {
                        window.print();
                      }}
                      className="rounded p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-white"
                      title="인쇄"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/* ───────────────────────── Sub-components ───────────────────────── */

function KpiCard({
  icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        highlight
          ? 'border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20'
          : 'border-white/[0.06] bg-surface-card',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs text-slate-400">{label}</p>
      </div>
      <p className={cn('text-xl font-bold tabular-nums', highlight ? 'text-emerald-300' : 'text-white')}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
