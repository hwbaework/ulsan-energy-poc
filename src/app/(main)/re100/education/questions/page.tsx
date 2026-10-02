'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronDown, ChevronRight, ListChecks, Pencil } from 'lucide-react';
import { CollapsibleSectionCard } from '@/components/features';
import { EmptyState } from '@/components/ui/EmptyState';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { getBasicReports, getEduMonths, getReportsByMonth } from '@/lib/mock-education';
import { useEducationContentStore } from '@/stores/useEducationContentStore';
import type { EduQuizQuestion, EduReport } from '@/types/education';
import { isPublished, isQuizOpen } from '@/types/education';

interface QuestionRow {
  report: EduReport;
  question: EduQuizQuestion;
}

function toRows(reports: EduReport[]): QuestionRow[] {
  return reports
    .filter((r) => r.questions.length > 0)
    .flatMap((report) => report.questions.map((question) => ({ report, question })));
}

function QuestionList({ rows }: { rows: QuestionRow[] }) {
  const router = useRouter();
  return (
    <div className="divide-y divide-white/[0.05]">
      {rows.map(({ report, question }, i) => (
        <div key={question.id} className="flex items-start gap-3 px-5 py-4">
          <span className="mt-0.5 shrink-0 text-sm font-semibold text-emerald-400">Q{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white leading-6">{question.question}</p>
            <p className="mt-1 text-xs text-emerald-400/80 flex items-center gap-1">
              <CheckCircle2 size={11} /> 정답: {question.options[question.answerIndex]}
            </p>
            <p className="mt-1 text-xs text-slate-500 truncate">
              {report.title}
              {!isPublished(report) && <span className="ml-2 text-amber-400/80">(초안 — 발행하면 출제)</span>}
            </p>
          </div>
          <button
            type="button"
            title="자료에서 문항 수정"
            onClick={() => router.push(`/re100/education/editor?id=${report.id}`)}
            className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <Pencil size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EducationQuestionsPage() {
  const reports = useEducationContentStore((s) => s.reports);

  const months = getEduMonths(reports).filter((month) =>
    getReportsByMonth(reports, month).some((r) => r.questions.length > 0),
  );
  const basicRows = toRows(getBasicReports(reports));
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const latestYear = years[0];
  const latestMonth = months[0];

  const [openYears, setOpenYears] = useState<Record<string, boolean>>(() => (latestYear ? { [latestYear]: true } : {}));

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={[{ label: 'RE100', path: '/re100' }, { label: 'RE100 교육', path: '/re100/education' }, { label: '문항 관리' }]} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">문항 관리</h1>
      </div>

      {months.length === 0 && basicRows.length === 0 && (
        <EmptyState
          icon={<ListChecks size={48} />}
          title="등록된 문항이 없습니다"
          description="교육 자료에 쪽지시험 문항을 추가하면 여기에 모아 표시됩니다."
        />
      )}

      {basicRows.length > 0 && (
        <CollapsibleSectionCard
          title="기본 문항"
          count={basicRows.length}
          countUnit="문항"
          description="상시 응시"
          defaultOpen
        >
          <QuestionList rows={basicRows} />
        </CollapsibleSectionCard>
      )}

      {years.map((year) => {
        const yearMonths = months.filter((m) => m.startsWith(year));
        const yearCount = yearMonths.reduce((sum, m) => sum + toRows(getReportsByMonth(reports, m)).length, 0);
        const yearOpen = openYears[year] ?? false;

        return (
          <section key={year} className="space-y-3">
            <button
              type="button"
              onClick={() => setOpenYears((prev) => ({ ...prev, [year]: !yearOpen }))}
              className="flex w-full items-center gap-2 text-left"
            >
              {yearOpen ? (
                <ChevronDown size={16} className="text-slate-400" />
              ) : (
                <ChevronRight size={16} className="text-slate-400" />
              )}
              <h2 className="text-base font-semibold text-white">{year}년</h2>
              <span className="text-xs text-slate-500">
                {yearMonths.length}개월 · {yearCount}문항
              </span>
            </button>

            {yearOpen &&
              yearMonths.map((month) => {
                const rows = toRows(getReportsByMonth(reports, month));
                return (
                  <CollapsibleSectionCard
                    key={month}
                    title={`${Number(month.slice(5))}월 문항`}
                    count={rows.length}
                    countUnit="문항"
                    description={isQuizOpen(month) ? '시험 오픈됨' : '월 종료 후 시험 오픈'}
                    defaultOpen={month === latestMonth}
                  >
                    <QuestionList rows={rows} />
                  </CollapsibleSectionCard>
                );
              })}
          </section>
        );
      })}
    </div>
  );
}
