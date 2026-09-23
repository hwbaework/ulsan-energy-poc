'use client';

import { useMemo, useState } from 'react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { StatusPill } from '@/components/ui/Design';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { DataTable, type Column } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { useMockTradingRequests, mockUpdateRequestStatus } from '@/lib/mockTradingStore';
import { useCompanies } from '@/hooks/platform/useCompanies';
import { CONTRACT_KIND_LABEL } from '@/lib/design';
import type { PlantContractKind } from '@/types/monitoring';
import { useToastStore } from '@/stores/useToastStore';

// 거래 승인 — 발전사가 올린 PPA 공급 신청을 SPC 가 승인·반려한다. 표에서 바로 처리, 상세 화면 없음.
// 승인하면 발전사가 희망 단가를 기입한 뒤 수용가 매칭 풀에 오른다(거래 관리에서 진행).

interface SupplyRequest {
  id: number;
  companyName: string;
  representative: string;
  businessNumber: string;
  plantName: string;
  resource: string;
  contract: string;
  capacityKw: number;
  durationYears: number;
  expectedAnnualKwh: number;
  region: string;
  date: string;
  notes: string;
}

const resourceOf = (notes?: string) => notes?.match(/자원:\s*([^/]+)/)?.[1]?.trim() ?? '태양광';
const businessNumberOf = (notes?: string) => notes?.match(/사업자번호:\s*([\d-]+)/)?.[1] ?? '';

