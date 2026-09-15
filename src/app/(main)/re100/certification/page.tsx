'use client';

import { BadgeCheck, FileCheck, Zap } from 'lucide-react';
import { useRe100Quarterly } from '@/hooks/re100/useRe100Ext';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRe100Certs } from '@/hooks/re100/useRe100Ext';

// RE100 인증 — 설계 v2/docs/11 §2.4 + 백엔드 배선(설계문서 17). 계획서 p.142: K-RE100 가입·실적·제출.
const PROCESS = [
  { step: 'K-RE100 가입', done: true },
  { step: '재생E 사용실적 수집', done: true },
  { step: '에너지공단 제출', done: true },
  { step: '재생에너지 사용확인서 수령', done: false },
];
// V108: 분기 실적은 re100_quarterly_progress 실데이터 배선(정적 상수 제거). PROCESS는 정적 유지.
// 정직 상태(설계 22 정합): 인증서·분기실적 mock 폴백 없음 — 실데이터/빈/오류를 정확히 구분 표시.

export default function CertificationPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const certsQ = useRe100Certs(companyId);
  const CERTS = certsQ.data ?? [];
  // V108: 분기 실적 실데이터. 비면 빈상태. totalMwh는 실 달성 실적 합(가짜 수치 없음).
  const quarterlyQ = useRe100Quarterly(companyId);
  const QUARTERLY = quarterlyQ.data ?? [];
  const totalMwh = QUARTERLY.reduce((s, q) => s + Number(q.achievedMwh ?? 0), 0);

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 인증서를 조회할 수 없습니다'
      : certsQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: 'RE100 인증' }]} />
      <h1 className="text-xl font-bold text-white">RE100 인증</h1>

      {guardReason && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-300">
          {guardReason}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <BadgeCheck size={15} /> K-RE100
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-400">가입 완료</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Zap size={15} /> 재생E 사용실적
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {totalMwh.toLocaleString()} <span className="text-sm text-slate-400">MWh</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileCheck size={15} /> 인증서
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {CERTS.length} <span className="text-sm text-slate-400">건</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-4">인증 이행 프로세스</h3>
        <div className="flex flex-wrap items-center gap-2">
          {PROCESS.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`rounded-lg px-3 py-1.5 text-xs ${p.done ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-slate-500'}`}
              >
                {p.step}
              </span>
              {i < PROCESS.length - 1 && <span className="text-slate-600">→</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">이행수단별 분기 실적 (MWh)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                <th className="px-4 py-3">연도/분기</th>
                <th className="px-4 py-3">이행수단</th>
                <th className="px-4 py-3 text-right">달성(MWh)</th>
                <th className="px-4 py-3 text-right">목표(MWh)</th>
              </tr>
            </thead>
            <tbody>
              {QUARTERLY.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                    {quarterlyQ.isError
                      ? '분기 실적을 불러올 수 없습니다.'
                      : '분기 실적 데이터가 없습니다 (집계 입력 대기).'}
                  </td>
                </tr>
              ) : (
                QUARTERLY.map((q) => (
                  <tr key={q.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">
                      {q.year} {q.quarter}Q
                    </td>
                    <td className="px-4 py-3 text-slate-400">{q.measureType}</td>
                    <td className="px-4 py-3 text-right">
                      {q.achievedMwh != null ? Number(q.achievedMwh).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {q.targetMwh != null ? Number(q.targetMwh).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">보유 인증서</div>
          <table className="w-full text-sm">
            <tbody>
              {CERTS.length ? (
                CERTS.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{c.type}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.year}</td>
                    <td className="px-4 py-3 text-right">{c.amount ? `${c.amount.toLocaleString()} MWh` : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    보유한 인증서가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
