'use client';

// 검증 지원 (MRV의 V) — 설계 docs/기획/01 rev.2 §3·§6 + 07 §9.2.1 + 설계 11 §3.2.
// SUBMITTED 명세서 → 검증요청(PENDING) → 반려(SUPPLEMENT)/의견서 발급(ISSUED)+검증완료(VERIFIED).
// 검증기관 워크플로: useVerifications/useRequestVerification/useDecideVerification.

import { useState } from 'react';
import { CheckCircle2, XCircle, Link2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useGhgStatements,
  useVerifyStatement,
  useGhgSources,
  useGhgActivities,
  useGhgCalculation,
} from '@/hooks/edm/useGhg';
import { useGhgFactors } from '@/hooks/edm/useGhgExt';
import {
  useVerifications,
  useRequestVerification,
  useDecideVerification,
  type VerificationRes,
} from '@/hooks/edm/useGhgExt';

const YEAR = 2026;
const AGENCIES = ['한국품질재단(KFQ)', 'DNV', '로이드인증원(LRQA)'];
const ISO_STD = 'ISO 14064-3';
// 불확도 폴백(계산 불가 시). 실계산은 Tier 가중(IPCC 관례) — computeUncertainty 참조.
const UNCERTAINTY_FALLBACK = 2.4;

// IPCC 관례 Tier별 불확도(%): Tier1 높음·Tier3 낮음. 배출량 가중 평균으로 종합 불확도 산출.
const TIER_UNCERTAINTY: Record<number, number> = { 1: 7.5, 2: 4, 3: 1.5 };

function numericId(id: string): number | null {
  const m = id.match(/\d+/g);
  if (!m) return null;
  const n = Number(m[m.length - 1]);
  return Number.isFinite(n) ? n : null;
}

const decisionLabel = (d: VerificationRes['decision']): string =>
  d === 'ISSUED' ? '의견서 발급' : d === 'SUPPLEMENT' ? '보완요청(반려)' : '심사중';
const decisionBadge = (d: VerificationRes['decision']) =>
  d === 'ISSUED' ? 'success' : d === 'SUPPLEMENT' ? 'warning' : 'info';

