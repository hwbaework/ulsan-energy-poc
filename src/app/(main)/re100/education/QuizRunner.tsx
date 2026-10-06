'use client';

import { BackButton } from '@/components/layout/PageTitle';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, Download, FileQuestion, RotateCcw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { getRoundQuiz } from '@/lib/mock-education';
import { useEducationStore, useHydrateEducation } from '@/stores/useEducationStore';
import { exportCertificatePdf } from '@/lib/utils';
import { useEducationContentStore } from '@/stores/useEducationContentStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import type { EduQuizQuestion } from '@/types/education';
import { BASIC_GROUP, formatRound, isQuizOpen, quizTitle } from '@/types/education';

/** 쪽지시험 — 한 문제씩, 틀린 문항은 다시, 전 문항을 맞히면 이수 완료 · 수료증 자동 발급. embedded 면 교육 자료 화면 안에 들어간다 */
export function QuizRunner({ round, embedded = false }: { round: string; embedded?: boolean }) {
  useHydrateEducation();
  const router = useRouter();
  const reports = useEducationContentStore((s) => s.reports);
  const closedRounds = useEducationContentStore((s) => s.closedRounds);
  const questions = useMemo(() => (round ? getRoundQuiz(reports, round) : []), [reports, round]);

  const user = useAuthStore((s) => s.user);
  const progressByRound = useEducationStore((s) => s.progressByRound);
  const certificates = useEducationStore((s) => s.certificates);
  const gradeRound = useEducationStore((s) => s.gradeRound);
  const toast = useToastStore((s) => s.add);

  // 한 문제씩 진행 — 선택한 보기 + 방금 채점한 문항의 결과
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<{ q: EduQuizQuestion; correct: boolean } | null>(null);

  const validRound = round === BASIC_GROUP || /^\d+$/.test(round ?? '');
  if (!validRound || questions.length === 0) {
    return (
      <EmptyState
        icon={<FileQuestion size={48} />}
        title="해당 차수의 쪽지시험이 없습니다"
        description="문항이 있는 교육 자료가 발행된 차수에만 쪽지시험이 출제됩니다."
        action={
          <Button variant="secondary" onClick={() => router.push('/re100/education')}>
            교육 자료 목록으로
          </Button>
        }
      />
    );
  }

  // 마감 전 차수는 응시 불가 — 자료 열람만 가능, 관리자가 차수를 마감하면 오픈
  if (!isQuizOpen(round, closedRounds)) {
    return (
      <EmptyState
        icon={<FileQuestion size={48} />}
        title="아직 응시할 수 없습니다"
        description={`${quizTitle(round)}은 ${formatRound(round)} 마감 후 오픈됩니다. 그때까지 교육 자료를 학습해 주세요.`}
        action={
          <Button variant="secondary" onClick={() => router.push('/re100/education')}>
            교육 자료 목록으로
          </Button>
        }
      />
    );
  }

  const progress = progressByRound[round];
  const solvedIds = new Set(progress?.correctQuestionIds ?? []);
  const remaining = questions.filter((q) => !solvedIds.has(q.id));
  const completed = remaining.length === 0;
  const certificate = certificates.find((c) => c.round === round);
  const currentQ = remaining[0];

  const handleCheck = () => {
    if (selected == null || !currentQ) return;
    const correct = selected === currentQ.answerIndex;
    if (correct) {
      // 맞으면 이 문항을 정복 처리(누적) — 남은 목록에서 빠진다
      gradeRound({
        round,
        correctQuestionIds: [currentQ.id],
        allQuestionIds: questions.map((q) => q.id),
        userName: user?.name ?? '수강자',
        companyName: user?.companyName,
      });
    }
    setRevealed({ q: currentQ, correct });
  };

  // 맞은 문항: 다음 문제로 / 틀린 문항: 같은 문제 다시 (정답 미공개)
  const handleNext = () => {
    const wasLast = revealed?.correct && remaining.length === 1;
    setRevealed(null);
    setSelected(null);
    if (wasLast) toast('success', '이수 완료 · 수료증 발급');
  };

  const solvedCount = solvedIds.size;

  return (
    <div className="space-y-6">
      {!embedded && (
        <>
      <div className="mb-4">
        <Breadcrumb
          items={[
            { label: 'RE100', path: '/re100' },
            { label: 'RE100 교육', path: '/re100/education' },
            { label: '교육 자료', path: '/re100/education' },
            { label: quizTitle(round) },
          ]}
        />
      </div>

      <div className="flex items-center gap-2">
        <BackButton href="/re100/education" label="교육 자료로" />
        <h1 className="text-2xl font-bold text-white">{quizTitle(round)}</h1>
      </div>

        </>
      )}

      {/* 진행 — 맞힌 문항 / 전체 · 남은 문항. 잘 보이게 글자를 키우고 밝게 */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-base font-semibold text-white tabular-nums">
            맞힌 문항 <span className="text-emerald-400">{solvedCount}</span> / {questions.length}
          </p>
          {!completed && <p className="text-sm font-medium text-slate-200 tabular-nums">남은 {remaining.length}문항</p>}
        </div>
        <ProgressBar value={solvedCount} max={questions.length} variant="success" />
      </div>

      {/* 이수 완료 */}
      {completed ? (
        <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-emerald-500/40">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={32} className="text-emerald-400 shrink-0" />
              <div>
                <div className="text-lg font-bold text-white">이수 완료</div>
                <div className="text-sm text-slate-400 tabular-nums">
                  {[`${questions.length}문항`, `채점 ${progress?.attemptCount ?? 0}회`, certificate && `수료증 ${certificate.certificateNo} · ${certificate.issuedAt}`].filter(Boolean).join(' · ')}
                </div>
              </div>
            </div>
            {certificate && (
              <Button onClick={() => exportCertificatePdf(certificate)}>
                <Download size={15} className="mr-1.5" /> 수료증 다운로드
              </Button>
            )}
          </div>
        </div>
      ) : revealed ? (
        // 채점 결과 화면 — 맞으면 해설 공개, 틀리면 다시 풀기
        <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] space-y-5">
          <div className="flex items-center gap-2">
            {revealed.correct ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">정답입니다</span>
              </>
            ) : (
              <>
                <XCircle size={18} className="text-red-400" />
                <span className="text-sm font-semibold text-red-400">틀렸습니다 — 다시 풀어보세요</span>
              </>
            )}
          </div>
          <p className="text-base font-semibold text-white leading-7">{revealed.q.question}</p>
          <div className="space-y-2">
            {revealed.q.options.map((option, oi) => {
              const isAnswer = oi === revealed.q.answerIndex;
              const isPicked = oi === selected;
              return (
                <div
                  key={oi}
                  className={cn(
                    'w-full rounded-lg px-4 py-3 text-sm ring-1',
                    // 정답 문항: 정답 강조. 오답 문항: 정답 숨기고 내가 고른 것만 빨강
                    revealed.correct && isAnswer && 'bg-emerald-500/15 ring-emerald-500/50 text-white',
                    revealed.correct && !isAnswer && 'bg-white/[0.02] ring-white/[0.05] text-slate-500',
                    !revealed.correct && isPicked && 'bg-red-500/10 ring-red-500/40 text-slate-300',
                    !revealed.correct && !isPicked && 'bg-white/[0.02] ring-white/[0.06] text-slate-500',
                  )}
                >
                  <span className="mr-2 font-semibold text-slate-300">{oi + 1})</span>
                  {option}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            {revealed.correct ? (
              <Button size="lg" onClick={handleNext}>
                {remaining.length === 1 ? '완료' : '다음 문제'}
                <ArrowRight size={15} className="ml-1.5" />
              </Button>
            ) : (
              <Button size="lg" onClick={handleNext}>
                <RotateCcw size={15} className="mr-1.5" /> 다시 풀기
              </Button>
            )}
          </div>
        </div>
      ) : (
        // 현재 문제 — 한 문제씩
        currentQ && (
          <div className="rounded-xl bg-[#1a2332] p-6 ring-1 ring-white/[0.06] space-y-5">
            <h2 className="text-base font-semibold text-white leading-7">{currentQ.question}</h2>
            <div className="space-y-2">
              {currentQ.options.map((option, oi) => {
                const isSelected = selected === oi;
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => setSelected(oi)}
                    className={cn(
                      'w-full text-left rounded-lg px-4 py-3 text-sm ring-1 transition-colors',
                      isSelected
                        ? 'bg-emerald-500/15 ring-emerald-500/50 text-white'
                        : 'bg-white/[0.03] ring-white/[0.08] text-slate-300 hover:bg-white/[0.06]',
                    )}
                  >
                    <span className="mr-2 font-semibold text-slate-300">{oi + 1})</span>
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end">
              <Button size="lg" onClick={handleCheck} disabled={selected == null}>
                확인
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}

