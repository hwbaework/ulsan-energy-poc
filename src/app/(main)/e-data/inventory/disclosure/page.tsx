'use client';

import { useEffect, useState } from 'react';
import { Download, FileText, Save } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  useGhgDisclosure,
  useGhgTarget,
  useGhgDisclosureNarrative,
  useUpsertDisclosureNarrative,
} from '@/hooks/edm/useGhgExt';
import { exportDisclosurePdf, exportDisclosureCsv, type DisclosureExportData } from '@/lib/utils/exportMrv';

// 공시 export — 설계 docs/기획/01 rev.2 §3·§6 (ISSB S2 / KSSB 제2호 기후공시, 지표·목표 서식)
// 감축목표 실연동(useGhgTarget) + 서술 3축 영속화(useGhgDisclosureNarrative V109) + PDF/CSV 내보내기.

type Frame = 'ISSB' | 'KSSB';
const YEAR = 2026;

// 모듈 레벨 컴포넌트(리렌더 시 remount 방지 — textarea 포커스 유지).
function NarrativeField(props: { label: string; value: string; onChange: (v: string) => void; ready: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-300">{props.label}</label>
        <Badge variant={props.ready ? 'success' : 'warning'}>{props.ready ? '연동됨' : '입력 필요'}</Badge>
      </div>
      <textarea
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
        rows={3}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="공시 서술을 입력하세요"
      />
    </div>
  );
}

