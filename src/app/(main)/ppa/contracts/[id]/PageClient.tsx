// @ts-nocheck
'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  _Sun,
  _Wind,
  _Battery,
  _Zap,
  _ChevronRight,
  FileText,
  _Download,
  CheckCircle2,
  AlertTriangle,
  _Clock,
} from 'lucide-react';
import { SectionCard, StatCard, StatsGrid, DataTable } from '@/components/features';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, exportPdf } from '@/lib/utils';
import { useToastStore } from '@/stores/useToastStore';
import { usePpaContract, usePpaSettlements, useRequestContractChange } from '@/hooks/ppa/usePpa';
import { ContractSignature } from '@/components/features/ContractSignature';
import { useSignatureStatus, useSignContract } from '@/hooks/useContractSignature';
import { useAuthStore } from '@/stores/useAuthStore';

/* ───────────────────────── Types ───────────────────────── */

type ActiveTab = 'saving' | 'gen' | 'settle' | 'info' | 'match' | 'cost';

/* ───────────────────────── Page ───────────────────────── */

export default function PpaContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const showToast = useToastStore((s) => s.add);
  const contractId = Number(params.id);

  const { data: contract, isLoading } = usePpaContract(contractId);
  const { data: settlementsData } = usePpaSettlements({ contractId });
  const settlements = settlementsData?.content ?? [];

  const contractChangeMutation = useRequestContractChange();

  const c = contract as any;

  const isLease = c?.dealType === 'SAVINGS_SHARE' || c?.dealType === 'LEASE' || c?.dealType === 'FIXED_RENT';
  const [activeTab, setActiveTab] = useState<ActiveTab>(isLease ? 'saving' : 'match');

  const tabs = isLease
    ? [
        { key: 'saving' as const, label: '절감 분석' },
        { key: 'gen' as const, label: '발전 현황' },
        { key: 'settle' as const, label: '정산 이력' },
        { key: 'info' as const, label: '계약 정보' },
      ]
    : [
        { key: 'match' as const, label: '매칭 분석' },
        { key: 'cost' as const, label: '비용 분석' },
        { key: 'settle' as const, label: '정산 상세' },
        { key: 'info' as const, label: '계약 정보' },
      ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-accent/70">계약 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!c) {
    return (
      <div className="space-y-6">
        <button onClick={() => router.push('/ppa/contracts')} className="text-primary text-sm">
          ← 내 계약
        </button>
        <div className="text-center py-24">
          <p className="text-sm text-accent">계약을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const unitPrice = c.unitPriceKrw ?? 0;
  const capacityKw = c.totalCapacityKw ?? 0;
  const startDate = c.startDate?.slice(0, 10) ?? '';
  const endDate = c.endDate?.slice(0, 10) ?? '';
  const daysLeft = endDate ? Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000)) : 0;
  const contractNumber = c.contractNumber ?? `PPA-${c.id}`;
  const generatorName = c.generatorCompanyName ?? '발전사';
  const label = contractNumber;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => router.push('/ppa/contracts')} className="text-primary">
          ← 내 계약
        </button>
        <span className="text-accent/50">/</span>
        <span className="text-white font-semibold">{label}</span>
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold',
            isLease ? 'bg-violet-500/[0.15] text-violet-300' : 'bg-blue-500/[0.15] text-blue-300',
          )}
        >
          {isLease ? '온사이트' : '직접'}
        </span>
        <Badge variant={c.status === 'ACTIVE' ? 'success' : 'warning'}>
          {c.status === 'ACTIVE' ? '정상' : c.status === 'EXPIRED' ? '만료임박' : c.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* ═══ 좌측: 분석 콘텐츠 ═══ */}
        <div className="space-y-5">
          {/* KPI 요약 */}
          <StatsGrid columns={5}>
            {isLease ? (
              <>
                <StatCard label="현재 출력" value="342.5 kW" change={{ value: 68, label: '가동', unit: '%' }} />
                <StatCard label="이달 PPA 요금" value="₩474만" />
                <StatCard label="예상 전기요금" value="₩556만" sub="한전 기준" />
                <StatCard label="예상 절감액" value="₩82만" change={{ value: 14.7, label: '절감' }} />
                <StatCard label="예상 순이익" value="₩82만" sub="절감-PPA 요금 차액" />
              </>
            ) : (
              <>
                <StatCard label="이달 정산" value="₩363만" />
                <StatCard label="vs 시장 평균" value="-₩20/kWh" change={{ value: 15.4, label: '절감' }} />
                <StatCard label="CFE 매칭" value="87%" change={{ value: 2, label: '목표대비', unit: '%p' }} />
                <StatCard label="발전량" value="33,000 kWh" />
                <StatCard label="잔여 계약" value={`${daysLeft.toLocaleString()}일`} />
              </>
            )}
          </StatsGrid>

          {/* 탭 */}
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-semibold transition-colors ring-1',
                  activeTab === tab.key
                    ? 'bg-primary/[0.15] text-blue-300 ring-primary/40'
                    : 'bg-surface-card text-accent/70 ring-accent/20 hover:text-accent-hover hover:ring-accent/40',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ═══ Lease: 절감 분석 ═══ */}
          {activeTab === 'saving' && (
            <SectionCard title="월별 절감 비교표" description="PPA 요금 vs 한전 전기요금 vs 순절감">
              <DataTable
                data={[
                  {
                    m: '2026-05',
                    kwh: '38,500',
                    lease: '4,543,000',
                    kepco: '5,236,000',
                    save: '693,000',
                    rate: '13.2%',
                    net: '693,000',
                  },
                  {
                    m: '2026-04',
                    kwh: '41,200',
                    lease: '4,861,600',
                    kepco: '5,608,800',
                    save: '747,200',
                    rate: '13.3%',
                    net: '747,200',
                  },
                  {
                    m: '2026-03',
                    kwh: '36,800',
                    lease: '4,342,400',
                    kepco: '5,009,600',
                    save: '667,200',
                    rate: '13.3%',
                    net: '667,200',
                  },
                  {
                    m: '2026-02',
                    kwh: '28,400',
                    lease: '3,351,200',
                    kepco: '3,862,400',
                    save: '511,200',
                    rate: '13.2%',
                    net: '511,200',
                  },
                  {
                    m: '2026-01',
                    kwh: '25,600',
                    lease: '3,020,800',
                    kepco: '3,481,600',
                    save: '460,800',
                    rate: '13.2%',
                    net: '460,800',
                  },
                ]}
                rowKey={(r) => r.m}
                columns={[
                  { key: 'month', header: '월', render: (r) => r.m },
                  { key: 'kwh', header: '발전량(kWh)', render: (r) => <span className="text-accent">{r.kwh}</span> },
                  {
                    key: 'lease',
                    header: 'PPA 요금(원)',
                    render: (r) => <span className="text-violet-400">{r.lease}</span>,
                  },
                  {
                    key: 'kepco',
                    header: '한전 전기요금(원)',
                    render: (r) => <span className="text-accent">{r.kepco}</span>,
                  },
                  {
                    key: 'save',
                    header: '절감액(원)',
                    render: (r) => <span className="text-semantic-green font-semibold">{r.save}</span>,
                  },
                  {
                    key: 'rate',
                    header: '절감률',
                    render: (r) => <span className="text-semantic-green">{r.rate}</span>,
                  },
                  {
                    key: 'net',
                    header: '순이익(원)',
                    render: (r) => <span className="text-semantic-green font-semibold">{r.net}</span>,
                  },
                ]}
              />
            </SectionCard>
          )}

          {/* ═══ Lease: 발전 현황 ═══ */}
          {activeTab === 'gen' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <SectionCard title="발전량">
                  <div className="rounded-lg border border-accent/20 bg-gradient-to-b from-primary/[0.04] to-transparent flex items-center justify-center h-44 text-xs text-accent/70">
                    시간대별 발전량 에어리어 차트
                  </div>
                </SectionCard>
                <SectionCard title="자가소비 vs 잉여">
                  <div className="rounded-lg border border-accent/20 bg-gradient-to-b from-emerald-500/[0.04] to-transparent flex items-center justify-center h-44 text-xs text-accent/70">
                    자가소비(녹색) vs 역송(파랑) 스택
                  </div>
                </SectionCard>
              </div>
              <StatsGrid columns={4}>
                <StatCard label="이달 발전량" value="38,500 kWh" />
                <StatCard label="자가소비율" value="94.2%" />
                <StatCard label="가동일수" value="27 / 31일" />
                <StatCard label="일평균 발전" value="1,426 kWh" />
              </StatsGrid>
            </div>
          )}

          {/* ═══ 직접PPA: 매칭 분석 ═══ */}
          {activeTab === 'match' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <SectionCard title="자원 믹스">
                  <div className="space-y-3">
                    <div className="flex h-3 rounded-md overflow-hidden">
                      <div className="bg-amber-400" style={{ width: '60%' }} />
                      <div className="bg-sky-400" style={{ width: '25%' }} />
                      <div className="bg-violet-400" style={{ width: '15%' }} />
                    </div>
                    {[
                      { name: 'ORC 발전', pct: 60, kwh: '19,800', color: 'text-semantic-yellow' },
                      { name: '풍력', pct: 25, kwh: '8,250', color: 'text-sky-400' },
                      { name: '바이오', pct: 15, kwh: '4,950', color: 'text-violet-400' },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center justify-between text-xs">
                        <span className={r.color}>{r.name}</span>
                        <span className="text-white">
                          {r.pct}% · {r.kwh} kWh
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
                <SectionCard title="24/7 CFE 매칭">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-[10px] text-accent/70">목표</p>
                      <p className="text-2xl font-bold text-white">85%</p>
                    </div>
                    <span className="text-xl text-accent/50">→</span>
                    <div>
                      <p className="text-[10px] text-accent/70">실제</p>
                      <p className="text-2xl font-bold text-semantic-green">87%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-accent/70">차이</p>
                      <p className="text-2xl font-bold text-semantic-green">+2%p</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-accent/20 bg-gradient-to-b from-primary/[0.04] to-transparent flex items-center justify-center h-20 text-xs text-accent/70">
                    시간대별 매칭률 히트맵
                  </div>
                </SectionCard>
              </div>
              <SectionCard title="시간대별 공급 현황" description="자원별 발전량 vs 수요">
                <div className="rounded-lg border border-accent/20 bg-gradient-to-b from-amber-500/[0.04] via-sky-500/[0.04] to-violet-500/[0.04] flex items-center justify-center h-44 text-xs text-accent/70">
                  ORC(노랑) + 풍력(파랑) + 바이오(보라) 스택 vs 수요(빨강 라인)
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═══ 직접PPA: 비용 분석 ═══ */}
          {activeTab === 'cost' && (
            <div className="space-y-4">
              <SectionCard title="월별 비용 비교" description="PPA 단가 vs 시장 평균 vs 한전 요금">
                <DataTable
                  data={[
                    {
                      m: '05',
                      kwh: '33,000',
                      price: '₩110',
                      cost: '₩3,630,000',
                      market: '₩130',
                      kepco: '₩154',
                      saveM: '₩660,000',
                      saveK: '₩1,452,000',
                    },
                    {
                      m: '04',
                      kwh: '35,100',
                      price: '₩110',
                      cost: '₩3,861,000',
                      market: '₩128',
                      kepco: '₩154',
                      saveM: '₩631,800',
                      saveK: '₩1,544,400',
                    },
                    {
                      m: '03',
                      kwh: '31,200',
                      price: '₩110',
                      cost: '₩3,432,000',
                      market: '₩132',
                      kepco: '₩154',
                      saveM: '₩686,400',
                      saveK: '₩1,372,800',
                    },
                  ]}
                  rowKey={(r) => r.m}
                  columns={[
                    { key: 'month', header: '월', render: (r) => r.m },
                    { key: 'kwh', header: '발전량', render: (r) => <span className="text-accent">{r.kwh}</span> },
                    { key: 'price', header: 'PPA 단가', render: (r) => <span className="text-accent">{r.price}</span> },
                    { key: 'cost', header: 'PPA 비용', render: (r) => <span className="text-accent">{r.cost}</span> },
                    {
                      key: 'market',
                      header: '시장 평균',
                      render: (r) => <span className="text-accent">{r.market}</span>,
                    },
                    {
                      key: 'kepco',
                      header: '한전 요금',
                      render: (r) => <span className="text-accent">{r.kepco}</span>,
                    },
                    {
                      key: 'saveM',
                      header: '절감(시장)',
                      render: (r) => <span className="text-semantic-green">{r.saveM}</span>,
                    },
                    {
                      key: 'saveK',
                      header: '절감(한전)',
                      render: (r) => <span className="text-semantic-green">{r.saveK}</span>,
                    },
                  ]}
                />
              </SectionCard>
              <SectionCard title="단가 추이">
                <div className="rounded-lg border border-accent/20 bg-gradient-to-b from-primary/[0.04] to-transparent flex items-center justify-center h-40 text-xs text-accent/70">
                  PPA(파랑 직선) vs 시장평균(회색) vs 한전(빨강) 라인 차트
                </div>
              </SectionCard>
            </div>
          )}

          {/* ═══ 정산 이력/상세 (공통) ═══ */}
          {activeTab === 'settle' && (
            <div className="space-y-4">
              {!isLease && (
                <SectionCard title="정산 분해 — 2026-05">
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    {[
                      { label: '공급가액', value: '₩3,300,000' },
                      { label: 'VAT', value: '₩330,000' },
                      { label: '부가정산금', value: '₩165,000', accent: true },
                      { label: '망이용요금', value: '₩247,500', accent: true },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-accent/20 bg-surface-card p-3">
                        <p className="text-[10px] text-accent/70">{item.label}</p>
                        <p className={cn('text-sm font-semibold mt-1', item.accent ? 'text-accent' : 'text-white')}>
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: '전력산업기금', value: '₩137,093', accent: true },
                      { label: '거래수수료(KPX)', value: '₩3,413', accent: true },
                      { label: '관리수수료', value: '₩1,650', accent: true },
                      { label: '요금 조정 (SPC)', value: '—', warning: true },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className={cn(
                          'rounded-lg border bg-surface-card p-3',
                          item.warning ? 'border-amber-500/20' : 'border-accent/20',
                        )}
                      >
                        <p className={cn('text-[10px]', item.warning ? 'text-semantic-yellow' : 'text-accent/70')}>
                          {item.label}
                        </p>
                        <p
                          className={cn(
                            'text-sm font-semibold mt-1',
                            item.warning ? 'text-semantic-yellow' : item.accent ? 'text-accent' : 'text-white',
                          )}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="정산 이력">
                <DataTable
                  data={
                    settlements.length > 0
                      ? settlements.map((s: any) => ({
                          period: s.period ?? s.settlementMonth ?? '—',
                          kwh: s.totalGenerationKwh ? `${s.totalGenerationKwh.toLocaleString()} kWh` : '—',
                          col3: isLease
                            ? `₩${(s.supplyAmount ?? 0).toLocaleString()}`
                            : `₩${s.unitPriceKrw ?? unitPrice}`,
                          col4: isLease
                            ? `₩${(s.maintenanceFee ?? 0).toLocaleString()}`
                            : `₩${(s.supplyAmount ?? 0).toLocaleString()}`,
                          vat: `₩${(s.vat ?? 0).toLocaleString()}`,
                          total: `₩${(s.totalAmount ?? 0).toLocaleString()}`,
                          status: s.status === 'COMPLETED' ? 'completed' : 'pending',
                        }))
                      : isLease
                        ? [
                            {
                              period: '2026-05',
                              kwh: '38,500 kWh',
                              col3: '₩4,543,000',
                              col4: '₩120,000',
                              vat: '₩454,300',
                              total: '₩5,117,300',
                              status: 'pending',
                            },
                            {
                              period: '2026-04',
                              kwh: '41,200 kWh',
                              col3: '₩4,861,600',
                              col4: '₩120,000',
                              vat: '₩486,160',
                              total: '₩5,467,760',
                              status: 'completed',
                            },
                          ]
                        : [
                            {
                              period: '2026-05',
                              kwh: '33,000',
                              col3: '₩110',
                              col4: '₩3,300,000',
                              vat: '₩330,000',
                              total: '₩3,630,000',
                              status: 'pending',
                            },
                            {
                              period: '2026-04',
                              kwh: '35,100',
                              col3: '₩110',
                              col4: '₩3,861,000',
                              vat: '₩386,100',
                              total: '₩4,247,100',
                              status: 'completed',
                            },
                          ]
                  }
                  rowKey={(r) => r.period}
                  emptyMessage="정산 이력이 없습니다"
                  columns={[
                    { key: 'period', header: '기간', render: (r) => r.period },
                    { key: 'kwh', header: '발전량', render: (r) => <span className="text-accent">{r.kwh}</span> },
                    {
                      key: 'col3',
                      header: isLease ? 'PPA 요금' : '단가',
                      render: (r) => <span className={isLease ? 'text-violet-400' : 'text-accent'}>{r.col3}</span>,
                    },
                    {
                      key: 'col4',
                      header: isLease ? '유지보수' : '공급액',
                      render: (r) => <span className={isLease ? 'text-violet-400' : 'text-accent'}>{r.col4}</span>,
                    },
                    { key: 'vat', header: 'VAT', render: (r) => <span className="text-accent">{r.vat}</span> },
                    { key: 'total', header: '합계', render: (r) => <span className="font-semibold">{r.total}</span> },
                    {
                      key: 'status',
                      header: '상태',
                      render: (r) => (
                        <Badge variant={r.status === 'completed' ? 'success' : 'warning'}>
                          {r.status === 'completed' ? '완료' : '대기'}
                        </Badge>
                      ),
                    },
                  ]}
                />
              </SectionCard>
            </div>
          )}

          {/* ═══ 계약 정보 (공통) ═══ */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-4">
              <SectionCard title="계약 기본 정보">
                <div className="space-y-2 text-sm">
                  {[
                    { label: '계약번호', value: contractNumber },
                    { label: isLease ? '발전사 (소유)' : '발전사', value: generatorName },
                    { label: '설비 용량', value: `${capacityKw} kW` },
                    { label: isLease ? 'PPA 단가' : '단가', value: `₩${unitPrice}/kWh` },
                    { label: '계약 기간', value: `${startDate} ~ ${endDate}` },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-1.5 border-b border-accent/10">
                      <span className="text-accent/70">{row.label}</span>
                      <span className="text-white">{row.value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
              <SectionCard title={isLease ? '계약 별첨' : '계약 부록'}>
                <div className="space-y-2 text-sm">
                  {(isLease
                    ? [
                        { label: '발전보증시간', value: '3.8 h/일' },
                        { label: '예상 월 발전량', value: '38,000 kWh' },
                        { label: '유지보수비', value: '₩120,000/월' },
                        { label: '단가 조정', value: 'CPI 연동 (연 1회)' },
                        { label: '설비 반환 조건', value: '잔존가치 5% 매입' },
                      ]
                    : [
                        { label: '계약 유형', value: 'Offsite PPA (고정단가)' },
                        { label: 'vs 시장', value: '-₩20 절감' },
                        { label: '거래기관', value: '한국전력공사' },
                      ]
                  ).map((row) => (
                    <div key={row.label} className="flex justify-between py-1.5 border-b border-accent/10">
                      <span className="text-accent/70">{row.label}</span>
                      <span className="text-white">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        exportPdf(
                          `계약서_${c?.contractNumber ?? contractId}`,
                          `PPA 계약서 — ${c?.contractNumber ?? ''}`,
                          ['항목', '값'],
                          [
                            ['계약 유형', c?.contractType ?? 'PPA'],
                            ['용량', `${c?.totalCapacityKw?.toLocaleString() ?? 0} kW`],
                            ['단가', `${c?.unitPriceKrw?.toLocaleString() ?? 0} 원/kWh`],
                            ['기간', `${c?.startDate ?? ''} ~ ${c?.endDate ?? ''}`],
                          ],
                        )
                      }
                    >
                      <FileText size={14} className="mr-1" />
                      계약서 PDF
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        exportPdf(
                          `별첨_${c?.contractNumber ?? contractId}`,
                          `PPA 계약 별첨 — ${c?.contractNumber ?? ''}`,
                          ['항목', '값'],
                          [
                            ['계약번호', c?.contractNumber ?? ''],
                            ['총 용량', `${c?.totalCapacityKw?.toLocaleString() ?? 0} kW`],
                            ['단가', `₩${c?.unitPriceKrw ?? 0}/kWh`],
                          ],
                        )
                      }
                    >
                      <FileText size={14} className="mr-1" />
                      별첨 PDF
                    </Button>
                  </div>
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        {/* ═══ 우측: 설비 + 할 일 + 최근 활동 + 액션 ═══ */}
        <div className="space-y-4">
          {/* 설비 상태 (Lease만) */}
          {isLease && (
            <SectionCard title="설비 상태">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs text-accent/70">현재 출력</span>
                <span className="text-xl font-bold text-semantic-green">342.5 kW</span>
              </div>
              <div className="h-1 rounded-full bg-white/[0.08] mb-3">
                <div className="h-1 rounded-full bg-emerald-400" style={{ width: '68%' }} />
              </div>
              <StatsGrid columns={2}>
                <StatCard label="인버터" value="정상" />
                <StatCard label="통신" value="연결" />
                <StatCard label="모듈 온도" value="42°C" />
                <StatCard label="일사량" value="680 W/m²" />
              </StatsGrid>
            </SectionCard>
          )}

          {/* 할 일 */}
          <SectionCard title="할 일">
            <div className="space-y-3">
              {isLease ? (
                <>
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="text-semantic-yellow mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-white font-semibold">정기 점검 예정</p>
                      <p className="text-[10px] text-accent/70">2026.07.15 · D-43</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 border-t border-accent/10 pt-3">
                    <FileText size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-white font-semibold">5월 정산서 확인</p>
                      <p className="text-[10px] text-accent/70">₩5,117,300 · 대기</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-2">
                    <FileText size={14} className="text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-white font-semibold">5월 정산서 확인</p>
                      <p className="text-[10px] text-accent/70">₩3,630,000 · 대기</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 border-t border-accent/10 pt-3">
                    <CheckCircle2 size={14} className="text-semantic-green mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-white font-semibold">4월 정산 완료</p>
                      <p className="text-[10px] text-accent/70">₩4,247,100</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {/* 최근 활동 */}
          <SectionCard title="최근 활동">
            <div className="space-y-1 text-[11px] text-accent">
              {(isLease
                ? [
                    { date: '05-28', text: '5월 정산서 발행' },
                    { date: '05-15', text: '4월 정산 완료' },
                    { date: '05-01', text: '인버터 펌웨어 업데이트' },
                    { date: '04-28', text: '4월 정산서 발행' },
                  ]
                : [
                    { date: '05-28', text: '5월 정산서 발행' },
                    { date: '05-25', text: '자동 헷지 발생 (320kWh)' },
                    { date: '05-15', text: '4월 정산 완료' },
                    { date: '05-01', text: '매칭률 변경 (85→87%)' },
                  ]
              ).map((item) => (
                <div key={item.date} className="flex gap-2 py-1 border-b border-white/[0.02]">
                  <span className="text-accent/50 shrink-0">{item.date}</span>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 액션 버튼 */}
          <div>
            <p className="text-xs font-semibold text-accent/70 mb-2">{isLease ? '계약 액션' : '계약 액션'}</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                className="w-full"
                onClick={() =>
                  contractChangeMutation.mutate(
                    { contractId, changeType: 'RENEWAL' },
                    {
                      onSuccess: () => showToast('success', `${isLease ? '연장' : '갱신'} 신청이 접수되었습니다`),
                      onError: () => showToast('error', '신청에 실패했습니다'),
                    },
                  )
                }
              >
                {isLease ? '연장 신청' : '갱신 신청'}
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() =>
                  contractChangeMutation.mutate(
                    { contractId, changeType: 'MINOR' },
                    {
                      onSuccess: () => showToast('success', '변경 신청이 접수되었습니다'),
                      onError: () => showToast('error', '변경 신청에 실패했습니다'),
                    },
                  )
                }
              >
                변경 신청
              </Button>
              <Button
                variant="ghost"
                className="w-full text-semantic-red hover:text-semantic-red border border-rose-500/20"
                onClick={() =>
                  contractChangeMutation.mutate(
                    { contractId, changeType: 'TERMINATION' },
                    {
                      onSuccess: () => showToast('success', `${isLease ? '설비 반환' : '해지'} 신청이 접수되었습니다`),
                      onError: () => showToast('error', '신청에 실패했습니다'),
                    },
                  )
                }
              >
                {isLease ? '설비 반환 신청' : '해지 신청'}
              </Button>
            </div>
          </div>
        </div>

        <PpaSignatureSection contractId={contractId} contract={contract} />
      </div>
    </div>
  );
}

function PpaSignatureSection({ contractId, contract }: { contractId: number; contract: any }) {
  const user = useAuthStore((s) => s.user);
  const sigStatus = useSignatureStatus('PPA', contractId);
  const signMutation = useSignContract();
  const status = sigStatus.data as any;
  const signatures = status?.signatures ?? [];
  const fullySigned = status?.fullySigned ?? false;

  const myRole =
    user?.roles?.includes('CONSUMER_MANAGER') || user?.roles?.includes('CONSULTING_CLIENT') ? 'CONSUMER' : 'GENERATOR';
  const alreadySigned = signatures.some((s: any) => s.signerRole === myRole);

  if (fullySigned) {
    return (
      <div className="rounded-xl bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 p-5 mt-6">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-3">
          <CheckCircle2 size={16} /> 양측 서명 완료
        </div>
        <div className="space-y-1">
          {signatures.map((s: any) => (
            <p key={s.id} className="text-xs text-slate-400">
              {s.signerName} ({s.signerRole}) — {new Date(s.signedAt).toLocaleString('ko-KR')} ·{' '}
              {s.signMethod === 'draw' ? '직접서명' : '이름입력'}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="rounded-xl bg-sky-500/[0.06] ring-1 ring-sky-500/20 p-5 mt-6">
        <p className="text-sm text-sky-400 font-medium">서명 완료 — 상대방 서명 대기 중</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <SectionCard title="계약 서명" description="전자서명으로 계약을 체결합니다">
        <div>
          <ContractSignature
            contractTitle={`PPA 계약 — ${contract?.contractNumber ?? ''}`}
            contractSummary={[
              `계약 유형: ${contract?.contractType ?? 'PPA'}`,
              `용량: ${contract?.totalCapacityKw?.toLocaleString() ?? 0} kW`,
              `단가: ${contract?.unitPriceKrw?.toLocaleString() ?? 0} 원/kWh`,
              `기간: ${contract?.startDate ?? ''} ~ ${contract?.endDate ?? ''}`,
            ]}
            signerName={user?.name ?? ''}
            loading={signMutation.isPending}
            onSign={(data) => {
              signMutation.mutate({
                contractType: 'PPA',
                contractId,
                signerRole: myRole,
                signMethod: data.method,
                signatureImage: data.image,
                typedName: data.typedName,
              });
            }}
          />
        </div>
      </SectionCard>
    </div>
  );
}
