'use client';

// 온실가스 인벤토리 10스텝 스텝퍼 셸 — 07 §9.2.3 SPEC-P0-MRV-3.
// 라우트·탭 구조 변경 없음(기존 10개 하위 라우트를 스텝으로 표상).
// 조회 훅 재사용으로 완료 상태 판정(신규 API 불필요), 의존 잠금(3←2, 8←3, 9←8, 10←9).
// AI 보조 코파일럿은 전 화면 우하단 유지.

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Check, Lock, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgSources, useGhgActivities, useGhgCalculation, useGhgStatements } from '@/hooks/edm/useGhg';
import { useGhgFactors, useGhgTarget, useGhgScope3, useGhgCbam } from '@/hooks/edm/useGhgExt';
import { GhgCopilot } from '@/components/edm/ghg/GhgCopilot';

const BASE = '/e-data/inventory';

interface StepDef {
  no: number;
  label: string;
  slug: string; // '' = index
}

// 순서 = 좌측 LNB(doc 04 GNB)와 일치: 계수→산정, CBAM은 부가/수출 트랙으로 맨 끝.
const STEPS: StepDef[] = [
  { no: 1, label: '배출원', slug: 'sources' },
  { no: 2, label: '활동', slug: 'activity' },
  { no: 3, label: '계수', slug: 'factors' },
  { no: 4, label: '산정', slug: 'calculation' },
  { no: 5, label: 'Scope3', slug: 'scope3' },
  { no: 6, label: '목표', slug: 'target' },
  { no: 7, label: '명세서', slug: 'statement' },
  { no: 8, label: '검증', slug: 'verify' },
  { no: 9, label: '공시', slug: 'disclosure' },
  { no: 10, label: 'CBAM', slug: 'cbam' },
];

