'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Award, BadgeCheck, CheckCircle2, ChevronRight, Download, Lock, PenLine, Pencil, Plus, Trash2 } from 'lucide-react';
import { SectionCard } from '@/components/features';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/Design';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { getBasicReports, getEduMonths, getMonthlyQuiz, getReportsByMonth } from '@/lib/mock-education';
import { useEducationStore, useHydrateEducation } from '@/stores/useEducationStore';
import { exportCertificatePdf } from '@/lib/utils';
import { useEducationContentStore } from '@/stores/useEducationContentStore';
import { useToastStore } from '@/stores/useToastStore';
import { DataSourcePanel } from './DataSourcePanel';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import { BASIC_GROUP, formatMonthKo, isPublished, isQuizOpen, isMonthClosed } from '@/types/education';

function EducationInner() {
  useHydrateEducation();
  const router = useRouter();
  const certificates = useEducationStore((s) => s.certificates);
  const readReportIds = useEducationStore((s) => s.readReportIds);
  const progressByMonth = useEducationStore((s) => s.progressByMonth);
  const reports = useEducationContentStore((s) => s.reports);
  const deleteReport = useEducationContentStore((s) => s.deleteReport);
  const setStatus = useEducationContentStore((s) => s.setStatus);
  const toast = useToastStore((s) => s.add);

  // 관리자(SPC)만 작성·발행·삭제. 전기사용자·발전사업자는 열람·시험·수료증
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['admin', 'spc'].includes(getPersona(user));

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // "기본" 그룹을 맨 앞에, 그 다음 월별 그룹 (기본 자료가 있을 때만 기본 그룹 노출)
  // 관리자는 초안까지, 사용자는 발행된 자료만
  const visible = isAdmin ? reports : reports.filter(isPublished);
  const hasBasic = getBasicReports(visible).length > 0;
  const groups = [...(hasBasic ? [BASIC_GROUP] : []), ...getEduMonths(visible)];
  const deleteTarget = reports.find((r) => r.id === deleteTargetId);

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb items={isAdmin ? [{ label: 'RE100', path: '/re100' }, { label: 'RE100 교육', path: '/re100/education' }, { label: '교육 자료' }] : [{ label: 'RE100', path: '/re100' }, { label: 'RE100 교육' }]} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{isAdmin ? '교육 자료' : 'RE100 교육'}</h1>
        </div>
        {isAdmin && (
          <Link href="/re100/education/editor">
            <Button>
              <Plus size={15} className="mr-1.5" /> 새 자료 작성
            </Button>
          </Link>
        )}
      </div>

      {/* 자료 수집 — 관리자만. 소스(API·크롤링)에서 모은 글을 건별로 [초안 만들기] / [발행 안 함] */}
      {isAdmin && <DataSourcePanel />}

      {/* 내 수료증 — 쪽지시험 전 문항을 맞히면 자동 발급(사업계획서 p.142 수료증 발급/관리) */}
      {!isAdmin && certificates.length > 0 && (
        <SectionCard title="내 수료증" noPadding>
          <div className="divide-y divide-white/[0.05]">
            {certificates.map((cert) => (
              <div key={cert.id} className="flex items-center gap-4 px-5 py-3">
                <Award size={16} className="shrink-0 text-violet-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{cert.courseTitle}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    {cert.certificateNo} · 발급일 {cert.issuedAt}
                  </p>
                </div>
                <Button size="sm" onClick={() => exportCertificatePdf(cert)}>
                  <Download size={14} className="mr-1" /> 수료증 PDF
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {groups.map((month) => {
        const isBasic = month === BASIC_GROUP;
        const monthReports = getReportsByMonth(visible, month);
        const quiz = getMonthlyQuiz(reports, month); // 기본 정보도 쪽지시험 — 월별과 같은 자리(카드 제목 오른쪽), 언제든 응시
        const progress = progressByMonth[month];
        const quizIds = new Set(quiz.map((q) => q.id));
        const solvedCount = (progress?.correctQuestionIds ?? []).filter((id) => quizIds.has(id)).length;
        const completed = quiz.length > 0 && solvedCount >= quiz.length;

        return (
          <SectionCard
            key={month}
            title={formatMonthKo(month)}
            noPadding
            actions={
              quiz.length > 0 &&
              (completed ? (
                <span className="flex items-center gap-2">
                  <StatusPill tone="normal" label="이수 완료" />
                  {!isAdmin && (
                    <Button size="sm" onClick={() => router.push(`/re100/education/quiz?month=${month}`)}>
                      <Award size={14} className="mr-1" /> 수료증
                    </Button>
                  )}
                </span>
              ) : !isQuizOpen(month) ? (
                <span className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 ring-1 ring-white/[0.06] text-sm text-slate-500">
                  <Lock size={13} />
                  <span>쪽지시험은 {formatMonthKo(month)} 종료 후 오픈</span>
                </span>
              ) : (
                <Button size="sm" onClick={() => router.push(`/re100/education/quiz?month=${month}`)}>
                  <PenLine size={14} />
                  <span>{isBasic ? '기본 쪽지시험' : '월간 쪽지시험'}</span>
                  <span className="text-xs text-white/80">
                    {solvedCount}/{quiz.length} 문항
                  </span>
                </Button>
              ))
            }
          >
            {/* 자료 목록 */}
            <div className="divide-y divide-white/[0.05]">
              {monthReports.map((report) => {
                const isRead = readReportIds.includes(report.id);
                return (
                  <div
                    key={report.id}
                    onClick={() => router.push(`/re100/education/report?id=${report.id}`)}
                    className="group flex cursor-pointer items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="w-[76px] shrink-0 text-xs text-slate-500 tabular-nums">
                      {report.basic ? '' : report.publishedAt}
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <h3 className="text-sm font-medium text-white truncate">{report.title}</h3>
                      {!isPublished(report) && <Badge variant="warning">초안</Badge>}
                      {isRead && <CheckCircle2 size={13} className="shrink-0 text-emerald-500/70" />}
                    </div>
                    <Badge variant="default" className="shrink-0">
                      {report.sourceName ?? '직접 작성'}
                    </Badge>
                    {isAdmin && (
                      <div className="flex shrink-0 items-center gap-1">
                        {/* 끝난 달 초안은 발행 불가 — 그 달 쪽지시험 문항이 바뀌지 않게 */}
                        {!isPublished(report) && (report.basic || !isMonthClosed(report.publishedAt.slice(0, 7))) && (
                          <button
                            type="button"
                            title="발행"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatus(report.id, 'published');
                              toast('success', '자료가 발행되었습니다. 문항이 월간 쪽지시험에 포함됩니다.');
                            }}
                            className="flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/15 transition-colors"
                          >
                            <BadgeCheck size={14} /> 발행
                          </button>
                        )}
                        <button
                          type="button"
                          title="수정"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/re100/education/editor?id=${report.id}`);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          title="삭제"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTargetId(report.id);
                          }}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                    <ChevronRight
                      size={15}
                      className="shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5"
                    />
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}

      <ConfirmDialog
        open={deleteTargetId != null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            deleteReport(deleteTargetId);
            toast('success', '교육 자료가 삭제되었습니다.');
          }
          setDeleteTargetId(null);
        }}
        title="교육 자료 삭제"
        message={`「${deleteTarget?.title ?? ''}」 자료를 삭제할까요? 해당 자료의 쪽지시험 문항도 함께 제외됩니다.`}
        confirmLabel="삭제"
        variant="danger"
      />
    </div>
  );
}

export default function EducationPage() {
  return (
    <Suspense fallback={null}>
      <EducationInner />
    </Suspense>
  );
}