export default function DisclosurePage() {
  const [frame, setFrame] = useState<Frame>('ISSB');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: d } = useGhgDisclosure(companyId, YEAR, frame);
  const { data: target } = useGhgTarget(companyId);
  const { data: narrative } = useGhgDisclosureNarrative(companyId, YEAR, frame);
  const upsert = useUpsertDisclosureNarrative();

  // 편집 가능 서술 로컬 상태 — 조회값으로 동기화(프레임 전환 포함).
  const [governance, setGovernance] = useState('');
  const [strategy, setStrategy] = useState('');
  const [riskMgmt, setRiskMgmt] = useState('');
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    setGovernance(narrative.governance);
    setStrategy(narrative.strategy);
    setRiskMgmt(narrative.riskMgmt);
    // frame·narrative 변경 시 동기화
  }, [narrative.governance, narrative.strategy, narrative.riskMgmt, frame]);

  // narrative ready 플래그 = 실제 서술 유무로 계산.
  const govReady = governance.trim() !== '';
  const stratReady = strategy.trim() !== '';
  const riskReady = riskMgmt.trim() !== '';

  const ITEMS = [
    { pillar: '거버넌스', item: '기후 관련 감독 체계', source: '서술 입력', ready: govReady },
    { pillar: '전략', item: '기후 리스크·기회', source: '서술 입력·감축목표', ready: stratReady },
    { pillar: '위험관리', item: '리스크 식별·관리 절차', source: '서술 입력', ready: riskReady },
    { pillar: '지표·목표', item: 'Scope 1·2 배출량', source: '명세서(VERIFIED)', ready: d.total > 0 },
    { pillar: '지표·목표', item: 'Scope 3 배출량', source: 'Scope 3', ready: d.scope3 > 0 },
    { pillar: '지표·목표', item: '감축목표·이행실적', source: '감축목표', ready: target.targetTco2 > 0 },
  ];
  const ready = ITEMS.filter((i) => i.ready).length;

  const n = (v: number) => v.toLocaleString();
  const targetLine =
    target.targetTco2 > 0
      ? `${target.targetYear}년 ${n(Math.round(target.targetTco2))} tCO₂eq (기준연도 ${target.baseYear})`
      : '감축목표 미설정';

  const preview =
    frame === 'ISSB'
      ? `[IFRS S2 · 기후 관련 공시 ${YEAR}]
지배구조  ${governance.trim() || '(입력 필요)'}
전략      ${strategy.trim() || '(입력 필요)'}
위험관리  ${riskMgmt.trim() || '(입력 필요)'}
지표·목표
  - Scope 1   ${n(d.scope1)} tCO₂eq
  - Scope 2   ${n(d.scope2)} tCO₂eq
  - Scope 3   ${n(d.scope3)} tCO₂eq
  - 감축목표  ${targetLine}`
      : `[KSSB 제2호 · 기후공시 ${YEAR}]
① 지배구조  ${governance.trim() || '(입력 필요)'}
② 전략      ${strategy.trim() || '(입력 필요)'}
③ 위험관리  ${riskMgmt.trim() || '(입력 필요)'}
④ 지표·목표 (명세서 VERIFIED 연동)
  Scope 1: ${n(d.scope1)} / Scope 2: ${n(d.scope2)} / Scope 3: ${n(d.scope3)} tCO₂eq
감축목표: ${targetLine}`;

  const companyLabel = companyId != null ? `회사 #${companyId}` : '회사 미상';
  const saveDisabled = companyId == null || upsert.isPending;

  async function doSave() {
    if (companyId == null) return;
    setFeedback(null);
    try {
      await upsert.mutateAsync({
        companyId,
        year: YEAR,
        framework: frame,
        governance: governance.trim(),
        strategy: strategy.trim(),
        riskMgmt: riskMgmt.trim(),
      });
      setFeedback({ kind: 'ok', msg: '공시 서술을 저장했습니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: '저장 중 오류가 발생했습니다 (서버 미배포 시 배포 후 재시도).' });
    }
  }

  function buildExportData(): DisclosureExportData {
    return {
      framework: frame,
      year: YEAR,
      company: companyLabel,
      governance: governance.trim(),
      strategy: strategy.trim(),
      riskMgmt: riskMgmt.trim(),
      scope1: d.scope1,
      scope2: d.scope2,
      scope3: d.scope3,
      target: { baseYear: target.baseYear, targetYear: target.targetYear, targetTco2: target.targetTco2 },
    };
  }

  async function doExportPdf() {
    try {
      await exportDisclosurePdf(`공시_${frame}_${companyLabel}_${YEAR}.pdf`, buildExportData());
    } catch {
      setFeedback({ kind: 'err', msg: 'PDF 내보내기 중 오류가 발생했습니다.' });
    }
  }
  function doExportCsv() {
    try {
      exportDisclosureCsv(`공시_${frame}_${companyLabel}_${YEAR}.csv`, buildExportData());
    } catch {
      setFeedback({ kind: 'err', msg: 'CSV 내보내기 중 오류가 발생했습니다.' });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '공시 export' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">공시 export</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={doExportCsv} title="현재 프레임 공시 서식 CSV">
            <FileText size={15} /> CSV
          </Button>
          <Button variant="primary" size="sm" onClick={doExportPdf}>
            <Download size={15} /> {frame} 서식 내보내기
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(['ISSB', 'KSSB'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFrame(f)}
            className={`rounded-lg px-3 py-1.5 text-xs ${frame === f ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-slate-400'}`}
          >
            {f === 'ISSB' ? 'IFRS S2 (ISSB)' : 'KSSB 제2호'}
          </button>
        ))}
      </div>

      {/* 거버넌스/전략/위험관리 서술 편집·저장 (영속화 V109) */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            거버넌스·전략·위험관리 서술{' '}
            <span className="text-xs font-normal text-slate-500">
              ({frame} · {YEAR})
            </span>
          </h2>
          <Button variant="primary" size="sm" onClick={doSave} disabled={saveDisabled} loading={upsert.isPending}>
            <Save size={15} /> 저장
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <NarrativeField
            label="거버넌스 (기후 감독 체계)"
            value={governance}
            onChange={setGovernance}
            ready={govReady}
          />
          <NarrativeField label="전략 (기후 리스크·기회)" value={strategy} onChange={setStrategy} ready={stratReady} />
          <NarrativeField label="위험관리 (식별·관리 절차)" value={riskMgmt} onChange={setRiskMgmt} ready={riskReady} />
        </div>
        {feedback && (
          <p className={`mt-3 text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {feedback.msg}
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-white">
            {frame === 'ISSB' ? 'IFRS S2 기후공시' : 'KSSB 제2호 기후공시'} 매핑
          </h2>
          <span className="text-xs text-slate-400">
            준비 {ready}/{ITEMS.length}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-t border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">공시 축</th>
              <th className="px-4 py-3">항목</th>
              <th className="px-4 py-3">데이터 소스</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((it, i) => (
              <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3 text-slate-400">{it.pillar}</td>
                <td className="px-4 py-3">{it.item}</td>
                <td className="px-4 py-3 text-slate-400">{it.source}</td>
                <td className="px-4 py-3">
                  {it.ready ? <Badge variant="success">연동됨</Badge> : <Badge variant="warning">입력 필요</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">
          서식 미리보기{' '}
          <span className="text-xs font-normal text-slate-500">
            ({frame === 'ISSB' ? 'IFRS S2' : 'KSSB 제2호'} · {YEAR})
          </span>
        </h2>
        <pre className="overflow-auto rounded-lg border border-white/[0.06] bg-black/30 p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
          {preview}
        </pre>
      </Card>
      <p className="text-xs text-slate-500">
        명세서·Scope 3·감축목표 데이터를 공시 서식으로 변환한다. 2028년부터 자산 30조 이상 상장사 단계적 의무화(KSSB
        제1·2호, IFRS S1·S2 기반).
      </p>
    </div>
  );
}
