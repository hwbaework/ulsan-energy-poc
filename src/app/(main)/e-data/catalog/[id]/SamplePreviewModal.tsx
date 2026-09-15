'use client';

// 샘플 구성·확인 모달 — 설계 12 §6·부록 C.2 + 기획 14 §5(전용 샘플 승격).
// GET datamarket.sample(id) → 서버 생성 비식별 표본(미존재 시 preview 서버 폴백) + "이 샘플로 구매" CTA.
// 비식별 컬럼은 마스킹 배지로 표기(원본 미노출). 설계 22: 오류/빈 상태를 정직하게 표기(데모 배지 제거).

import { ShieldCheck, ShoppingCart } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { useDatasetSample } from '@/hooks/edm/useDm';

interface Props {
  open: boolean;
  onClose: () => void;
  datasetId: number;
  datasetTitle: string;
  onBuy: () => void;
}

export function SamplePreviewModal({ open, onClose, datasetId, datasetTitle, onBuy }: Props) {
  const { data, isLive, isLoading, isError } = useDatasetSample(datasetId, open);

  const columns = data?.columns ?? [];
  const rows = data?.rows ?? [];
  const totalRows = data?.totalRows ?? 0;
  // generated=false 이면 서버 preview 폴백(전용 샘플 미생성). generated=true 는 dm_dataset_sample 저장분.
  const truncated = rows.length > 0 && totalRows > rows.length;

  return (
    <Modal open={open} onClose={onClose} title="샘플 확인" size="lg">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-white">{datasetTitle}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
              <ShieldCheck size={12} /> 비식별 규칙(consent) 적용 대표 표본 — 원천 RAW는 구매 후 제공됩니다.
            </p>
          </div>
          {isLive ? (
            <Badge variant="success">실 샘플</Badge>
          ) : isError ? (
            <Badge variant="warning">불러오기 실패</Badge>
          ) : (
            <Badge variant="default">샘플 없음</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-accent">샘플을 불러오는 중…</div>
        ) : columns.length === 0 ? (
          <div className="py-10 text-center text-sm text-accent">샘플 데이터가 없습니다.</div>
        ) : (
          <>
            {/* 스키마 부분집합 (마스킹 표기) */}
            <div>
              <p className="mb-2 text-xs font-medium text-slate-400">컬럼 스키마 ({columns.length}개)</p>
              <div className="flex flex-wrap gap-2">
                {columns.map((c) => (
                  <span
                    key={c.name}
                    className="inline-flex items-center gap-1 rounded-lg bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300"
                  >
                    <span className="font-mono text-primary">{c.name}</span>
                    <span className="text-slate-500">{c.type}</span>
                    {c.masked && <Badge variant="warning">마스킹</Badge>}
                  </span>
                ))}
              </div>
            </div>

            {/* 대표 행 미리보기 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400">대표 {rows.length}행 미리보기</p>
                {truncated && (
                  <Badge variant="info">
                    {rows.length} / 총 {totalRows.toLocaleString()}행
                  </Badge>
                )}
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border border-accent/10">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d1520]">
                    <tr className="bg-white/[0.02]">
                      {columns.map((c) => (
                        <th key={c.name} className="text-left py-2 px-3 font-medium text-accent whitespace-nowrap">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-accent/10 hover:bg-white/[0.02]">
                        {columns.map((c) => (
                          <td key={c.name} className="py-2 px-3 text-white whitespace-nowrap font-mono">
                            {String(row[c.name] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>
            닫기
          </Button>
          <Button size="sm" onClick={onBuy}>
            <ShoppingCart size={14} /> 이 샘플로 구매
          </Button>
        </div>
      </div>
    </Modal>
  );
}
