'use client';

// 배출량 명세서 — 설계 docs/기획/02 §2.5 + 07 §9.2.1 SPEC-P0-MRV-1(상태전이 배선).
// (명세서 없음)→명세서 생성 / DRAFT→제출. 확인 다이얼로그·isLive 가드·권한(MRV 담당자).

import { useState } from 'react';
import { Download, FileText, Building2, FilePlus2, Send, Loader2 } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useGhgStatements,
  useGenerateStatement,
  useSubmitStatement,
  useGhgCalculation,
  useGhgSources,
} from '@/hooks/edm/useGhg';
import {
  exportStatementPdf,
  exportStatementExcel,
  exportStatementNgmsCsv,
  type StatementDetailRow,
  type StatementExportData,
} from '@/lib/utils/exportMrv';

const YEAR = 2026;

// StatementRow.id는 'ST-2026' 형태(문자) — 실 API PK는 숫자. 숫자 파싱 후 뮤테이션 전달.
function numericId(id: string): number | null {
  const m = id.match(/\d+/g);
  if (!m) return null;
  // 마지막 숫자 그룹(연도가 아닌 실 PK 우선) 사용, 없으면 첫 그룹
  const n = Number(m[m.length - 1]);
  return Number.isFinite(n) ? n : null;
}

export default function StatementPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: statements, isLive, isError } = useGhgStatements(companyId);
  const cur = statements.find((s) => s.year === YEAR);

  const generate = useGenerateStatement();
  const submit = useSubmitStatement();

  // 상세 명세 본문 — 실 산정데이터(useGhgCalculation) 행 + 배출활동(category)은 useGhgSources 매핑.
  const calc = useGhgCalculation(companyId, YEAR);
  const { data: sources } = useGhgSources(companyId);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const detailRows: StatementDetailRow[] = calc.rows.map((r) => {
    const src = sourceById.get(r.sourceId);
    return {
      site: src?.site ?? '—',
      facility: r.facility,
      scope: r.scope,
      category: src?.category ?? (r.scope === 2 ? '구매전력' : '연소'),
      activity: r.activity,
      unit: r.unit,
      factor: r.factor,
      tCO2eq: r.tCO2eq,
    };
  });
  const detailSum = detailRows.reduce((s, r) => s + r.tCO2eq, 0);

  const [confirmGen, setConfirmGen] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  // 가드(설계 22): 회사 미귀속 / 호출 실패를 정확히 구분. 권한 최종 게이트는 서버(MRV 담당자).
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 전이할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  const disabled = !!guardReason;

  const status = cur?.status; // undefined | DRAFT | SUBMITTED | VERIFIED
  const statusLabel =
    status === 'VERIFIED' ? '검증완료' : status === 'SUBMITTED' ? '제출' : status === 'DRAFT' ? '작성중' : '미생성';

  async function doGenerate() {
    setFeedback(null);
    try {
      await generate.mutateAsync({ companyId: companyId as number, year: YEAR });
      setConfirmGen(false);
      setFeedback({ kind: 'ok', msg: `${YEAR}년 명세서를 생성했습니다.` });
    } catch {
      setConfirmGen(false);
      setFeedback({ kind: 'err', msg: '명세서 생성 중 오류가 발생했습니다.' });
    }
  }

  async function doSubmit() {
    if (!cur) return;
    const id = numericId(cur.id);
    if (id == null) {
      setConfirmSubmit(false);
      setFeedback({ kind: 'err', msg: '명세서 식별자를 확인할 수 없습니다.' });
      return;
    }
    setFeedback(null);
    try {
      await submit.mutateAsync(id);
      setConfirmSubmit(false);
      setFeedback({ kind: 'ok', msg: '명세서를 제출했습니다. 검증기관에 이관됩니다.' });
    } catch {
      setConfirmSubmit(false);
      setFeedback({ kind: 'err', msg: '명세서 제출 중 오류가 발생했습니다.' });
    }
  }

  const totals = cur ?? { scope1: 0, scope2: 0, total: 0 };

  // export 가드: 산정 데이터가 있어야(detailRows>0) 내보내기 가능. 회사명은 상수 미상 → companyId 표기.
  const companyLabel = companyId != null ? `회사 #${companyId}` : '회사 미상';
  const exportDisabled = disabled || detailRows.length === 0;
  const exportReason = disabled
    ? guardReason
    : detailRows.length === 0
      ? '산정 데이터가 없어 내보낼 수 없습니다 (활동자료 입력 후 생성)'
      : '';

  function buildExportData(): StatementExportData {
    return {
      company: companyLabel,
      year: YEAR,
      status: statusLabel,
      rows: detailRows,
      scope1: totals.scope1,
      scope2: totals.scope2,
      total: totals.total || detailSum,
    };
  }

  async function doExportPdf() {
    try {
      await exportStatementPdf(`명세서_${companyLabel}_${YEAR}.pdf`, buildExportData());
    } catch {
      setFeedback({ kind: 'err', msg: 'PDF 출력 중 오류가 발생했습니다.' });
    }
  }
  async function doExportExcel() {
    try {
      await exportStatementExcel(`명세서_${companyLabel}_${YEAR}.xlsx`, buildExportData());
    } catch {
      setFeedback({ kind: 'err', msg: 'Excel 출력 중 오류가 발생했습니다.' });
    }
  }
  function doExportNgms() {
    try {
      // NGMS 제출 전 규격 확인 필요 — 공식 스키마 미상, 합리적 표준 컬럼으로 실 산정데이터 export.
      exportStatementNgmsCsv(`NGMS_명세서_${companyLabel}_${YEAR}.csv`, buildExportData());
    } catch {
      setFeedback({ kind: 'err', msg: 'NGMS 데이터 출력 중 오류가 발생했습니다.' });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '배출량 명세서' }]} />
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white">배출량 명세서</h1>
        <Badge variant={isLive ? 'success' : isError ? 'warning' : 'default'}>
          {isLive ? '실시간' : isError ? '불러오기 실패' : '—'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">{YEAR}년 명세서 (목표관리제 양식)</h3>
            <Badge variant={status === 'VERIFIED' ? 'success' : status === 'SUBMITTED' ? 'info' : 'default'}>
              {statusLabel}
            </Badge>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-white/[0.06] py-2">
              <span className="text-slate-400">Scope 1 (직접배출)</span>
              <span className="text-white">{totals.scope1.toLocaleString()} tCO₂eq</span>
            </div>
            <div className="flex justify-between border-b border-white/[0.06] py-2">
              <span className="text-slate-400">Scope 2 (간접배출·전력)</span>
              <span className="text-white">{totals.scope2.toLocaleString()} tCO₂eq</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium text-slate-300">총 배출량</span>
              <span className="text-base font-bold text-sky-300">{totals.total.toLocaleString()} tCO₂eq</span>
            </div>
          </div>

          {/* 배출원별 명세 상세 (실 산정데이터 useGhgCalculation + useGhgSources) */}
          <div className="mt-5">
            <h4 className="mb-2 text-xs font-semibold text-slate-400">배출원별 명세</h4>
            {detailRows.length === 0 ? (
              <p className="rounded-lg bg-white/[0.02] px-3 py-4 text-xs text-slate-500">
                산정 데이터가 없습니다 (활동자료 입력 후 생성)
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left text-slate-500">
                      <th className="px-2.5 py-2">사업장</th>
                      <th className="px-2.5 py-2">시설</th>
                      <th className="px-2.5 py-2">Scope</th>
                      <th className="px-2.5 py-2">배출활동</th>
                      <th className="px-2.5 py-2 text-right">활동량</th>
                      <th className="px-2.5 py-2">단위</th>
                      <th className="px-2.5 py-2 text-right">배출계수</th>
                      <th className="px-2.5 py-2 text-right">배출량(tCO₂eq)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailRows.map((r, i) => (
                      <tr key={`${r.facility}-${i}`} className="border-b border-white/[0.03] text-slate-300">
                        <td className="px-2.5 py-2 text-slate-400">{r.site}</td>
                        <td className="px-2.5 py-2">{r.facility}</td>
                        <td className="px-2.5 py-2">Scope {r.scope}</td>
                        <td className="px-2.5 py-2 text-slate-400">{r.category}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{r.activity.toLocaleString()}</td>
                        <td className="px-2.5 py-2 text-slate-400">{r.unit}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums">{r.factor}</td>
                        <td className="px-2.5 py-2 text-right tabular-nums text-white">
                          {Math.round(r.tCO2eq).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="text-slate-200">
                      <td className="px-2.5 py-2 text-right font-semibold" colSpan={7}>
                        합계
                      </td>
                      <td className="px-2.5 py-2 text-right font-bold tabular-nums text-sky-300">
                        {Math.round(totals.total || detailSum).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 상태전이 버튼 (SPEC-P0-MRV-1) */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {!status && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setConfirmGen(true)}
                disabled={disabled}
                loading={generate.isPending}
              >
                <FilePlus2 size={15} /> 명세서 생성
              </Button>
            )}
            {status === 'DRAFT' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setConfirmSubmit(true)}
                disabled={disabled}
                loading={submit.isPending}
              >
                <Send size={15} /> 제출
              </Button>
            )}
            {status === 'SUBMITTED' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">
                <Loader2 size={13} /> 검증 대기 중 — 검증 화면으로 이관됨
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={doExportPdf}
              disabled={exportDisabled}
              title={exportReason || undefined}
            >
              <Download size={15} /> PDF 출력
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={doExportExcel}
              disabled={exportDisabled}
              title={exportReason || undefined}
            >
              <Download size={15} /> Excel 출력
            </Button>
            {/* NGMS(국가온실가스종합관리시스템) 제출용 — 공식 스키마 미상, NGMS 제출 전 규격 확인 필요. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={doExportNgms}
              disabled={exportDisabled}
              title={exportReason || 'NGMS 제출 전 규격 확인 필요'}
            >
              <Building2 size={15} /> NGMS 보고용 데이터
            </Button>
          </div>

          {guardReason && <p className="mt-3 text-xs text-amber-400">전이 불가: {guardReason}</p>}
          {feedback && (
            <p className={`mt-3 text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
              {feedback.msg}
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-4">연도별 이력</h3>
          {statements.length === 0 ? (
            <p className="text-xs text-slate-500">아직 명세서 이력이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {statements.map((s) => (
                <div key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300 flex items-center gap-1.5">
                      <FileText size={13} />
                      {s.year}년
                    </span>
                    <Badge
                      variant={s.status === 'VERIFIED' ? 'success' : s.status === 'SUBMITTED' ? 'info' : 'default'}
                    >
                      {s.status === 'VERIFIED' ? '검증완료' : s.status === 'SUBMITTED' ? '제출' : '작성중'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {s.total.toLocaleString()} tCO₂eq{s.submittedAt ? ` · ${s.submittedAt}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={confirmGen}
        onClose={() => setConfirmGen(false)}
        onConfirm={doGenerate}
        title="명세서 생성"
        message={`${YEAR}년 명세서를 생성합니다. 산정된 배출량으로 초안(DRAFT)이 작성됩니다.`}
        confirmLabel="생성"
        loading={generate.isPending}
      />
      <ConfirmDialog
        open={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={doSubmit}
        title="명세서 제출"
        message="제출 후 수정할 수 없습니다. 검증기관에 이관됩니다. 계속하시겠습니까?"
        confirmLabel="제출"
        loading={submit.isPending}
      />
    </div>
  );
}
