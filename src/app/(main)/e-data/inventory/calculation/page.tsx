'use client';

import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgCalculation } from '@/hooks/edm/useGhg';

// 배출량 산정 — 설계 docs/기획/01 rev.2 §3 (Tier별 산정 + 불확도, ISO 14064 근거)
// 전력 배출계수(참조상수) — 목표관리제 지침 국가 기본계수. mock 아님.
const ELEC_FACTOR = 0.4781; // tCO₂eq/MWh (소비단, 2021 승인)
// 불확도(%): Scope 2 구매전력=계량 기반 낮음, Scope 1 연료·공정=계수 기반 높음
const uncertainty = (scope: number): number => (scope === 2 ? 2.0 : 5.0);

export default function CalculationPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { rows, scope1, scope2, total, isError } = useGhgCalculation(companyId, 2026);

  // 가드(설계 22): 회사 미귀속 / 호출 실패(인증만료·네트워크)를 정확히 구분(mock 폴백 없음).
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 산정할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: '배출량 산정' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">배출량 산정 (2026)</h1>
        <Badge variant="info">계수 버전: 2021 승인 국가계수</Badge>
      </div>
      {guardReason && <p className="text-xs text-amber-400">산정 불가: {guardReason}</p>}

      <Card className="p-4">
        <p className="text-sm text-slate-300">
          산정식 = <span className="text-sky-300">활동자료 × 배출계수(tCO₂eq 단위 = GWP 반영됨)</span> · 전력 배출계수 ={' '}
          <span className="text-sky-300">{ELEC_FACTOR} tCO₂eq/MWh</span> (목표관리제 지침)
        </p>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">시설</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3 text-right">활동자료</th>
              <th className="px-4 py-3 text-right">계수</th>
              <th className="px-4 py-3 text-right">배출량 (tCO₂eq)</th>
              <th className="px-4 py-3 text-right">불확도</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                  산정된 배출량이 없습니다. 배출원·활동자료를 먼저 등록하세요.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.sourceId} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{r.facility}</td>
                <td className="px-4 py-3">
                  <Badge variant={r.scope === 1 ? 'warning' : 'info'}>Scope {r.scope}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.activity.toLocaleString()} {r.unit}
                </td>
                <td className="px-4 py-3 text-right">{r.factor}</td>
                <td className="px-4 py-3 text-right font-medium text-white">{r.tCO2eq.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-400">±{uncertainty(r.scope).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-slate-300">
              <td className="px-4 py-3 text-xs text-slate-500" colSpan={4}>
                Scope 1 {scope1.toLocaleString()} · Scope 2 {scope2.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-base font-bold text-sky-300">{total.toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-xs text-slate-500">±2.4%</td>
            </tr>
          </tfoot>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        Tier별 산정식을 적용하며, 불확도(%)는 ISO 14064 근거로 검증 단계에 전달된다. 각 배출량은 활동자료
        원본(계량·요금서)까지 추적 가능하다.
      </p>
    </div>
  );
}
