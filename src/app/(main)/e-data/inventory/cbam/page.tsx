'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Badge } from '@/components/edm/ui/Badge';
import { Button } from '@/components/edm/ui/Button';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGhgCbam, useCreateCbam, useEstimateCbam, type CbamRow, type CbamReq } from '@/hooks/edm/useGhgExt';

// CBAM 제품배출 — 설계 docs/기획/01 rev.2 §3 (수출 제품단위 내재배출량, EU 신고. 산단 수출 제조업 특화)
// /api/v1/ghg/cbam 배선 (미가동 시 폴백)
// 제품 등록 배선: 설계 11 §2.6 (제품 추가 모달 + useCreateCbam). method=DEFAULT 시 §5.3 기본값 제안.

const ELEC_FACTOR = 0.4781; // tCO₂eq/MWh — CBAM 간접배출 산식(설계 11 §4.4)
const inputCls = 'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-slate-200';
const labelCls = 'block text-xs text-slate-400';

const euBadge = (e: CbamRow['eu']) => (e === '대상·준비' ? 'success' : e === '대상·미준비' ? 'warning' : 'default');

export default function CbamPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const { data: PRODUCTS, isError } = useGhgCbam(companyId);

  const create = useCreateCbam();
  const estimate = useEstimateCbam();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    hsCode: string;
    outputT: string;
    embeddedTco2: string;
    method: CbamReq['method'];
    euStatus: CbamReq['euStatus'];
    attributedDirectTco2: string;
    elecMwh: string;
  }>({
    name: '',
    hsCode: '',
    outputT: '',
    embeddedTco2: '',
    method: 'MEASURED',
    euStatus: 'READY',
    attributedDirectTco2: '',
    elecMwh: '',
  });
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  // §1.4 서버 산정 근거 캡션(basis) — DEFAULT 산정 시 서버 응답 문자열로 대체(정적 문구 대신).
  const [basis, setBasis] = useState<string | null>(null);

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 저장할 수 없습니다'
      : isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';
  const canOpen = !guardReason;

  const isDefault = form.method === 'DEFAULT';
  const outputNum = Number(form.outputT);
  const directNum = form.attributedDirectTco2.trim() === '' ? 0 : Number(form.attributedDirectTco2);
  const elecNum = form.elecMwh.trim() === '' ? 0 : Number(form.elecMwh);
  const embeddedNum = form.embeddedTco2.trim() === '' ? 0 : Number(form.embeddedTco2);
  const err = {
    name: form.name.trim() === '' ? '제품명을 입력하세요' : '',
    hsCode: !/^\d+$/.test(form.hsCode.trim()) ? 'HS 코드(숫자)를 입력하세요' : '',
    outputT:
      form.outputT.trim() === '' || !Number.isFinite(outputNum) || outputNum <= 0 ? '생산량은 0보다 커야 합니다' : '',
    attributedDirectTco2:
      isDefault && form.attributedDirectTco2.trim() !== '' && (!Number.isFinite(directNum) || directNum < 0)
        ? '0 이상의 수를 입력하세요'
        : '',
    elecMwh:
      isDefault && form.elecMwh.trim() !== '' && (!Number.isFinite(elecNum) || elecNum < 0)
        ? '0 이상의 수를 입력하세요'
        : '',
    embeddedTco2:
      !isDefault && form.embeddedTco2.trim() !== '' && (!Number.isFinite(embeddedNum) || embeddedNum < 0)
        ? '0 이상의 수를 입력하세요'
        : '',
  };
  const valid =
    !err.name && !err.hsCode && !err.outputT && !err.attributedDirectTco2 && !err.elecMwh && !err.embeddedTco2;

  // §1.4 인터랙션 — DEFAULT 시 직접배출·전력·생산량 변경 후 debounce 로 서버 estimate 호출 → 내재배출 자동 채움.
  const estimateMutate = estimate.mutateAsync;
  useEffect(() => {
    if (!open || !isDefault || err.outputT || err.attributedDirectTco2 || err.elecMwh) return;
    const t = setTimeout(() => {
      estimateMutate({ companyId, outputT: outputNum, attributedDirectTco2: directNum, elecMwh: elecNum })
        .then((res) => {
          setBasis(res.basis);
          setForm((f) => ({ ...f, embeddedTco2: String(res.embeddedTco2) }));
        })
        .catch(() => setBasis(null));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isDefault, form.outputT, form.attributedDirectTco2, form.elecMwh]);

  async function save() {
    if (!valid || companyId == null) return;
    setFeedback(null);
    try {
      await create.mutateAsync({
        companyId,
        name: form.name.trim(),
        hsCode: form.hsCode.trim(),
        outputT: outputNum,
        embeddedTco2: embeddedNum,
        method: form.method,
        euStatus: form.euStatus,
        // DEFAULT 이면 서버가 재산정·대체(조작 방지) — 원천 입력 전달. MEASURED 는 미전달.
        attributedDirectTco2: isDefault ? directNum : undefined,
        elecMwh: isDefault ? elecNum : undefined,
      });
      setOpen(false);
      setForm({
        name: '',
        hsCode: '',
        outputT: '',
        embeddedTco2: '',
        method: 'MEASURED',
        euStatus: 'READY',
        attributedDirectTco2: '',
        elecMwh: '',
      });
      setBasis(null);
      setFeedback({ kind: 'ok', msg: 'CBAM 제품을 등록했습니다.' });
    } catch {
      setFeedback({ kind: 'err', msg: 'CBAM 제품 등록 중 오류가 발생했습니다.' });
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '온실가스 인벤토리', path: '/e-data/inventory' }, { label: 'CBAM 제품배출' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">CBAM 제품 내재배출량</h1>
        <div className="flex items-center gap-2">
          <Badge variant="info">EU 탄소국경조정제도</Badge>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setOpen(true)}
            disabled={!canOpen}
            title={guardReason || undefined}
          >
            <Plus size={15} /> 제품 추가
          </Button>
        </div>
      </div>
      {guardReason && <p className="text-xs text-amber-400">저장 불가: {guardReason}</p>}
      {feedback && (
        <p className={`text-xs ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</p>
      )}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
              <th className="px-4 py-3">제품</th>
              <th className="px-4 py-3">HS 코드</th>
              <th className="px-4 py-3 text-right">생산량 (t)</th>
              <th className="px-4 py-3 text-right">내재배출 (tCO₂/t)</th>
              <th className="px-4 py-3">산정법</th>
              <th className="px-4 py-3">EU 신고</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((p) => (
              <tr key={p.hs} className="border-b border-white/[0.04] text-slate-300">
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.hs}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.output.toLocaleString()}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.embedded}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.method === '실측' ? 'success' : 'default'}>{p.method}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={euBadge(p.eu)}>{p.eu}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-slate-500">
        CBAM 대상 6개 업종(철강·알루미늄·시멘트·비료·전력·수소). Scope 1·2 배출량을 제품에 배분해 내재배출량을 산정하며,
        전환기 분기 보고 서식은 규제 변동에 대응하도록 config화한다.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="CBAM 제품 등록"
        footer={
          <>
            <Button variant="cancel" size="sm" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button variant="primary" size="sm" onClick={save} disabled={!valid} loading={create.isPending}>
              저장
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <label className={labelCls}>
            제품명
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {err.name && <span className="mt-1 block text-xs text-red-400">{err.name}</span>}
          </label>
          <label className={labelCls}>
            HS 코드
            <input
              className={inputCls}
              value={form.hsCode}
              onChange={(e) => setForm({ ...form, hsCode: e.target.value })}
              placeholder="7208"
            />
            {err.hsCode && <span className="mt-1 block text-xs text-red-400">{err.hsCode}</span>}
          </label>
          <label className={labelCls}>
            생산량 (t)
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.001"
              value={form.outputT}
              onChange={(e) => setForm({ ...form, outputT: e.target.value })}
            />
            {err.outputT && <span className="mt-1 block text-xs text-red-400">{err.outputT}</span>}
          </label>
          {isDefault && (
            <>
              <label className={labelCls}>
                귀속 직접배출 (tCO₂)
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step="0.0001"
                  value={form.attributedDirectTco2}
                  onChange={(e) => setForm({ ...form, attributedDirectTco2: e.target.value })}
                />
                {err.attributedDirectTco2 && (
                  <span className="mt-1 block text-xs text-red-400">{err.attributedDirectTco2}</span>
                )}
              </label>
              <label className={labelCls}>
                소비전력 (MWh)
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  step="0.001"
                  value={form.elecMwh}
                  onChange={(e) => setForm({ ...form, elecMwh: e.target.value })}
                />
                {err.elecMwh && <span className="mt-1 block text-xs text-red-400">{err.elecMwh}</span>}
              </label>
            </>
          )}
          <label className={labelCls}>
            내재배출 (tCO₂/t){isDefault ? ' · 서버 제안(자동)' : ''}
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.0001"
              value={form.embeddedTco2}
              readOnly={isDefault}
              onChange={(e) => setForm({ ...form, embeddedTco2: e.target.value })}
            />
            {err.embeddedTco2 && <span className="mt-1 block text-xs text-red-400">{err.embeddedTco2}</span>}
          </label>
          <label className={labelCls}>
            산정법
            <select
              className={inputCls}
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value as CbamReq['method'] })}
            >
              <option value="MEASURED">실측 (MEASURED)</option>
              <option value="DEFAULT">기본값 (DEFAULT)</option>
            </select>
          </label>
          <label className={labelCls}>
            EU 신고
            <select
              className={inputCls}
              value={form.euStatus}
              onChange={(e) => setForm({ ...form, euStatus: e.target.value as CbamReq['euStatus'] })}
            >
              <option value="READY">대상·준비</option>
              <option value="NOT_READY">대상·미준비</option>
              <option value="NA">미대상</option>
            </select>
          </label>
        </div>
        {isDefault && (
          <p className="mt-3 text-xs text-slate-500">
            {basis
              ? `서버 산정 근거 — ${basis}`
              : `기본값 산정: 내재배출(tCO₂/t) = (귀속 직접배출 + 소비전력 × 전력계수 ${ELEC_FACTOR}) ÷ 생산량. 서버가 재산정한 제안값을 사용합니다 (기획 14 §1).`}
          </p>
        )}
      </Modal>
    </div>
  );
}
