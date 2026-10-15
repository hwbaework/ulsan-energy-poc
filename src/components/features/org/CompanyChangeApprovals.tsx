'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { DataTable, type Column, TABLE, TABLE_HEAD_ROW, TABLE_ROW, TABLE_TD, TABLE_TH } from '@/components/features/DataList';
import { SectionCard } from '@/components/features/SectionCard';
import { BizLicenseSheet } from './BizLicenseSheet';
import { useCompany, useUpdateCompany } from '@/hooks/platform/useCompanies';
import { useToastStore } from '@/stores/useToastStore';
import { localNow } from '@/stores/useBillingStore';
import { FIELD_LABEL, useCompanyChangeStore, useHydrateCompanyChange, type CompanyChangeRequest } from '@/stores/useCompanyChangeStore';

/**
 * 승인 관리 › 기업 정보 변경 — 줄에서 바로 확인하지 않는다. [검토]로 올라온 사업자 등록증과 바뀌는 내용을 같이 보고
 * 그 창에서 [확인 · 반영] 또는 [반려(사유)]
 */
export function CompanyChangeApprovals() {
  useHydrateCompanyChange();
  const requests = useCompanyChangeStore((s) => s.requests);
  const [open, setOpen] = useState<CompanyChangeRequest | null>(null);
  const pending = requests.filter((r) => r.status === 'PENDING');
  const cols: Column<CompanyChangeRequest>[] = [
    { key: 'co', header: '기업', width: '140px', render: (r) => r.companyName },
    {
      key: 'chg',
      header: '바뀌는 항목',
      render: (r) => <span className="text-slate-300">{r.changes.map((c) => FIELD_LABEL[c.key]).join(', ')}</span>,
    },
    { key: 'file', header: '새 등록증', width: '220px', render: (r) => <span className="text-slate-300">{r.fileName}</span> },
    { key: 'by', header: '요청', width: '160px', render: (r) => <span className="tabular-nums text-slate-300">{`${r.requestedAt.slice(0, 10)} · ${r.requestedBy}`}</span> },
    {
      key: 'act',
      header: '',
      width: '100px',
      align: 'right',
      render: (r) => (
        <Button size="sm" onClick={() => setOpen(r)}>
          검토
        </Button>
      ),
    },
  ];
  return (
    <>
      <SectionCard title="기업 정보 변경" noPadding>
        <DataTable columns={cols} data={pending} rowKey={(r) => r.id} emptyMessage="확인할 변경 요청이 없습니다" />
      </SectionCard>
      {open && <CompanyChangeReviewModal r={open} onClose={() => setOpen(null)} />}
    </>
  );
}

/** 검토 창 — 왼쪽 등록증, 오른쪽 바뀌는 내용(지금 → 요청). 등록증을 보고 확인 · 반영 또는 반려 */
export function CompanyChangeReviewModal({ r, onClose }: { r: CompanyChangeRequest; onClose: () => void }) {
  const addToast = useToastStore((s) => s.add);
  const approve = useCompanyChangeStore((s) => s.approve);
  const reject = useCompanyChangeStore((s) => s.reject);
  const updateCompany = useUpdateCompany();
  const { data: company } = useCompany(r.companyId);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const confirm = () => {
    const data = Object.fromEntries(r.changes.map((c) => [c.key, c.after]));
    updateCompany.mutate(
      { id: r.companyId, data },
      {
        onSuccess: () => {
          approve(r.id, localNow());
          addToast('success', `${r.companyName} 기업 정보 변경 반영`);
          onClose();
        },
        onError: () => addToast('error', '반영하지 못했습니다'),
      },
    );
  };

  // 등록증 — 올린 파일이 있으면 그대로(이미지 · PDF), 데모 요청은 등록증 양식으로 그린다(요청 값 기준)
  const after = (k: keyof typeof FIELD_LABEL, cur?: string) => r.changes.find((c) => c.key === k)?.after ?? cur ?? '-';

  return (
    <Modal
      open
      onClose={onClose}
      title={`기업 정보 변경 · ${r.companyName}`}
      size="xl"
      footer={
        rejecting ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              취소
            </Button>
            <Button
              variant="danger"
              disabled={!note.trim()}
              onClick={() => {
                reject(r.id, note.trim(), localNow());
                addToast('success', `${r.companyName} 변경 반려`);
                onClose();
              }}
            >
              반려
            </Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => setRejecting(true)}>
              반려
            </Button>
            <Button onClick={confirm} disabled={updateCompany.isPending}>
              확인 · 반영
            </Button>
          </div>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* 등록증 */}
        <div className="space-y-2">
          <BizLicenseSheet
            fileUrl={r.fileUrl}
            fileName={r.fileName}
            f={{
              businessNumber: company?.businessNumber,
              name: after('name', company?.name),
              representativeName: after('representativeName', company?.representativeName),
              address: after('address', company?.address),
              bizType: after('bizType', company?.bizType),
              bizCategory: after('bizCategory', company?.bizCategory),
              phone: after('phone', company?.phone),
            }}
          />
        </div>

        {/* 바뀌는 내용 */}
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-white">바뀌는 내용</p>
            <table className={TABLE}>
              <thead>
                <tr className={TABLE_HEAD_ROW}>
                  <th className={TABLE_TH}>항목</th>
                  <th className={TABLE_TH}>지금</th>
                  <th className={TABLE_TH}>요청</th>
                </tr>
              </thead>
              <tbody>
                {r.changes.map((c) => (
                  <tr key={c.key} className={TABLE_ROW}>
                    <td className={`${TABLE_TD} text-slate-300`}>{FIELD_LABEL[c.key]}</td>
                    <td className={`${TABLE_TD} text-slate-300`}>{c.before || '-'}</td>
                    <td className={`${TABLE_TD} font-semibold text-amber-200`}>{c.after || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm tabular-nums text-slate-400">{`요청 ${r.requestedAt.replace('T', ' ').slice(0, 16)} · ${r.requestedBy}`}</p>
          {rejecting && <Textarea label="반려 사유" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />}
        </div>
      </div>
    </Modal>
  );
}
