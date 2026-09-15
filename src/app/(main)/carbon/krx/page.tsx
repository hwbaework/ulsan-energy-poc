'use client';

import { TrendingUp, TrendingDown, FileText, PieChart, BookOpen } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { useCarbonQuotes } from '@/hooks/edm/useCarbon';
import { useEtsParams, useMethodologies } from '@/hooks/edm/useCarbonDelta';

// KRX 연계거래 — 설계 docs/기획/02 §2.8 (시세·호가·자료실). 실시세는 KRX API 연동(외부).
// 제4차 계획기간 파라미터(기획 14 §4.4)·KOC 방법론 참조(§4.3) 위젯 포함.
const ETS_PERIOD = '2026-2030';

export default function KrxPage() {
  const { data: KRX_QUOTES } = useCarbonQuotes();
  const { data: ETS_PARAMS } = useEtsParams(ETS_PERIOD);
  const { data: METHODOLOGIES } = useMethodologies(false);
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '카본 마켓플레이스', path: '/carbon' }, { label: 'KRX 연계거래' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">KRX 연계거래</h1>
        <span className="text-xs text-slate-400">한국거래소(KRX) 배출권 시장 · 지연시세</span>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">종목</th>
              <th className="px-4 py-3 text-right">현재가</th>
              <th className="px-4 py-3 text-right">등락</th>
              <th className="px-4 py-3 text-right">매수호가</th>
              <th className="px-4 py-3 text-right">매도호가</th>
            </tr>
          </thead>
          <tbody>
            {KRX_QUOTES.map((q) => (
              <tr key={q.name} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3 font-medium">{q.name}</td>
                <td className="px-4 py-3 text-right">{q.last.toLocaleString()}</td>
                <td className={`px-4 py-3 text-right ${q.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  <span className="inline-flex items-center gap-1">
                    {q.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {Math.abs(q.change)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400">{q.bid.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-400">{q.ask.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <PieChart size={15} /> 제4차 계획기간 무상할당 ({ETS_PERIOD})
          </h3>
          {ETS_PARAMS.length === 0 ? (
            <p className="text-xs text-slate-500">파라미터 데이터가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {ETS_PARAMS.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-slate-300">{p.sector}</span>
                  <span className="text-xs font-semibold text-white">
                    무상할당 {p.freeAllocRatio}%{p.msrReserve != null ? ` · MSR ${p.msrReserve.toLocaleString()}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <BookOpen size={15} /> KOC 방법론 참조
          </h3>
          {METHODOLOGIES.length === 0 ? (
            <p className="text-xs text-slate-500">등록된 방법론이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {METHODOLOGIES.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
                  <span className="text-xs text-slate-300">
                    <span className="font-mono text-slate-400">{m.code}</span> · {m.name}
                  </span>
                  <Badge variant={m.approved ? 'success' : 'default'}>{m.approved ? '승인' : '미승인'}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
          <FileText size={15} /> 자료실
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {['배출권 거래시장 이용정보', '정책·동향 자료', '금융연계 안내'].map((t) => (
            <div key={t} className="rounded-lg bg-white/[0.03] px-3 py-2.5 text-xs text-slate-300">
              {t}
            </div>
          ))}
        </div>
      </Card>
      <p className="text-xs text-slate-500">※ 실시간 시세·주문은 KRX 배출권시장 연동 필요(외부). 현재 지연·참고용.</p>
    </div>
  );
}
