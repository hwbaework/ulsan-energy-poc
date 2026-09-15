'use client';

import { Activity, AlertTriangle, Cpu, Clock } from 'lucide-react';
import { usePredictReadings } from '@/hooks/control/useControl';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePredictAssets, usePredictSignals } from '@/hooks/control/useControl';

// 예지보전 — 설계 v2/docs/12 §3 + 백엔드 배선(17). AI 전류 예지보전·건전성·잔여수명·고장징후.
// 프로덕션 mock 폴백 제거(캐논 useGhg 패턴): 실데이터/빈/오류 상태만 노출.
const STATUS_TONE: Record<string, string> = {
  정상: 'text-emerald-400',
  주의: 'text-amber-400',
  경고: 'text-orange-400',
  점검필요: 'text-red-400',
};

export default function PredictivePage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const assetsQ = usePredictAssets(companyId);
  const signalsQ = usePredictSignals(companyId);
  const PREDICT_ASSETS = assetsQ.data;
  const PREDICT_SIGNALS = signalsQ.data;
  const cnt = (s: string) => PREDICT_ASSETS.filter((a) => a.status === s).length;
  // 회사 미귀속 / 호출 실패를 정확히 구분(mock 폴백 없음).
  const guardReason =
    companyId == null
      ? '회사 정보가 없어 예지보전 데이터를 불러올 수 없습니다'
      : assetsQ.isError || signalsQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  // V107: 실시간 전류·온도 추이 — 첫 설비 기준 최근 24시간. 계측 ingestion 대기 시 빈.
  const readingsAsset = PREDICT_ASSETS[0];
  const readingsQ = usePredictReadings(readingsAsset?.id, 24);

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '통합관제' }, { label: '예지보전' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">AI 예지보전</h1>
        <span className="text-xs text-slate-400">Data 분석 기반 AI 전류 예지보전 · 실시간 모니터링</span>
      </div>
      {guardReason && <p className="text-xs text-amber-400">{guardReason}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: <Activity size={15} />, label: '정상', v: cnt('정상'), tone: 'text-emerald-400' },
          { icon: <AlertTriangle size={15} />, label: '주의', v: cnt('주의'), tone: 'text-amber-400' },
          { icon: <AlertTriangle size={15} />, label: '경고', v: cnt('경고'), tone: 'text-orange-400' },
          { icon: <Cpu size={15} />, label: '점검필요', v: cnt('점검필요'), tone: 'text-red-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {s.icon} {s.label}
            </div>
            <div className={`mt-1 text-xl font-bold ${s.tone}`}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* AI 전류 예지보전 — 건전성·잔여수명 */}
      <div className="rounded-xl border border-white/[0.06] overflow-hidden">
        <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">
          설비별 건전성 · 잔여수명 (AI 전류 분석)
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">설비</th>
              <th className="px-4 py-3 text-right">전류(A)</th>
              <th className="px-4 py-3">건전성 지수</th>
              <th className="px-4 py-3 text-right">잔여수명(일)</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {PREDICT_ASSETS.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-500">
                  {guardReason ? '건전성 데이터를 불러올 수 없습니다.' : '분석된 설비 건전성 데이터가 없습니다.'}
                </td>
              </tr>
            ) : (
              PREDICT_ASSETS.map((a) => (
                <tr key={a.id} className="border-b border-white/[0.04] text-slate-300">
                  <td className="px-4 py-3">{a.facility}</td>
                  <td className="px-4 py-3 text-right">{a.current}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${a.healthIndex >= 80 ? 'bg-emerald-400' : a.healthIndex >= 55 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${a.healthIndex}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{a.healthIndex}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">{a.rul}</td>
                  <td className={`px-4 py-3 ${STATUS_TONE[a.status]}`}>{a.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 실시간 전류·온도 추이 — V107 predict_reading 배선. 계측 ingestion 대기 시 빈. */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">
            실시간 전류·온도 추이{readingsAsset ? ` — ${readingsAsset.facility}` : ''}
          </h3>
          {!readingsAsset || readingsQ.data.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
              {readingsQ.isError ? '계측 데이터를 불러올 수 없습니다.' : '실시간 계측 수신 대기'}
            </div>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                    <th className="px-2 py-2">시각</th>
                    <th className="px-2 py-2 text-right">전류(A)</th>
                    <th className="px-2 py-2 text-right">온도(℃)</th>
                  </tr>
                </thead>
                <tbody>
                  {readingsQ.data.map((r) => (
                    <tr key={r.id} className="border-b border-white/[0.04] text-slate-300">
                      <td className="px-2 py-2 text-slate-500">{r.readingTs}</td>
                      <td className="px-2 py-2 text-right">{r.currentA ?? '-'}</td>
                      <td className="px-2 py-2 text-right">{r.tempC ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 고장 징후 탐지 */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold text-white mb-3">고장 징후 탐지 · 서비스 시기 알림</h3>
          {PREDICT_SIGNALS.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-xs text-slate-500">
              {guardReason ? '고장 징후 데이터를 불러올 수 없습니다.' : '탐지된 고장 징후가 없습니다.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {PREDICT_SIGNALS.map((s) => (
                <div key={s.id} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{s.facility}</span>
                    <span className="flex items-center gap-1 text-[11px] text-amber-400">
                      <Clock size={11} />
                      {s.predictedAt}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {s.symptom} → <span className="text-sky-400">{s.recommendation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        전류 데이터 0.1초 수집 기반 · 예지보전 데이터셋 축적 (아이티공간 예지보전 연계)
      </p>
    </div>
  );
}
