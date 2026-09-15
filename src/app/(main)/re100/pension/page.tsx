'use client';

import { Coins, Users, Wallet, RefreshCw } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePensionMembers, usePensionPayouts } from '@/hooks/re100/useRe100Ext';

// 무탄소산단 상생연금 — 설계 v2/docs/11 §2.2 + 백엔드 배선(설계문서 17). 3차년도 필수지표(도입 1건·지급 1회).
// 계획서 p.134: 전력거래형(PPA) 태양광 연계, 협동조합 채권투자, 연 8%, 0.33MW×0.5억/MW=0.165억.
// 정직 상태(설계 22 정합): mock 폴백 없음 — 실데이터/빈/오류를 정확히 구분 표시.

export default function PensionPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const membersQ = usePensionMembers(companyId);
  const payoutsQ = usePensionPayouts(companyId);
  const MEMBERS = membersQ.data ?? [];
  const PAYOUTS = (payoutsQ.data ?? []).map((p) => ({
    q: p.quarter,
    amount: p.amount,
    members: p.members,
    status: p.status,
  }));
  const totalFund = MEMBERS.reduce((s, m) => s + m.fund, 0);

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 상생연금을 조회할 수 없습니다'
      : membersQ.isError || payoutsQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: '상생연금' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">무탄소산단 상생연금</h1>
        <span className="text-xs text-slate-400">전력거래형 태양광 연계 시범사업 · 3차년도</span>
      </div>

      {guardReason && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-300">
          {guardReason}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Coins size={15} /> 시범 적용 규모
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            0.165 <span className="text-sm text-slate-400">억원</span>
          </div>
          <div className="text-[11px] text-slate-500">0.33MW × 0.5억/MW</div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users size={15} /> 협동조합원
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {MEMBERS.length} <span className="text-sm text-slate-400">인</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Wallet size={15} /> 총 출자금
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            {totalFund.toLocaleString()} <span className="text-sm text-slate-400">만원</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <RefreshCw size={15} /> 지급 이율
          </div>
          <div className="mt-1 text-xl font-bold text-white">
            연 8 <span className="text-sm text-slate-400">%</span>
          </div>
          <div className="text-[11px] text-slate-500">또는 20년 분할상환</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold text-white mb-2">개요</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          공장소유주(필수)·입주기업·근로자가 협동조합을 구성해 태양광 발전사업에{' '}
          <span className="text-primary">채권 형태로 참여</span>, 투자 비율에 따라 매월 은행이율 이상의 수익금을
          수령합니다. 투자하한 0.5억원/MW. 발전수익 → 조합원 환원 → 산단 에너지전환·추가 태양광 인프라로 이어지는{' '}
          <span className="text-primary">선순환 구조</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">협동조합원</div>
          <table className="w-full text-sm">
            <tbody>
              {MEMBERS.length ? (
                MEMBERS.map((m, i) => (
                  <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3 text-xs text-slate-500">{m.role}</td>
                    <td className="px-4 py-3">{m.name}</td>
                    <td className="px-4 py-3 text-right">{m.fund.toLocaleString()}만원</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-xs text-slate-500">
                    등록된 조합원이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-4 py-3 text-sm font-semibold text-white bg-white/[0.02]">상생연금 지급(분기별)</div>
          <table className="w-full text-sm">
            <tbody>
              {PAYOUTS.length ? (
                PAYOUTS.map((p, i) => (
                  <tr key={i} className="border-b border-white/[0.04] text-slate-300">
                    <td className="px-4 py-3">{p.q}</td>
                    <td className="px-4 py-3 text-right">{p.amount}만원</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.members}인</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-500">
                    지급 내역이 없습니다.
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