export default function TradingApprovalsPage() {
  const addToast = useToastStore((s) => s.add);
  // 거래 목업은 localStorage 스토어 — 다른 거래 화면과 같은 훅을 쓴다
  const requests = useMockTradingRequests();
  // 기업명·대표자·사업자등록번호는 기업 관리 데이터 기준(기업명으로 매칭)
  const { data: companyData } = useCompanies();
  const companies: any[] = (companyData as any)?.content ?? [];
  const [detail, setDetail] = useState<SupplyRequest | null>(null);
  const [rejectItem, setRejectItem] = useState<SupplyRequest | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  // 발전사 공급 신청 중 승인 대기(SUBMITTED)만
  const rows = useMemo<SupplyRequest[]>(
    () =>
      (requests as any[])
        .filter((r) => r.requesterType === 'GENERATOR' && r.status === 'SUBMITTED')
        .map((r) => {
          const c = companies.find((x) => x.name === r.companyName);
          return {
          id: r.id,
          companyName: r.companyName ?? '',
          representative: c?.representativeName ?? '',
          businessNumber: c?.businessNumber ?? businessNumberOf(r.notes),
          plantName: r.plantName ?? '',
          resource: resourceOf(r.notes),
          // 계약 유형: 자가소비 / 온사이트 PPA. 없으면 PPA 신청은 온사이트로 본다
          contract: CONTRACT_KIND_LABEL[(r.contractKind ?? 'ONSITE') as PlantContractKind],
          capacityKw: r.capacityKw ?? 0,
          durationYears: r.durationYears ?? 0,
          expectedAnnualKwh: r.expectedAnnualKwh ?? 0,
          region: r.region ?? '',
          date: (r.submittedAt ?? r.createdAt ?? '').slice(0, 10),
          notes: (r.notes ?? '').replace(/자원:[^/]*\/?\s*|사업자번호:\s*[\d-]+\s*/g, '').trim(),
          };
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [requests, companies],
  );

  const approve = (r: SupplyRequest) => {
    setBusyId(r.id);
    mockUpdateRequestStatus(r.id, 'APPROVED');
    addToast('success', `${r.companyName} · ${r.plantName} 공급 신청을 승인했습니다`);
    setDetail(null);
    setBusyId(null);
  };
  const reject = (r: SupplyRequest) => {
    setBusyId(r.id);
    mockUpdateRequestStatus(r.id, 'CANCELLED');
    addToast('success', `${r.companyName} · ${r.plantName} 공급 신청을 반려하고 사유를 전달했습니다`);
    setRejectItem(null);
    setDetail(null);
    setReason('');
    setBusyId(null);
  };

  // 너비 = 글자 폭 + 셀 패딩 32px. 발전사만 너비 미지정(남는 폭 전부)
  // 용어는 기업 관리와 동일(기업명·대표자). 발전사업자는 발전소 1개(1:1)라 표에는 기업명만 — 발전소는 상세 '공급 자원'에서
  const columns: Column<SupplyRequest>[] = [
    { key: 'companyName', header: '기업명', render: (r) => <span className="text-sm font-medium text-white whitespace-nowrap">{r.companyName}</span> },
    { key: 'resource', header: '자원', width: '100px', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{r.resource}</span> },
    { key: 'contract', header: '계약 유형', width: '130px', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{r.contract}</span> },
    // 정렬은 전부 왼쪽으로 통일
    { key: 'capacityKw', header: '설비용량', width: '130px', render: (r) => <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{r.capacityKw.toLocaleString()} kW</span> },
    { key: 'durationYears', header: '계약기간', width: '110px', render: (r) => <span className="text-sm text-slate-300 tabular-nums whitespace-nowrap">{r.durationYears}년</span> },
    { key: 'region', header: '지역', width: '120px', render: (r) => <span className="text-sm text-slate-300 whitespace-nowrap">{r.region || '-'}</span> },
    { key: 'date', header: '신청일', width: '130px', render: (r) => <span className="text-sm text-slate-400 tabular-nums whitespace-nowrap">{r.date}</span> },
    { key: 'status' as keyof SupplyRequest, header: '상태', width: '90px', render: () => <StatusPill tone="warning" label="대기" /> },
    {
      key: 'actions' as keyof SupplyRequest,
      header: '',
      width: '90px',
      render: (r) => (
        <Button size="sm" onClick={() => setDetail(r)}>
          상세
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '거래 승인' }]} />
      <h1 className="text-2xl font-bold text-white">거래 승인</h1>

      <SectionCard title="공급 신청 승인 대기">
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="승인 대기 중인 공급 신청이 없습니다" />
      </SectionCard>

      {/* 상세 — 계약 정보 전부 확인 후 승인·반려 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="공급 신청 상세" size="md">
        {detail && (
          <div className="space-y-5">
            {/* 소제목 없이 항목만 — 라벨 14px · 값 16px */}
            <div className="grid grid-cols-2 gap-4">
              <Info label="기업명" value={detail.companyName} />
              <Info label="대표자명" value={detail.representative} />
              <Info label="사업자등록번호" value={detail.businessNumber} />
              <Info label="발전소" value={detail.plantName} />
              <Info label="자원" value={detail.resource} />
              <Info label="계약 유형" value={detail.contract} />
              <Info label="설비용량" value={`${detail.capacityKw.toLocaleString()} kW`} />
              <Info label="계약기간" value={`${detail.durationYears}년`} />
              <Info label="예상 연간 발전량" value={detail.expectedAnnualKwh ? `${detail.expectedAnnualKwh.toLocaleString()} kWh` : ''} />
              <Info label="지역" value={detail.region} />
              <Info label="신청일" value={detail.date} />
              <Info label="비고" value={detail.notes} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setDetail(null)}>
                닫기
              </Button>
              <Button variant="danger" onClick={() => { setRejectItem(detail); setReason(''); }}>
                반려
              </Button>
              <Button disabled={busyId === detail.id} onClick={() => approve(detail)}>
                {busyId === detail.id ? '처리 중...' : '승인'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 반려 — 사유를 써서 발전사에 전달 */}
      <Modal open={!!rejectItem} onClose={() => setRejectItem(null)} title="공급 신청 반려" size="sm">
        {rejectItem && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <span className="font-medium text-white">{rejectItem.companyName}</span> · {rejectItem.plantName} · {rejectItem.capacityKw.toLocaleString()} kW
            </p>
            <Textarea label="반려 사유" placeholder="발전사에 전달할 사유" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <Button variant="secondary" onClick={() => setRejectItem(null)}>
                취소
              </Button>
              <Button variant="danger" disabled={!reason.trim() || busyId === rejectItem.id} onClick={() => reject(rejectItem)}>
                {busyId === rejectItem.id ? '처리 중...' : '반려 전달'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-sm text-slate-400 mb-1">{label}</p>
      <p className="text-base text-white">{value || '-'}</p>
    </div>
  );
}
