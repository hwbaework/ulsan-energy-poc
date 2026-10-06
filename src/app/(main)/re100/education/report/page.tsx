'use client';

import { BackButton } from '@/components/layout/PageTitle';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, CalendarDays, ExternalLink, FileQuestion, Lock, Paperclip, Pencil, PenLine, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { getRoundQuiz } from '@/lib/mock-education';
import { useEducationStore, useHydrateEducation } from '@/stores/useEducationStore';
import { useEducationContentStore } from '@/stores/useEducationContentStore';
import { useToastStore } from '@/stores/useToastStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { getPersona } from '@/lib/persona';
import { formatRound, isPublished, isQuizOpen, isRoundClosed, quizTitle, roundKey } from '@/types/education';

function EducationReportInner() {
  useHydrateEducation();
  // 정적 export 라 동적 세그먼트 대신 ?id= 로 받는다
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();

  const reports = useEducationContentStore((s) => s.reports);
  const deleteReport = useEducationContentStore((s) => s.deleteReport);
  const setStatus = useEducationContentStore((s) => s.setStatus);
  const closedRounds = useEducationContentStore((s) => s.closedRounds);
  const markRead = useEducationStore((s) => s.markRead);
  const progressByRound = useEducationStore((s) => s.progressByRound);
  const toast = useToastStore((s) => s.add);

  // 관리자(SPC)만 작성·발행·삭제. 전기사용자·발전사업자는 열람·시험
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['admin', 'spc'].includes(getPersona(user));

  const [confirmDelete, setConfirmDelete] = useState(false);

  const report = reports.find((r) => r.id === id);

  useEffect(() => {
    if (report) markRead(report.id);
  }, [report, markRead]);

  if (!report) {
    return (
      <EmptyState
        icon={<FileQuestion size={48} />}
        title="교육 자료를 찾을 수 없습니다"
        action={
          <Button variant="secondary" onClick={() => router.push('/re100/education')}>
            목록으로 돌아가기
          </Button>
        }
      />
    );
  }

  // 기본 자료는 'basic' 그룹, 그 외는 차수 그룹
  const key = roundKey(report);
  const open = isQuizOpen(key, closedRounds);
  const quiz = getRoundQuiz(reports, key);
  const quizIds = new Set(quiz.map((q) => q.id));
  const solvedCount = (progressByRound[key]?.correctQuestionIds ?? []).filter((qid) => quizIds.has(qid)).length;
  const completed = quiz.length > 0 && solvedCount >= quiz.length;

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: 'RE100', path: '/re100' },
            { label: 'RE100 교육', path: '/re100/education' },
            { label: '교육 자료', path: '/re100/education' },
            { label: report.title },
          ]}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <BackButton href="/re100/education" label="교육 목록으로" />
          <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">{report.title}</h1>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            {report.basic ? (
              <span className="flex items-center gap-1">
                <CalendarDays size={12} /> 기본 정보
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CalendarDays size={12} /> {report.publishedAt}
              </span>
            )}
            {!isPublished(report) && <Badge variant="warning">초안</Badge>}
            {completed && <Badge variant="success">{formatRound(key)} 이수 완료</Badge>}
          </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isAdmin && (
            <>
              {isPublished(report) ? (
                <Button
                  variant="cancel"
                  size="sm"
                  onClick={() => {
                    setStatus(report.id, 'draft');
                    toast('info', '발행이 취소되었습니다. 사용자에게 더 이상 보이지 않습니다.');
                  }}
                >
                  발행 취소
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={isRoundClosed(key, closedRounds)}
                  onClick={() => {
                    setStatus(report.id, 'published');
                    toast('success', `자료가 발행되었습니다. 문항이 ${quizTitle(key)}에 포함됩니다.`);
                  }}
                >
                  발행하기
                </Button>
              )}
              <Button size="sm" onClick={() => router.push(`/re100/education/editor?id=${report.id}`)}>
                <Pencil size={14} className="mr-1" /> 수정
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} className="mr-1" /> 삭제
              </Button>
            </>
          )}
        </div>
      </div>

      {!isPublished(report) && (
        <div className="rounded-xl bg-[#1a2332] px-5 py-4 ring-1 ring-amber-500/40 text-sm text-amber-300/90">
          이 자료는 <b>초안</b> 상태입니다 — 발행 전까지 사용자에게 보이지 않고, 문항도 쪽지시험에 출제되지 않습니다.
          내용을 검토한 뒤 발행해 주세요.
        </div>
      )}

      <article className="rounded-xl bg-[#1a2332] p-6 md:p-8 ring-1 ring-white/[0.06]">
        <div className="space-y-8">
          {report.sections.map((section, si) => (
            <section key={si}>
              {section.heading && <h2 className="text-base font-semibold text-white">{section.heading}</h2>}
              <div className={section.heading ? 'mt-3 space-y-3' : 'space-y-3'}>
                {section.body.map((paragraph, i) => (
                  <p key={i} className="text-sm text-slate-300 leading-7">
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.images && section.images.length > 0 && (
                <div className="mt-4 space-y-4">
                  {section.images.map((img, ii) => (
                    <figure key={ii}>
                      <div className="rounded-lg bg-white p-4 ring-1 ring-white/[0.06]">
                        <img src={img.url} alt={img.caption ?? ''} className="mx-auto max-w-full" />
                      </div>
                      {img.caption && (
                        // 사진 아래 왼쪽 정렬 캡션 — 접두어는 관리자가 직접 입력
                        <figcaption className="mt-1.5 text-xs text-slate-500">{img.caption}</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* 출처 */}
        {report.sources && report.sources.length > 0 && (
          <div className="mt-8 border-t border-white/[0.06] pt-5">
            <h3 className="text-xs font-semibold text-slate-400">출처</h3>
            <ul className="mt-2 space-y-1.5">
              {report.sources.map((source, i) => (
                <li key={i} className="text-xs text-slate-500">
                  {source.url ? (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400/80 hover:text-sky-300 transition-colors"
                    >
                      {source.label}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    source.label
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 별첨 — url 있으면 열람/다운로드 링크, 없으면 파일명만(원문에서 받기) */}
        {report.attachments && report.attachments.length > 0 && (
          <div className="mt-5 border-t border-white/[0.06] pt-5">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
              <Paperclip size={12} /> 별첨
            </h3>
            <ul className="mt-2 space-y-1.5">
              {report.attachments.map((att, i) => (
                <li key={i} className="text-xs text-slate-500">
                  {att.url ? (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sky-400/80 hover:text-sky-300 transition-colors"
                    >
                      {att.name}
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    `· ${att.name}`
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI 요약 고지 */}
        <div className="mt-6 flex items-start gap-2 rounded-lg bg-white/[0.03] px-4 py-3">
          <Bot size={14} className="mt-0.5 shrink-0 text-slate-500" />
          <p className="text-xs text-slate-500 leading-5">
            본 자료는 원문을 AI가 요약·정리한 교육용 콘텐츠입니다. 정확한 사실 확인이 필요한 경우 출처의 원문을 참고해
            주세요.
          </p>
        </div>
      </article>

      {quiz.length > 0 && (
        <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">{quizTitle(key)}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {open ? (
                <span className="tabular-nums">
                  {solvedCount}/{quiz.length} 문항
                </span>
              ) : (
                <>{formatRound(key)} 마감 후 오픈</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {open ? (
              <>
                <Link href={`/re100/education/quiz?round=${key}`}>
                  <Button>
                    <PenLine size={15} className="mr-1.5" />
                    {completed ? '시험 다시 보기' : '쪽지시험 풀기'}
                  </Button>
                </Link>
              </>
            ) : (
              <span className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-4 py-2 ring-1 ring-white/[0.06] text-sm text-slate-500">
                <Lock size={14} /> 차수 마감 후 응시 가능
              </span>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          deleteReport(report.id);
          toast('success', '교육 자료가 삭제되었습니다.');
          router.push('/re100/education');
        }}
        title="교육 자료 삭제"
        message={`「${report.title}」 자료를 삭제할까요? 해당 자료의 쪽지시험 문항도 함께 제외됩니다.`}
        confirmLabel="삭제"
        variant="danger"
      />
    </div>
  );
}

export default function EducationReportPage() {
  return (
    <Suspense fallback={null}>
      <EducationReportInner />
    </Suspense>
  );
}