const YEAR = 2026;

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);

  // 스텝 상태 판정 소스 (조회 훅 재사용 — 07 §9.2.3)
  const { data: sources } = useGhgSources(companyId);
  const { data: activities } = useGhgActivities(companyId, YEAR);
  const calc = useGhgCalculation(companyId, YEAR);
  const { data: factors } = useGhgFactors();
  const { data: target } = useGhgTarget(companyId);
  const { data: statements } = useGhgStatements(companyId);
  const { data: scope3, isLive: scope3Live } = useGhgScope3(companyId, YEAR);
  const { data: cbam, isLive: cbamLive } = useGhgCbam(companyId);

  const statement2026 = statements.find((s) => s.year === YEAR);
  const stmtStatus = statement2026?.status; // DRAFT | SUBMITTED | VERIFIED

  // 완료 판정 (LNB 순서 리매핑 — 배출원1·활동2·계수3·산정4·Scope3 5·목표6·명세서7·검증8·공시9·CBAM10)
  const done: Record<number, boolean> = {
    1: sources.length > 0,
    2: activities.length > 0,
    3: factors.length > 0, // 계수
    4: calc.total > 0, // 산정
    // 설계 11 §3.3: 실데이터(isLive) 동반 확인 — 데모 폴백을 완료로 오판하지 않도록.
    5: scope3Live && scope3.some((c) => c.material === true), // 중대 카테고리 1개 이상 착수
    6: !!target, // 목표
    7: !!stmtStatus, // 명세서 status ≥ DRAFT
    8: stmtStatus === 'VERIFIED', // 검증
    9: !!statement2026?.submittedAt && stmtStatus === 'VERIFIED', // 공시 export 선행 = 검증 완료
    10: cbamLive && cbam.length > 0, // CBAM 제품 1개 이상 등록(부가 트랙)
  };

  // 의존 잠금 (의미 보존): 산정(4)←활동(2), 명세서(7)←산정(4), 검증(8)←명세서 SUBMITTED, 공시(9)←검증 VERIFIED
  const locked: Record<number, boolean> = {
    1: false,
    2: false,
    3: false,
    5: false,
    6: false,
    10: false,
    4: !done[2], // 산정 ← 활동
    7: !done[4], // 명세서 ← 산정
    8: stmtStatus !== 'SUBMITTED' && stmtStatus !== 'VERIFIED', // 검증 ← 명세서 SUBMITTED
    9: stmtStatus !== 'VERIFIED', // 공시 ← 검증 VERIFIED
  };

  // 현재 스텝 판정 (pathname의 마지막 세그먼트 → slug 매칭, 인덱스는 배출원 전 개요로 취급)
  const seg = pathname.replace(`${BASE}`, '').replace(/^\//, '').split('/')[0] ?? '';
  const current = STEPS.find((s) => s.slug === seg);
  const currentNo = current?.no ?? 0; // 0 = 인벤토리 인덱스(개요)

  const completedCount = Object.values(done).filter(Boolean).length;

  const prevStep = currentNo > 1 ? STEPS[currentNo - 2] : undefined;
  const nextStep = currentNo >= 1 && currentNo < 10 ? STEPS[currentNo] : currentNo === 0 ? STEPS[0] : undefined;
  const nextLocked = nextStep ? locked[nextStep.no] : false;

  function go(step: StepDef) {
    if (locked[step.no]) return;
    router.push(`${BASE}/${step.slug}`);
  }

  return (
    <div className="space-y-5">
      {/* 스텝 레일 */}
      <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-4">
        <div className="mb-3 flex items-center justify-between">
          <Link
            href={BASE}
            className={cn(
              'text-sm font-semibold transition-colors',
              currentNo === 0 ? 'text-white' : 'text-slate-400 hover:text-white',
            )}
          >
            MRV 전주기
          </Link>
          <span className="text-xs text-slate-400">
            <span className="text-sky-300 font-medium">{completedCount}</span> of 10 완료
          </span>
        </div>

        {/* 진행률 바 */}
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-500 transition-all"
            style={{ width: `${completedCount * 10}%` }}
          />
        </div>

        {/* 노드 */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STEPS.map((step, i) => {
            const isDone = done[step.no];
            const isLocked = locked[step.no];
            const isCurrent = step.no === currentNo;
            return (
              <div key={step.no} className="flex items-center">
                <button
                  type="button"
                  onClick={() => go(step)}
                  disabled={isLocked}
                  title={isLocked ? '선행 단계 필요' : step.label}
                  className={cn(
                    'group flex flex-col items-center gap-1 rounded-lg px-2.5 py-1.5 min-w-[64px] transition-colors',
                    isLocked ? 'cursor-not-allowed opacity-45' : 'hover:bg-white/[0.04]',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ring-1 transition-colors',
                      isCurrent
                        ? 'bg-sky-500 text-white ring-sky-400'
                        : isDone
                          ? 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30'
                          : 'bg-white/[0.04] text-slate-400 ring-white/[0.08]',
                    )}
                  >
                    {isLocked ? <Lock size={12} /> : isDone && !isCurrent ? <Check size={13} /> : step.no}
                  </span>
                  <span className={cn('whitespace-nowrap text-[11px]', isCurrent ? 'text-white' : 'text-slate-400')}>
                    {step.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && <div className="h-px w-3 shrink-0 bg-white/[0.08]" />}
              </div>
            );
          })}
        </div>
      </div>

      {children}

      {/* prev / next + 다음 단계 유도 */}
      <div className="flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div>
          {prevStep && (
            <button
              type="button"
              onClick={() => go(prevStep)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:text-white hover:bg-white/[0.04]"
            >
              <ChevronLeft size={15} /> 이전: {prevStep.label}
            </button>
          )}
        </div>
        <div>
          {nextStep && (
            <button
              type="button"
              onClick={() => go(nextStep)}
              disabled={nextLocked}
              title={nextLocked ? '선행 단계 필요' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                nextLocked
                  ? 'cursor-not-allowed bg-white/[0.03] text-slate-500'
                  : 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/25 hover:bg-sky-500/25',
              )}
            >
              {nextLocked ? <Lock size={14} /> : <ArrowRight size={15} />} 다음: {nextStep.label}
              {!nextLocked && <ChevronRight size={15} />}
            </button>
          )}
        </div>
      </div>

      <GhgCopilot />
    </div>
  );
}