export default function VerifyPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: statements, isLive, isError } = useGhgStatements(companyId);
  const cur = statements.find((s) => s.year === YEAR);
  const status = cur?.status; // DRAFT | SUBMITTED | VERIFIED
  const statementId = cur ? numericId(cur.id) : null;

  const verify = useVerifyStatement();
  const request = useRequestVerification();
  const decide = useDecideVerification();
  const { data: verifications } = useVerifications(statementId ?? undefined);

  // QA/QC 실계산 데이터 소스 (실데이터 훅) — mock QC_CHECKS 제거.
  const { data: sources } = useGhgSources(companyId);
  const { data: activities } = useGhgActivities(companyId, YEAR);
  const { data: factors } = useGhgFactors();
  const calc = useGhgCalculation(companyId, YEAR);

  // ── QA/QC 체크리스트 실계산 (설계: mock 고정 → 실데이터) ──
  const evidenceCount = activities.filter((a) => a.evidence && a.evidence.trim() !== '').length;
  // 계수 최신성: 사용 계수(factors) 중 validFrom 연도 >= 2021 여부. 계수 미로딩 시 판정 불가 → false.
  const factorsFresh =
    factors.length > 0 &&
    factors.every((f) => {
      const y = Number((f.validFrom ?? '').slice(0, 4));
      return Number.isFinite(y) && y >= 2021;
    });
  const scopeConsistent = calc.total > 0 && Math.abs(calc.scope1 + calc.scope2 - calc.total) <= 1;
  const unitsValid = activities.length > 0 && activities.every((a) => a.unit && a.unit.trim() !== '');

  const qcChecks: { key: string; label: string; passed: boolean }[] = [
    { key: 'no_missing_source', label: `누락 배출원 없음 (${sources.length}건)`, passed: sources.length > 0 },
    { key: 'unit_valid', label: `활동자료 존재·단위 정합 (${activities.length}건)`, passed: unitsValid },
    { key: 'factor_version', label: '배출계수 최신 (validFrom ≥ 2021)', passed: factorsFresh },
    { key: 'scope_consistent', label: 'Scope 정합 (Scope1+Scope2 = 총량)', passed: scopeConsistent },
    {
      key: 'evidence',
      label: `증빙 첨부 (${evidenceCount}/${activities.length})`,
      passed: activities.length > 0 && evidenceCount === activities.length,
    },
  ];

  // ── 종합 불확도 실계산: 배출원 Tier 가중(배출량 가중) 평균. IPCC 관례 Tier1>Tier2>Tier3. ──
  // 배출원 tier ↔ 산정행(calc.rows) 배출량 매핑. tier 미상이면 Tier2(중간) 가정.
  const uncertainty = (() => {
    const tierBySource = new Map(sources.map((s) => [s.id, s.tier]));
    let weighted = 0;
    let weight = 0;
    for (const r of calc.rows) {
      const tier = tierBySource.get(r.sourceId) ?? 2;
      const u = TIER_UNCERTAINTY[tier] ?? TIER_UNCERTAINTY[2]!;
      weighted += u * r.tCO2eq;
      weight += r.tCO2eq;
    }
    return weight > 0 ? weighted / weight : UNCERTAINTY_FALLBACK;
  })();

  const [agency, setAgency] = useState(AGENCIES[0]);
  const [confirmVerify, setConfirmVerify] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const passed = qcChecks.filter((c) => c.passed).length;
  const allPassed = passed === qcChecks.length;

  const latest = verifications[0];
  const requested = verifications.length > 0;

  // 검증 완료(의견서 발급 + VERIFIED) 조건: 회사귀속·정상조회 → SUBMITTED · 체크리스트 통과(설계 22).
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 검증할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : status !== 'SUBMITTED'
          ? status === 'VERIFIED'
            ? '이미 검증 완료됨'
            : '제출(SUBMITTED)된 명세서만 검증할 수 있습니다'
          : !allPassed
            ? '미통과 체크 항목이 있어 승인할 수 없습니다'
            : '';
  const canVerify = !guardReason;
  // 반려/요청은 SUBMITTED면 가능(체크리스트 통과 불필요 — 보완요청 목적).
  const workflowReason =
    companyId == null
      ? '회사 정보가 없어 검증할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : status !== 'SUBMITTED'
          ? '제출(SUBMITTED)된 명세서만 검증할 수 있습니다'
          : '';
  const canWorkflow = !workflowReason && statementId != null;

  async function doRequest() {
    if (!canWorkflow || statementId == null) return;
    setFeedback(null);
    try {
      await request.mutateAsync({
        statementId,
        verifierOrg: agency ?? AGENCIES[0]!,
        isoStd: ISO_STD,
        uncertainty: Number(uncertainty.toFixed(1)),
      });
      setFeedback({ kind: 'ok', msg: '검증요청을 생성했습니다. 검증기관이 명세서를 열람합니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: '검증요청 생성 중 오류가 발생했습니다.' });
    }
  }

  // 반려 = 보완요청(SUPPLEMENT). 명세서는 SUBMITTED 유지.
  async function doReject() {
    if (!canWorkflow || rejectNote.trim() === '') return;
    const target = latest;
    if (!target) {
      setRejectOpen(false);
      setFeedback({ kind: 'err', msg: '검증요청이 없어 반려할 수 없습니다. 먼저 검증요청을 생성하세요.' });
      return;
    }
    setFeedback(null);
    try {
      await decide.mutateAsync({ id: target.id, decision: 'SUPPLEMENT', note: rejectNote.trim() });
      setRejectOpen(false);
      setRejectNote('');
      setFeedback({ kind: 'ok', msg: '보완요청(반려)을 등록했습니다. 담당자에게 재작업이 요청됩니다.' });
    } catch {
      setRejectOpen(false);
      setFeedback({ kind: 'err', msg: '반려 처리 중 오류가 발생했습니다.' });
    }
  }

  // 검증 완료 = 검증기관 결정(ISSUED) 선행 → 명세서 VERIFIED (2단계 트랜잭션).
  async function doVerify() {
    if (!cur || statementId == null) {
      setConfirmVerify(false);
      setFeedback({ kind: 'err', msg: '명세서 식별자를 확인할 수 없습니다.' });
      return;
    }
    setFeedback(null);
    try {
      if (latest && latest.decision !== 'ISSUED') {
        await decide.mutateAsync({ id: latest.id, decision: 'ISSUED', note: `${agency} 의견서 발급` });
      }
      await verify.mutateAsync(statementId);
      setConfirmVerify(false);
      setFeedback({ kind: 'ok', msg: '검증을 완료했습니다. 공시(disclosure) 단계로 진행할 수 있습니다.' });
    } catch {
      setConfirmVerify(false);
      setFeedback({ kind: 'err', msg: '검증 처리 중 오류가 발생했습니다.' });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '검증' }]} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">검증 지원 (MRV)</h1>
          <Badge variant={isLive ? 'success' : isError ? 'warning' : 'default'}>
            {isLive ? '실시간' : isError ? '불러오기 실패' : '—'}
          </Badge>
        </div>
        <span className="text-xs text-slate-400">제3자 검증기관 대응</span>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-white">검증 표준 · 지정기관</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="info">ISO 14064-3</Badge>
              <Badge variant="default">ISO/IEC 17029</Badge>
              <Badge variant="default">ISO 14065</Badge>
              {status && (
                <Badge variant={status === 'VERIFIED' ? 'success' : status === 'SUBMITTED' ? 'info' : 'default'}>
                  명세서 {status === 'VERIFIED' ? '검증완료' : status === 'SUBMITTED' ? '검증대기' : '작성중'}
                </Badge>
              )}
              {latest && <Badge variant={decisionBadge(latest.decision)}>검증 {decisionLabel(latest.decision)}</Badge>}
            </div>
          </div>
          <div className="flex items-end gap-5">
            <div>
              <label className="mb-1 block text-xs text-slate-500">지정 검증기관 (국립환경과학원 지정)</label>
              <select
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200"
              >
                {AGENCIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">종합 불확도</p>
              <p className="text-lg font-bold text-white tabular-nums">
                ±{(latest?.uncertainty ?? uncertainty).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            데이터 품질(QA/QC) 체크{' '}
            <span className="text-xs text-slate-500">
              ({passed}/{qcChecks.length})
            </span>
          </h3>
          <div className="space-y-2.5">
            {qcChecks.map((c) => (
              <div key={c.key} className="flex items-center gap-2.5 text-sm">
                {c.passed ? (
                  <CheckCircle2 size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-amber-400" />
                )}
                <span className={c.passed ? 'text-slate-300' : 'text-amber-300'}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* 검증 결정 배선 (설계 11 §3.2): 검증 완료(ISSUED+VERIFIED) / 반려(SUPPLEMENT) */}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmVerify(true)}
              disabled={!canVerify}
              loading={verify.isPending || decide.isPending}
            >
              <ShieldCheck size={15} /> 검증 완료
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRejectOpen(true)}
              disabled={!canWorkflow}
              title={canWorkflow ? '보완요청(SUPPLEMENT)으로 반려' : workflowReason}
            >
              반려
            </Button>
          </div>
          {guardReason && <p className="mt-3 text-xs text-amber-400">검증 불가: {guardReason}</p>}
          {feedback && (
            <p className={`mt-3 text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.msg}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-1.5">
            <ShieldCheck size={15} /> 검증기관 공유
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            검증요청을 생성하면 제3자 검증기관이 산정 근거·명세서를 열람합니다. 모든 접근은 검증 이력에 기록됩니다.
          </p>
          <Button
            variant={requested ? 'secondary' : 'primary'}
            size="sm"
            onClick={doRequest}
            disabled={!canWorkflow}
            loading={request.isPending}
            title={canWorkflow ? undefined : workflowReason}
          >
            <Link2 size={15} /> {requested ? '검증요청 생성됨' : '검증요청 생성'}
          </Button>
          {requested && latest && (
            <p className="mt-2 text-xs text-sky-400">
              {latest.verifierOrg} · {latest.isoStd} · {decisionLabel(latest.decision)}
            </p>
          )}
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-slate-400 mb-2">검증 이력</h4>
            <div className="space-y-2">
              {verifications.length === 0 && <p className="text-xs text-slate-500">아직 검증 이력이 없습니다.</p>}
              {verifications.map((v) => (
                <div key={v.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">{v.verifierOrg}</span>
                    <Badge variant={decisionBadge(v.decision)}>{decisionLabel(v.decision)}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {v.isoStd}
                    {v.sharedAt ? ` · ${v.sharedAt}` : ''}
                    {v.note ? ` — ${v.note}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmVerify}
        onClose={() => setConfirmVerify(false)}
        onConfirm={doVerify}
        title="명세서 검증 완료"
        message={`ISO 14064-3 체크리스트(${passed}/${qcChecks.length} 통과) 확인 후 승인합니다. ${agency} 의견서 발급(ISSUED) 후 명세서가 VERIFIED 처리됩니다.`}
        confirmLabel="검증 완료"
        loading={verify.isPending || decide.isPending}
      />

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="명세서 반려 (보완요청)"
        footer={
          <>
            <Button variant="cancel" size="sm" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={doReject}
              disabled={rejectNote.trim() === ''}
              loading={decide.isPending}
            >
              반려
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-slate-400">
          반려 시 명세서는 제출(SUBMITTED) 상태를 유지하며, 보완사유가 담당자에게 전달됩니다.
        </p>
        <label className="block text-xs text-slate-400">
          보완사유
          <textarea
            className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="예: 활동자료 3건 증빙 미비"
          />
        </label>
        {rejectNote.trim() === '' && <span className="mt-1 block text-xs text-red-400">보완사유를 입력하세요</span>}
      </Modal>
    </div>
  );
}
