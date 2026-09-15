'use client';

/* 전력거래 통합 거래 상세 — 컨설팅 status/[id] 패턴.
 * 발전사·수용가·SPC가 한 화면에서 같은 진행바를 보고 자기 차례에만 액션한다. */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Handshake,
  Zap,
  Factory,
  Sun,
  FileSignature,
  ArrowRight,
  FileText,
  Upload,
  Download,
} from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { SectionCard } from '@/components/features';
import { useCompany } from '@/hooks/platform/useCompanies';
import { TradingChatPanel, type ChatThread } from '@/components/features/TradingChatPanel';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useToastStore } from '@/stores/useToastStore';
import { getPersona } from '@/lib/persona';
import {
  useTradingRequest,
  useTradingMatches,
  useTradingRequests,
  useCreateMatch,
  useGeneratorAcceptMatch,
  useAcceptMatch,
  useDeclineMatch,
  useCounterMatch,
  useUpdateRequestStatus,
  useLeaseProposal,
  useCreateLeaseProposal,
  useAgreeLeaseProposal,
} from '@/hooks/trading/useTrading';
import { useAvailableEquipments } from '@/hooks/lease/useLease';
import {
  usePpaContracts,
  useActivatePpaContract,
  useContractDocuments,
  useAddContractDocument,
} from '@/hooks/ppa/usePpa';
import { ContractSignature } from '@/components/features/ContractSignature';
import { useSignatureStatus, useSignContract } from '@/hooks/useContractSignature';
import { FileUpload } from '@/components/ui/FileUpload';
import { uploadFile, getViewUrl, getDownloadUrl } from '@/api/common/files';

const DEAL_LABEL: Record<string, string> = {
  PPA: '직접 PPA',
  SAVINGS_SHARE: '온사이트 PPA',
};
const DEAD_MATCH = ['DECLINED', 'EXPIRED', 'SUPERSEDED'];

const MATCH_BADGE: Record<string, { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'default' }> = {
  PROPOSED: { label: '발전사 수락 대기', variant: 'warning' },
  GEN_ACCEPTED: { label: '수용가 수락 대기', variant: 'info' },
  ACCEPTED: { label: '수락 완료', variant: 'success' },
  DECLINED: { label: '거절', variant: 'danger' },
  EXPIRED: { label: '만료', variant: 'default' },
  SUPERSEDED: { label: '대체됨', variant: 'default' },
};

export default function TradingDealPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params?.id);
  const user = useAuthStore((s) => s.user);
  const persona = getPersona(user);
  const isSpc = persona === 'spc' || persona === 'admin';
  const isGenerator = persona === 'generator';
  const isConsumer = persona === 'consumer' || persona === 'consultant';
  const myCompanyId = user?.companyId;
  const showToast = useToastStore((s) => s.add);

  const { data: request, isLoading } = useTradingRequest(id);
  const { data: matchesRaw, isLoading: matchesLoading } = useTradingMatches(id);
  const matches: any[] = Array.isArray(matchesRaw) ? matchesRaw : ((matchesRaw as any)?.content ?? []);
  const activeMatches = matches.filter((m) => !DEAD_MATCH.includes(m.status));

  // SPC 매칭용 발전사 후보 (승인/매칭풀 + 아직 이 거래에 매칭 안 된 회사)
  const { data: genData } = useTradingRequests({ requesterType: 'GENERATOR' });
  const genPool = useMemo(() => {
    const rows = ((genData as any)?.content ?? genData ?? []) as any[];
    const matchedCompanyIds = new Set(activeMatches.map((m) => m.generatorCompanyId));
    const seen = new Set<number>();
    return rows
      .filter((g) => (g.status === 'APPROVED' || g.status === 'MATCHING') && !matchedCompanyIds.has(g.companyId))
      .filter((g) => {
        if (seen.has(g.companyId)) return false;
        seen.add(g.companyId);
        return true;
      })
      .map((g) => ({
        companyId: g.companyId,
        companyName: g.companyName,
        plantName: g.plantName,
        capacityKw: g.capacityKw,
        desiredUnitPrice: g.desiredUnitPrice,
        region: g.region,
      }));
  }, [genData, activeMatches]);

  const createMatchMut = useCreateMatch();
  const genAcceptMut = useGeneratorAcceptMatch();
  const acceptMut = useAcceptMatch();
  const declineMut = useDeclineMatch();
  const counterMut = useCounterMatch();
  const updateStatusMut = useUpdateRequestStatus();
  const createLeaseProposalMut = useCreateLeaseProposal();
  const agreeLeaseProposalMut = useAgreeLeaseProposal();
  // 계약 전자서명 — 매칭 확정 시 자동 생성된 계약(AUTO-M{matchId}/AUTO-L{proposalId})을 진행 스텝 안에서 양측 서명·활성화
  const { data: ppaContractsData } = usePpaContracts();
  const [signOpen, setSignOpen] = useState(false);
  const { data: leaseProposalData } = useLeaseProposal(id, {
    enabled: (request as any)?.dealType === 'SAVINGS_SHARE',
  });
  // 발전사 역제안 (새 단가 제시)
  const [counterTarget, setCounterTarget] = useState<{ id: number; price: number } | null>(null);
  const [counterPrice, setCounterPrice] = useState('');
  const submitCounter = async () => {
    if (!counterTarget || !counterPrice) return;
    try {
      await counterMut.mutateAsync({ id: counterTarget.id, proposedPriceKrw: Number(counterPrice) });
      showToast('success', '역제안을 보냈습니다 — 수용가 확인 대기');
      setCounterTarget(null);
      setCounterPrice('');
    } catch {
      showToast('error', '역제안 처리에 실패했습니다');
    }
  };

  const [selGen, setSelGen] = useState('');
  const [proposePrice, setProposePrice] = useState('');
  // 거절 사유 입력 (역제안 협상의 1차 — 사유로 희망 조건 전달)
  const [declineTarget, setDeclineTarget] = useState<{ id: number; by: string } | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const submitDecline = async () => {
    if (!declineTarget) return;
    try {
      await declineMut.mutateAsync({
        id: declineTarget.id,
        declinedBy: declineTarget.by,
        declineReason: declineReason || undefined,
      });
      showToast('warning', '매칭을 거절했습니다');
      setDeclineTarget(null);
      setDeclineReason('');
    } catch {
      showToast('error', '거절 처리에 실패했습니다');
    }
  };

  // ── 직접 PPA — SPC 제안서 작성 (부지평가 결과 = 예상 절감액, 설비 선택 → 셰어율) ──
  const { data: apiEquipments } = useAvailableEquipments();
  const leaseEquipment = useMemo(() => {
    const raw = (apiEquipments as any[]) ?? [];
    return raw.map((e: any) => ({
      id: String(e.id),
      generatorCompanyId: e.generatorCompanyId,
      generator: e.generatorCompanyName ?? '발전사',
      kind: e.equipmentType ?? '태양광 모듈',
      model: e.equipmentName ?? '',
      sharePct: e.sharePct ?? 30,
    }));
  }, [apiEquipments]);
  // Lease 배정 발전사 후보 = PPA 설비를 등록한 발전사 (PPA 공급신청 genPool 아님)
  const leaseGenPool = useMemo(() => {
    const seen = new Map<number, { companyId: number; companyName: string; count: number }>();
    for (const eq of leaseEquipment) {
      if (eq.generatorCompanyId == null) continue;
      const cur = seen.get(eq.generatorCompanyId);
      if (cur) cur.count += 1;
      else seen.set(eq.generatorCompanyId, { companyId: eq.generatorCompanyId, companyName: eq.generator, count: 1 });
    }
    return [...seen.values()];
  }, [leaseEquipment]);
  const [leaseStep, setLeaseStep] = useState<1 | 2>(1);
  const [leaseGenId, setLeaseGenId] = useState('');
  const [leaseForm, setLeaseForm] = useState({
    equipIds: [] as string[],
    assignedGenerator: '',
    installCapacityKw: '',
    estSavingsPerMonth: '',
    sharePct: 30,
    contractYears: '15',
  });
  // 설비 토글 — 발전사는 Select가 결정, 여기선 설비 선택과 희망 분배율만 반영
  const toggleLeaseEquip = (eid: string) =>
    setLeaseForm((f) => {
      const has = f.equipIds.includes(eid);
      const nextIds = has ? f.equipIds.filter((x) => x !== eid) : [...f.equipIds, eid];
      const firstEq = leaseEquipment.find((e) => e.id === nextIds[0]);
      return { ...f, equipIds: nextIds, sharePct: firstEq ? firstEq.sharePct : f.sharePct };
    });
  const leasePreview = useMemo(() => {
    const saved = Number(leaseForm.estSavingsPerMonth) || 0;
    const share = Math.round((saved * leaseForm.sharePct) / 100);
    return { saved, share, net: saved - share };
  }, [leaseForm.estSavingsPerMonth, leaseForm.sharePct]);
  // 부지평가(설치 용량 + 예상 절감액)만 step1 필수
  const leaseEvalValid = Number(leaseForm.installCapacityKw) > 0 && Number(leaseForm.estSavingsPerMonth) > 0;
  // 제안 제출 — Lease는 배정 발전사가 먼저 정의되어야 함 (단일 발전사)
  const leaseValid = leaseEvalValid && !!leaseForm.assignedGenerator;
  const submitLeaseProposal = async () => {
    // 제안서 작성 → 백엔드 저장(설비·분배율·절감액) + 요청 상태 MATCHING
    try {
      await createLeaseProposalMut.mutateAsync({
        requestId: id,
        data: {
          generatorCompanyId: Number(leaseGenId),
          generatorCompanyName: leaseForm.assignedGenerator || undefined,
          installCapacityKw: leaseForm.installCapacityKw ? Number(leaseForm.installCapacityKw) : undefined,
          estSavingsPerMonth: leaseForm.estSavingsPerMonth ? Number(leaseForm.estSavingsPerMonth) : undefined,
          sharePct: leaseForm.sharePct,
          contractYears: leaseForm.contractYears ? Number(leaseForm.contractYears) : undefined,
          equipIds: leaseForm.equipIds.map(Number),
        },
      });
      showToast('success', '제안서가 작성되었습니다 — 발전사·수용가 합의 단계로 이동합니다');
      setLeaseStep(1);
      setLeaseGenId('');
      setLeaseForm({
        equipIds: [],
        assignedGenerator: '',
        installCapacityKw: '',
        estSavingsPerMonth: '',
        sharePct: 30,
        contractYears: '15',
      });
    } catch {
      showToast('error', '제안서 작성에 실패했습니다');
    }
  };

  // ── 양측 당사자 연락처 (SPC 조율용) — early return 전에 회사 조회 ──
  const reqForParties = request as any;
  const consumerCompanyId = reqForParties?.companyId ?? 0;
  const acceptedMatchForParties = activeMatches.find((m) => m.status === 'ACCEPTED');
  const generatorCompanyId =
    reqForParties?.dealType === 'SAVINGS_SHARE'
      ? (leaseProposalData?.generatorCompanyId ?? 0)
      : (acceptedMatchForParties?.generatorCompanyId ?? activeMatches[0]?.generatorCompanyId ?? 0);
  const { data: consumerCompany } = useCompany(consumerCompanyId);
  const { data: generatorCompany } = useCompany(generatorCompanyId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }
  if (!request) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '거래 상세' }]} />
        <p className="text-sm text-slate-400">거래를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const r: any = request;

  // ── 접근 가드 — 수용가 본인 / 매칭(PPA)·배정(Lease) 발전사 / SPC·관리자만 열람 ──
  const canView =
    isSpc ||
    (isConsumer && r.companyId === myCompanyId) ||
    (isGenerator &&
      (matchesLoading ||
        matches.some((m) => m.generatorCompanyId === myCompanyId) ||
        leaseProposalData?.generatorCompanyId === myCompanyId));
  if (!canView) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '거래 상세' }]} />
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ChevronLeft size={14} className="mr-1" /> 목록으로
        </Button>
        <div className="rounded-xl bg-surface-card ring-1 ring-white/[0.08] p-8 text-center">
          <p className="text-sm text-slate-300">이 거래에 대한 접근 권한이 없습니다.</p>
          <p className="text-xs text-slate-500 mt-1">본인 거래이거나 매칭된 당사자만 열람할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  const dealLabel =
    DEAL_LABEL[r.dealType] === '직접 PPA' && r.ppaSubType
      ? `${r.ppaSubType === 'onsite' ? 'Onsite' : 'Offsite'} PPA`
      : (DEAL_LABEL[r.dealType] ?? r.dealType);

  const isLease = r.dealType === 'SAVINGS_SHARE';
  const isOnsite = r.dealType === 'PPA' && r.ppaSubType === 'onsite';
  // Onsite PPA는 한전 망 미사용 → 수용가 부지와 같은 지역(인접) 발전사만 매칭 후보
  const eligibleGenPool = isOnsite && r.region ? genPool.filter((g) => g.region === r.region) : genPool;

  // ── 진행 단계 파생 ──
  const hasMatch = activeMatches.length > 0;
  const genAccepted = activeMatches.some((m) => ['GEN_ACCEPTED', 'ACCEPTED'].includes(m.status));
  const consAccepted = activeMatches.some((m) => m.status === 'ACCEPTED') || r.status === 'MATCHED';
  // Lease 전용 파생 — 제안서 작성(SUBMITTED 이탈) → 합의(MATCHED) → 체결
  const leaseProposed = r.status !== 'SUBMITTED';
  const leaseAgreed = r.status === 'MATCHED' || r.status === 'FINALIZED';

  // ── 진행 스텝 안의 전자서명 — 매칭/합의 확정 시 백엔드가 자동 생성한 계약을 찾아 양측 서명 → 활성화 ──
  const acceptedMatch = activeMatches.find((m) => m.status === 'ACCEPTED');
  const contractNumber = isLease
    ? leaseProposalData?.id
      ? `AUTO-L${leaseProposalData.id}`
      : null
    : acceptedMatch
      ? `AUTO-M${acceptedMatch.id}`
      : null;
  const ppaContractRows: any[] = ((ppaContractsData as any)?.content ?? ppaContractsData ?? []) as any[];
  const myContract = contractNumber ? (ppaContractRows.find((c) => c.contractNumber === contractNumber) ?? null) : null;
  // 계약 발효(양측 서명 완료) 여부 — 진행 스텝 'done' 판정의 기준
  const contractActive = myContract?.status === 'ACTIVE';
  const signUnitPrice = acceptedMatch?.proposedPriceKrw ?? r.desiredUnitPrice ?? 0;
  const contractsHref = isGenerator ? '/generator/ppa/contracts' : '/ppa/contracts';
  const openSign = () => setSignOpen(true);
  // 제안 내용 요약 — 발전사·수용가가 합의 전 검토하는 카드
  const lp = leaseProposalData;
  const lpSaved = Number(lp?.estSavingsPerMonth ?? 0);
  const lpShare = Math.round((lpSaved * (lp?.sharePct ?? 0)) / 100);
  const leaseReview = lp ? (
    <div className="rounded-lg ring-1 ring-violet-500/30 bg-violet-500/[0.05] px-4 py-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      <div>
        <span className="text-slate-500">배정 발전사 </span>
        <span className="text-white">{lp.generatorCompanyName ?? '—'}</span>
      </div>
      <div>
        <span className="text-slate-500">설치 용량 </span>
        <span className="text-white tabular-nums">{(lp.installCapacityKw ?? 0).toLocaleString()} kW</span>
      </div>
      <div>
        <span className="text-slate-500">예상 월 절감액 </span>
        <span className="text-white tabular-nums">{lpSaved ? `₩${lpSaved.toLocaleString()}` : '—'}</span>
      </div>
      <div>
        <span className="text-slate-500">발전사 분배율 </span>
        <span className="text-emerald-300 tabular-nums">{lp.sharePct ?? 0}%</span>
      </div>
      <div>
        <span className="text-slate-500">계약 기간 </span>
        <span className="text-white">{lp.contractYears ?? '—'}년</span>
      </div>
      {lpSaved > 0 && (
        <div className="col-span-2 text-[11px] text-slate-400 pt-1 border-t border-white/[0.06]">
          월 절감 ₩{lpSaved.toLocaleString()} → 발전사 ₩{lpShare.toLocaleString()} / 수용가 ₩
          {(lpSaved - lpShare).toLocaleString()}
        </div>
      )}
    </div>
  ) : null;
  // 거래유형별 스텝 (Offsite PPA / Onsite PPA / 직접 PPA)
  // '계약 체결' 단계는 매칭이 아니라 "양측 전자서명 → 계약 발효(ACTIVE)"일 때만 완료 처리
  const steps = isLease
    ? [
        { label: '신청 접수', done: true },
        { label: '제안서 작성', done: leaseProposed },
        { label: '발전사·수용가 합의', done: leaseAgreed },
        { label: '계약 체결', done: contractActive },
      ]
    : [
        { label: '신청 접수', done: true },
        { label: isOnsite ? '부지 실사·매칭' : '매칭 제안', done: hasMatch },
        { label: '발전사 수락', done: genAccepted },
        { label: '수용가 수락', done: consAccepted },
        { label: '계약 체결', done: contractActive },
      ];
  const currentIdx = steps.findIndex((s) => !s.done);

  // ── 공이 누구에게 ── (매칭/합의 후엔 양측 서명이 끝나야 '완료')
  const ball = isLease
    ? contractActive
      ? { who: '완료', desc: '양측 전자서명이 완료되어 계약이 발효되었습니다' }
      : leaseAgreed
        ? { who: '양사', desc: '제안에 합의됐습니다 — 계약서에 양측이 전자서명하면 계약이 발효됩니다' }
        : leaseProposed
          ? { who: '양사', desc: 'SPC 제안서가 작성되었습니다 — 발전사·수용가의 합의를 기다리는 중' }
          : { who: 'SPC', desc: 'SPC가 부지·시설 평가 후 제안서를 작성해야 합니다' }
    : contractActive
      ? { who: '완료', desc: '양측 전자서명이 완료되어 계약이 발효되었습니다' }
      : consAccepted
        ? { who: '양사', desc: '매칭이 확정됐습니다 — 계약서에 양측이 전자서명하면 계약이 발효됩니다' }
        : activeMatches.some((m) => m.status === 'GEN_ACCEPTED')
          ? { who: '수용가', desc: '발전사가 수락했습니다 — 수용가의 최종 수락을 기다리는 중' }
          : activeMatches.some((m) => m.status === 'PROPOSED')
            ? { who: '발전사', desc: '매칭이 제안되었습니다 — 발전사의 수락을 기다리는 중' }
            : {
                who: 'SPC',
                desc: isOnsite ? 'SPC가 부지 실사 후 인접 발전사를 매칭해야 합니다' : 'SPC가 발전사를 매칭해야 합니다',
              };

  // ── 채팅 스레드 (SPC 허브형) ──
  const chatThreads: ChatThread[] = (() => {
    if (isSpc) {
      const out: ChatThread[] = [];
      if (r.companyId) out.push({ counterpartyCompanyId: r.companyId, label: `수용가 ${r.companyName ?? ''}`.trim() });
      const seen = new Set<number>();
      for (const m of activeMatches) {
        if (m.generatorCompanyId && !seen.has(m.generatorCompanyId)) {
          seen.add(m.generatorCompanyId);
          out.push({
            counterpartyCompanyId: m.generatorCompanyId,
            label: `발전사 ${m.generatorCompanyName ?? ''}`.trim(),
          });
        }
      }
      return out;
    }
    if (isConsumer && r.companyId) return [{ counterpartyCompanyId: r.companyId, label: 'SPC 협의' }];
    if (isGenerator && myCompanyId) return [{ counterpartyCompanyId: myCompanyId, label: 'SPC 협의' }];
    return [];
  })();

  const proposeMatch = async () => {
    const g = genPool.find((x) => String(x.companyId) === selGen);
    if (!g) return;
    try {
      await createMatchMut.mutateAsync({
        requestId: id,
        generatorCompanyId: g.companyId,
        plantName: g.plantName || g.companyName,
        capacityKw: g.capacityKw,
        proposedPriceKrw: proposePrice ? Number(proposePrice) : (g.desiredUnitPrice ?? r.desiredUnitPrice ?? 0),
      } as any);
      showToast('success', `${g.companyName}에 매칭을 제안했습니다`);
      setSelGen('');
      setProposePrice('');
    } catch {
      showToast('error', '매칭 제안에 실패했습니다');
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '전력거래', path: '/ppa/trading' }, { label: '거래 상세' }]} />

      <Button variant="ghost" size="sm" onClick={() => router.back()}>
        <ChevronLeft size={14} className="mr-1" /> 목록으로
      </Button>

      {/* 2컬럼 — 좌: 헤더+진행 허브 / 우: 멀티 채팅 */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* 헤더 */}
          <div className="rounded-xl bg-surface-card ring-1 ring-white/[0.08] p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-white">거래 #{r.id}</h1>
                  <Badge variant="primary">{dealLabel}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {r.companyName ?? '—'} · {(r.capacityKw ?? 0).toLocaleString()} kW · {r.durationYears ?? '—'}년
                  {r.region ? ` · ${r.region}` : ''}
                </p>
              </div>
              <div
                className={cn(
                  'rounded-lg px-3 py-2 ring-1 text-sm',
                  ball.who === '완료'
                    ? 'bg-emerald-500/[0.08] ring-emerald-500/30 text-emerald-300'
                    : 'bg-blue-500/[0.08] ring-blue-500/30 text-blue-300',
                )}
              >
                지금: <span className="font-semibold">{ball.who}</span> 차례
              </div>
            </div>

            {/* 진행 스텝퍼 */}
            <div className="mt-5 flex items-center">
              {steps.map((s, i) => {
                const state = s.done ? 'done' : i === currentIdx ? 'current' : 'upcoming';
                return (
                  <div key={s.label} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full ring-1 text-[11px] font-bold',
                          state === 'done'
                            ? 'bg-primary text-white ring-primary'
                            : state === 'current'
                              ? 'bg-primary/20 text-primary ring-primary/50'
                              : 'bg-white/[0.04] text-slate-500 ring-white/[0.1]',
                        )}
                      >
                        {state === 'done' ? <CheckCircle2 size={14} /> : i + 1}
                      </span>
                      <span
                        className={cn('mt-1 text-[11px]', state === 'upcoming' ? 'text-slate-500' : 'text-slate-300')}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={cn('h-px flex-1 mx-1', s.done ? 'bg-primary/50' : 'bg-white/[0.08]')} />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">{ball.desc}</p>
          </div>

          {/* 내 액션 (역할별 · 거래유형별) */}
          <SectionCard title="내 액션">
            {isLease ? (
              <div className="space-y-3">
                {leaseAgreed ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 px-4 py-3">
                    <p className="text-sm text-emerald-300">
                      {contractActive
                        ? '양측 전자서명이 완료되어 계약이 발효되었습니다.'
                        : '제안에 합의됐습니다 — 계약서에 양측이 전자서명하면 계약이 발효됩니다.'}
                    </p>
                    {isSpc ? (
                      <Button variant="primary" size="sm" onClick={openSign}>
                        <FileSignature size={14} className="mr-1.5" />
                        {contractActive ? '계약서 보기' : '계약서 등록·발행'}
                      </Button>
                    ) : (
                      <Button variant="primary" size="sm" onClick={openSign}>
                        <FileSignature size={14} className="mr-1.5" />
                        {contractActive ? '서명 내역 보기' : '계약서 확인·전자서명'}
                      </Button>
                    )}
                  </div>
                ) : isSpc ? (
                  leaseProposed ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 rounded-lg bg-blue-500/[0.06] ring-1 ring-blue-500/20 px-4 py-3">
                        <Clock size={18} className="text-blue-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-300">제안서 작성 완료 — 합의 대기</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            양측이 모두 합의하면 계약 체결 단계로 진행됩니다.
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <span
                          className={cn(
                            'flex-1 rounded-lg ring-1 px-3 py-2 text-xs',
                            leaseProposalData?.genAgreed
                              ? 'bg-emerald-500/[0.08] ring-emerald-500/30 text-emerald-300'
                              : 'ring-white/[0.06] bg-white/[0.02] text-slate-400',
                          )}
                        >
                          {leaseProposalData?.genAgreed ? '✓ ' : '○ '}발전사 합의
                        </span>
                        <span
                          className={cn(
                            'flex-1 rounded-lg ring-1 px-3 py-2 text-xs',
                            leaseProposalData?.consumerAgreed
                              ? 'bg-emerald-500/[0.08] ring-emerald-500/30 text-emerald-300'
                              : 'ring-white/[0.06] bg-white/[0.02] text-slate-400',
                          )}
                        >
                          {leaseProposalData?.consumerAgreed ? '✓ ' : '○ '}수용가 합의
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 font-medium',
                            leaseStep === 1 ? 'bg-primary/15 text-primary' : 'bg-white/[0.04]',
                          )}
                        >
                          ① 부지·시설 평가
                        </span>
                        <ChevronRight size={12} className="text-slate-600" />
                        <span
                          className={cn(
                            'rounded px-2 py-0.5 font-medium',
                            leaseStep === 2 ? 'bg-primary/15 text-primary' : 'bg-white/[0.04]',
                          )}
                        >
                          ② 설비·셰어 (제안서)
                        </span>
                      </div>

                      {leaseStep === 1 ? (
                        <div className="space-y-3">
                          <p className="text-xs text-slate-400">
                            현장 실사 결과를 입력하세요 — 설치 가능 용량과 예상 월 절감액을 산정합니다. (다음 단계에서
                            설비·분배율 제안)
                          </p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-accent mb-1.5">설치 가능 용량 (kW) *</label>
                              <Input
                                type="number"
                                placeholder={String(r.capacityKw ?? '')}
                                value={leaseForm.installCapacityKw}
                                onChange={(e) => setLeaseForm({ ...leaseForm, installCapacityKw: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-accent mb-1.5">
                                예상 월 절감액 (₩) · 부지평가 *
                              </label>
                              <Input
                                type="number"
                                placeholder="예: 6000000"
                                value={leaseForm.estSavingsPerMonth}
                                onChange={(e) => setLeaseForm({ ...leaseForm, estSavingsPerMonth: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-accent mb-1.5">계약 기간 (년)</label>
                              <Input
                                type="number"
                                value={leaseForm.contractYears}
                                onChange={(e) => setLeaseForm({ ...leaseForm, contractYears: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={!leaseEvalValid}
                              onClick={() => setLeaseStep(2)}
                            >
                              다음 — 설비·셰어 <ChevronRight size={14} className="ml-1" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="rounded-lg ring-1 ring-violet-500/30 bg-violet-500/[0.05] px-3 py-2 text-[11px] text-violet-200">
                            부지평가: 용량 {Number(leaseForm.installCapacityKw).toLocaleString()}kW · 예상 절감 ₩
                            {Number(leaseForm.estSavingsPerMonth).toLocaleString()}/월
                          </div>

                          {/* ① 배정 발전사 선택 — PPA 설비를 등록한 발전사 중에서 (Lease는 단일 발전사) */}
                          <div>
                            <label className="block text-xs text-accent mb-1.5">
                              ① 배정 발전사 * <span className="text-slate-600">(PPA 설비 등록 발전사)</span>
                            </label>
                            <Select
                              placeholder={
                                leaseGenPool.length ? 'PPA 설비 등록 발전사 선택' : '등록된 PPA 설비가 없습니다'
                              }
                              value={leaseGenId}
                              onChange={(e) => {
                                const gid = e.target.value;
                                const g = leaseGenPool.find((x) => String(x.companyId) === gid);
                                setLeaseGenId(gid);
                                setLeaseForm((f) => ({ ...f, assignedGenerator: g?.companyName ?? '', equipIds: [] }));
                              }}
                              options={leaseGenPool.map((g) => ({
                                value: String(g.companyId),
                                label: `${g.companyName} · PPA 설비 ${g.count}건`,
                              }))}
                            />
                            {leaseGenPool.length === 0 && (
                              <p className="mt-1.5 text-[11px] text-amber-300">
                                배정 가능한 발전사가 없습니다 — 발전사가 자원 관리에서 PPA 설비를 등록해야 배정할 수
                                있습니다.
                              </p>
                            )}
                          </div>

                          {/* ② 선택 발전사의 설치 설비 — 발전사 확정 후 노출 */}
                          {leaseGenId &&
                            (() => {
                              const genEquip = leaseEquipment.filter(
                                (eq) => String(eq.generatorCompanyId) === leaseGenId,
                              );
                              return (
                                <div>
                                  <p className="text-xs text-slate-400 mb-1.5">
                                    ② {leaseForm.assignedGenerator} 설치 설비{' '}
                                    <span className="text-slate-600">(등록 설비 — 선택)</span>
                                  </p>
                                  {genEquip.length === 0 ? (
                                    <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-3 py-3 text-xs text-slate-400">
                                      이 발전사의 등록 PPA 설비가 없습니다 — 설비 사양은 계약 단계에서 확정합니다.
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                                      {genEquip.map((eq) => {
                                        const selected = leaseForm.equipIds.includes(eq.id);
                                        return (
                                          <button
                                            key={eq.id}
                                            type="button"
                                            onClick={() => toggleLeaseEquip(eq.id)}
                                            className={cn(
                                              'flex items-start gap-2 rounded-lg ring-1 px-3 py-2.5 text-left transition-all',
                                              selected
                                                ? 'bg-violet-500/[0.08] ring-violet-400/50'
                                                : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.16]',
                                            )}
                                          >
                                            <Sun size={16} className="text-slate-500 mt-0.5 shrink-0" />
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] text-slate-400 truncate">{eq.kind}</span>
                                                {selected && (
                                                  <CheckCircle2 size={14} className="text-violet-300 shrink-0" />
                                                )}
                                              </div>
                                              <p className="text-sm text-white font-medium truncate">
                                                {eq.model || eq.kind}
                                              </p>
                                              <p className="text-[11px] text-emerald-300 tabular-nums">
                                                희망 분배율 {eq.sharePct}%
                                              </p>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                          <div>
                            <label className="block text-xs text-accent mb-1.5">
                              발전사 분배율 ({leaseForm.sharePct}%)
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={leaseForm.sharePct}
                              onChange={(e) => setLeaseForm({ ...leaseForm, sharePct: Number(e.target.value) })}
                              className="w-full accent-primary"
                            />
                          </div>
                          {leasePreview.saved > 0 && (
                            <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-slate-300">
                              월 절감 ₩{leasePreview.saved.toLocaleString()} → 발전사 ₩
                              {leasePreview.share.toLocaleString()} / 수용가 ₩{leasePreview.net.toLocaleString()}
                            </div>
                          )}
                          <div className="flex justify-between">
                            <Button variant="ghost" size="sm" onClick={() => setLeaseStep(1)}>
                              <ChevronLeft size={14} className="mr-1" /> 이전
                            </Button>
                            <Button variant="primary" size="sm" disabled={!leaseValid} onClick={submitLeaseProposal}>
                              <Send size={14} className="mr-1.5" /> 제안서 제출
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                ) : isGenerator ? (
                  !leaseProposed ? (
                    <p className="text-sm text-slate-400">SPC의 제안서 작성을 기다리는 중입니다.</p>
                  ) : leaseProposalData?.genAgreed ? (
                    <p className="text-sm text-emerald-300">합의 완료 — 수용가 합의를 기다리는 중입니다.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-200">
                        제안서가 도착했습니다 — 아래 배정·분배 조건을 확인하고 합의하세요.
                      </p>
                      {leaseReview}
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={agreeLeaseProposalMut.isPending}
                          onClick={async () => {
                            try {
                              await agreeLeaseProposalMut.mutateAsync({ requestId: id, party: 'generator' });
                              showToast('success', '제안에 합의했습니다 — 수용가 합의 대기');
                            } catch {
                              showToast('error', '합의 처리에 실패했습니다');
                            }
                          }}
                        >
                          <Handshake size={13} className="mr-1" /> 합의
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          onClick={() => showToast('warning', '조정을 요청했습니다 — SPC가 제안서를 재작성합니다')}
                        >
                          조정 요청
                        </Button>
                      </div>
                    </div>
                  )
                ) : isConsumer ? (
                  !leaseProposed ? (
                    <p className="text-sm text-slate-400">SPC의 제안서 작성을 기다리는 중입니다.</p>
                  ) : leaseProposalData?.consumerAgreed ? (
                    <p className="text-sm text-emerald-300">합의 완료 — 발전사 합의를 기다리는 중입니다.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-slate-200">SPC 제안서를 검토하고 합의 여부를 결정하세요.</p>
                      {leaseReview}
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={agreeLeaseProposalMut.isPending}
                          onClick={async () => {
                            try {
                              await agreeLeaseProposalMut.mutateAsync({ requestId: id, party: 'consumer' });
                              showToast('success', '제안에 합의했습니다 — 발전사 합의 시 계약으로 진행됩니다');
                            } catch {
                              showToast('error', '합의 처리에 실패했습니다');
                            }
                          }}
                        >
                          <Handshake size={13} className="mr-1" /> 합의
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-400 hover:text-rose-300"
                          disabled={updateStatusMut.isPending}
                          onClick={async () => {
                            try {
                              await updateStatusMut.mutateAsync({ id, status: 'SUBMITTED' });
                              showToast('warning', '보류했습니다 — SPC에 재검토를 요청합니다');
                            } catch {
                              showToast('error', '보류 처리에 실패했습니다');
                            }
                          }}
                        >
                          보류
                        </Button>
                      </div>
                    </div>
                  )
                ) : null}
              </div>
            ) : (
              <>
                {/* 계약 단계 — 매칭 확정(MATCHED) 후 모든 역할이 계약·전자서명/정산으로 진입 (역할별 라우팅) */}
                {consAccepted && (
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-emerald-500/[0.06] ring-1 ring-emerald-500/30 px-4 py-3">
                    <p className="text-sm text-emerald-300">
                      {contractActive
                        ? '양측 전자서명이 완료되어 계약이 발효되었습니다.'
                        : '매칭이 확정됐습니다 — 계약서에 양측이 전자서명하면 계약이 발효됩니다.'}
                    </p>
                    <div className="flex gap-2">
                      {/* SPC는 계약서 발행(등록) 주체, 발전사·수용가는 확인·전자서명 */}
                      {isSpc ? (
                        <Button variant="primary" size="sm" onClick={openSign}>
                          <FileSignature size={14} className="mr-1.5" />
                          {contractActive ? '계약서 보기' : '계약서 등록·발행'}
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" onClick={openSign}>
                          <FileSignature size={14} className="mr-1.5" />
                          {contractActive ? '서명 내역 보기' : '계약서 확인·전자서명'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(
                            isGenerator
                              ? '/generator/ppa/revenue/analytics'
                              : isSpc
                                ? '/platform/ppa/billing/settlement'
                                : '/ppa/billing/settlement',
                          )
                        }
                      >
                        정산 보기
                      </Button>
                    </div>
                  </div>
                )}
                {/* SPC — 매칭 제안 */}
                {isSpc &&
                  !consAccepted &&
                  (eligibleGenPool.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <Factory size={20} className="mx-auto text-slate-600 mb-2" />
                      <p className="text-sm text-slate-400">
                        {isOnsite ? '인접 지역 매칭 가능한 발전사가 없습니다' : '매칭 가능한 발전사가 없습니다'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {isOnsite
                          ? `Onsite는 한전 망 미사용 — 수용가 지역(${r.region ?? '—'})의 발전사만 매칭됩니다`
                          : '승인·매칭 대기 중인 발전사가 등록되면 여기에서 제안할 수 있습니다'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400">
                        발전사를 선택해 매칭을 제안하세요. (여러 발전사에 분할 제안 가능)
                        {isOnsite && <span className="text-amber-300"> · Onsite는 인접 지역 발전사만 표시</span>}
                      </p>
                      <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-[16rem]">
                            <label className="block text-xs text-accent mb-1.5">발전사 후보</label>
                            <Select
                              placeholder="발전사 선택"
                              value={selGen}
                              onChange={(e) => setSelGen(e.target.value)}
                              options={eligibleGenPool.map((g) => ({
                                value: String(g.companyId),
                                label: `${g.companyName} · ${(g.capacityKw ?? 0).toLocaleString()}kW${g.desiredUnitPrice ? ` · ${g.desiredUnitPrice}원` : ''}`,
                              }))}
                            />
                          </div>
                          <div className="w-40">
                            <label className="block text-xs text-accent mb-1.5">제안 단가(원/kWh)</label>
                            <Input
                              type="number"
                              placeholder={String(r.desiredUnitPrice ?? '')}
                              value={proposePrice}
                              onChange={(e) => setProposePrice(e.target.value)}
                            />
                          </div>
                          <Button
                            variant="primary"
                            disabled={!selGen || createMatchMut.isPending}
                            onClick={proposeMatch}
                          >
                            <Send size={14} className="mr-1.5" />
                            {createMatchMut.isPending ? '제안 중...' : '매칭 제안'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                {/* 발전사 — 받은 제안 수락/거절 */}
                {isGenerator &&
                  (() => {
                    const mine = activeMatches.filter(
                      (m) => m.generatorCompanyId === myCompanyId && m.status === 'PROPOSED',
                    );
                    if (mine.length === 0)
                      return <p className="text-sm text-slate-400">현재 응답할 매칭 제안이 없습니다.</p>;
                    return (
                      <div className="space-y-2">
                        {mine.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3"
                          >
                            <div className="text-sm text-slate-200">
                              {(m.capacityKw ?? 0).toLocaleString()} kW · ₩{(m.proposedPriceKrw ?? 0).toLocaleString()}
                              /kWh
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                disabled={genAcceptMut.isPending}
                                onClick={async () => {
                                  try {
                                    await genAcceptMut.mutateAsync(m.id);
                                    showToast('success', '매칭을 수락했습니다 — 수용가 최종 확인 대기');
                                  } catch {
                                    showToast('error', '수락 처리에 실패했습니다');
                                  }
                                }}
                              >
                                수락
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setCounterTarget({ id: m.id, price: m.proposedPriceKrw ?? 0 });
                                  setCounterPrice(m.proposedPriceKrw ? String(m.proposedPriceKrw) : '');
                                }}
                              >
                                역제안
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-400 hover:text-rose-300"
                                onClick={() => {
                                  setDeclineTarget({ id: m.id, by: 'generator' });
                                  setDeclineReason('');
                                }}
                              >
                                거절
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                {/* 수용가 — 최종 수락/거절 */}
                {isConsumer &&
                  (() => {
                    const ready = activeMatches.filter((m) => m.status === 'GEN_ACCEPTED');
                    if (consAccepted)
                      return <p className="text-sm text-emerald-300">최종 수락이 완료되어 계약 단계로 진행됩니다.</p>;
                    if (ready.length === 0)
                      return <p className="text-sm text-slate-400">발전사 수락 후 최종 확인하실 수 있습니다.</p>;
                    return (
                      <div className="space-y-2">
                        {ready.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3"
                          >
                            <div className="text-sm text-slate-200">
                              {m.generatorCompanyName ?? '발전사'} · {(m.capacityKw ?? 0).toLocaleString()} kW · ₩
                              {(m.proposedPriceKrw ?? 0).toLocaleString()}/kWh
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                disabled={acceptMut.isPending}
                                onClick={async () => {
                                  try {
                                    await acceptMut.mutateAsync(m.id);
                                    showToast('success', '최종 수락 완료 — 계약이 생성됩니다');
                                  } catch {
                                    showToast('error', '수락 처리에 실패했습니다');
                                  }
                                }}
                              >
                                <Handshake size={13} className="mr-1" /> 최종 수락
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-400 hover:text-rose-300"
                                onClick={() => {
                                  setDeclineTarget({ id: m.id, by: 'consumer' });
                                  setDeclineReason('');
                                }}
                              >
                                거절
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
              </>
            )}
          </SectionCard>

          {/* 진행 내역 — PPA: 매칭 내역 / Lease: 제안 이력 */}
          {isLease ? (
            <SectionCard title="제안 이력">
              {leaseProposalData ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      {leaseProposalData.generatorCompanyName ?? '배정 발전사'}
                    </span>
                    <Badge variant={leaseProposalData.status === 'AGREED' ? 'success' : 'warning'}>
                      {leaseProposalData.status === 'AGREED' ? '합의 완료' : '합의 대기'}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs">
                    <Info
                      label="설치 용량"
                      value={`${(leaseProposalData.installCapacityKw ?? 0).toLocaleString()} kW`}
                    />
                    <Info label="발전사 분배율" value={`${leaseProposalData.sharePct ?? 0}%`} />
                    <Info
                      label="예상 월 절감액"
                      value={
                        leaseProposalData.estSavingsPerMonth
                          ? `₩${leaseProposalData.estSavingsPerMonth.toLocaleString()}`
                          : '—'
                      }
                    />
                    <Info label="계약 기간" value={`${leaseProposalData.contractYears ?? '—'}년`} />
                  </div>
                </div>
              ) : leaseProposed ? (
                <div className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                  제안서가 작성되어 발전사·수용가 합의 단계입니다.
                </div>
              ) : (
                <div className="px-5 py-8 text-center">
                  <Sun size={20} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">아직 제안서가 없습니다</p>
                  <p className="text-xs text-slate-500 mt-1">SPC가 부지 평가 후 제안서를 작성하면 여기에 표시됩니다</p>
                </div>
              )}
            </SectionCard>
          ) : (
            /* 매칭 내역 */
            <SectionCard
              title={
                <>
                  매칭 내역{' '}
                  <Badge variant="default" className="ml-2">
                    {matches.length}건
                  </Badge>
                </>
              }
            >
              {matches.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <Zap size={20} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">아직 매칭이 없습니다</p>
                  <p className="text-xs text-slate-500 mt-1">SPC가 발전사를 매칭하면 여기에 표시됩니다</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-[11px] text-slate-500 bg-white/[0.02]">
                        <th className="px-4 py-2 text-left font-medium">발전사</th>
                        <th className="px-4 py-2 text-left font-medium">용량</th>
                        <th className="px-4 py-2 text-left font-medium">제안 단가</th>
                        <th className="px-4 py-2 text-left font-medium">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matches.map((m) => {
                        const b = MATCH_BADGE[m.status] ?? { label: m.status, variant: 'default' as const };
                        return (
                          <tr key={m.id} className="border-b border-white/[0.04]">
                            <td className="px-4 py-3 text-white">
                              {m.generatorCompanyName ?? m.plantName ?? '발전사'}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">
                              {(m.capacityKw ?? 0).toLocaleString()} kW
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-300 tabular-nums">
                              {m.proposedPriceKrw ? `₩${m.proposedPriceKrw.toLocaleString()}/kWh` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={b.variant}>{b.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* 당사자 정보 — SPC가 양측(수용가·발전사) 연락처를 보고 조율 */}
          {isSpc && (
            <SectionCard title="당사자 정보">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                {[
                  {
                    role: '수용가',
                    cls: 'bg-blue-500/[0.10] text-blue-300 ring-blue-500/30',
                    company: consumerCompany,
                    fallbackName: r.companyName,
                  },
                  {
                    role: '발전사',
                    cls: 'bg-amber-500/[0.10] text-amber-300 ring-amber-500/30',
                    company: generatorCompany,
                    fallbackName: isLease
                      ? leaseProposalData?.generatorCompanyName
                      : (acceptedMatch?.generatorCompanyName ?? activeMatches[0]?.generatorCompanyName),
                  },
                ].map((p) => (
                  <div key={p.role} className="rounded-lg ring-1 ring-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1',
                          p.cls,
                        )}
                      >
                        {p.role}
                      </span>
                      <p className="text-sm font-semibold text-white truncate">
                        {p.company?.name ?? p.fallbackName ?? '미정'}
                      </p>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-12 shrink-0">담당자</span>
                        <span className="text-slate-200">{p.company?.representativeName ?? '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-12 shrink-0">전화</span>
                        {p.company?.phone ? (
                          <a href={`tel:${p.company.phone}`} className="text-primary hover:underline tabular-nums">
                            {p.company.phone}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-500 w-12 shrink-0">이메일</span>
                        {p.company?.email ? (
                          <a href={`mailto:${p.company.email}`} className="text-primary hover:underline truncate">
                            {p.company.email}
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* 거래 정보 */}
          <SectionCard title="거래 정보">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-1 py-1 text-sm">
              <Info label="거래 유형" value={dealLabel} />
              <Info label="용량" value={`${(r.capacityKw ?? 0).toLocaleString()} kW`} />
              <Info label="계약 기간" value={`${r.durationYears ?? '—'}년`} />
              <Info
                label="희망 단가"
                value={r.desiredUnitPrice ? `₩${r.desiredUnitPrice.toLocaleString()}/kWh` : '—'}
              />
              <Info label="지역" value={r.region ?? '—'} />
              <Info label="사업장" value={r.siteName ?? '—'} />
              <Info label="REC 대상" value={r.recEligible ? '예' : '—'} />
              <Info label="요청 상태" value={r.status ?? '—'} />
            </div>
          </SectionCard>
        </div>
        {/* 우: 멀티 채팅 */}
        <div className="lg:col-span-1">
          {chatThreads.length > 0 ? (
            <TradingChatPanel requestId={id} threads={chatThreads} />
          ) : (
            <div className="rounded-xl bg-surface-card ring-1 ring-white/[0.08] p-6 text-center text-sm text-slate-500">
              협의 채팅을 사용할 수 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 역제안 — 발전사가 새 단가 제시 (→ 수용가 확인) */}
      <Modal
        open={!!counterTarget}
        onClose={() => setCounterTarget(null)}
        title="역제안 — 단가 조정"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCounterTarget(null)}>
              취소
            </Button>
            <Button variant="primary" disabled={!counterPrice || counterMut.isPending} onClick={submitCounter}>
              {counterMut.isPending ? '전송 중...' : '역제안 보내기'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-300">
            제안받은 단가 대신 희망 단가를 제시합니다. 수용가가 새 단가를 확인·수락하게 됩니다.
          </p>
          <div>
            <label className="block text-xs text-accent mb-1.5">역제안 단가 (원/kWh)</label>
            <Input
              type="number"
              min={0}
              placeholder="예: 130"
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* 거절 사유 입력 — 희망 조건을 사유로 전달(SPC 재제안의 근거) */}
      <Modal
        open={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        title="매칭 거절"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeclineTarget(null)}>
              취소
            </Button>
            <Button variant="danger" disabled={declineMut.isPending} onClick={submitDecline}>
              {declineMut.isPending ? '처리 중...' : '거절 확정'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-300">거절 사유를 남기면 SPC가 재제안 시 참고합니다. (예: 희망 단가, 조건)</p>
          <Textarea
            placeholder="예: 130원/kWh 희망 — 단가 협의 가능"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
          />
        </div>
      </Modal>

      {/* ─────────── 계약서 등록(SPC) / 확인·전자서명(발전사·수용가) ─────────── */}
      <Modal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title={isSpc ? '계약서 등록·발행' : '계약서 확인·전자서명'}
        size="lg"
      >
        {myContract ? (
          isSpc ? (
            <SpcContractRegister
              contract={myContract}
              request={r}
              dealLabel={dealLabel}
              isLease={isLease}
              acceptedMatch={acceptedMatch}
              leaseProposal={leaseProposalData}
              signUnitPrice={signUnitPrice}
              onPublished={() => setSignOpen(false)}
            />
          ) : (
            <DealContractSign
              contract={myContract}
              request={r}
              dealLabel={dealLabel}
              myRole={isConsumer ? 'CONSUMER' : 'GENERATOR'}
              onGoToContracts={() => router.push(contractsHref)}
            />
          )
        ) : (
          <div className="py-10 text-center">
            <Loader2 size={22} className="mx-auto animate-spin text-primary mb-3" />
            <p className="text-sm text-slate-300">계약서를 준비하는 중입니다.</p>
            <p className="text-xs text-slate-500 mt-1">
              매칭 확정 직후 계약서가 생성됩니다. 잠시 후 다시 시도해주세요.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* 진행 스텝 내 계약 전자서명 — 양측(발전사·수용가) 서명이 모두 완료되면 계약을 발효(ACTIVE)시킨다.
 * /api/v1/signatures 의 fullySigned(buyer+seller) 기준을 그대로 사용. */
function DealContractSign({
  contract,
  request,
  dealLabel,
  myRole,
  onGoToContracts,
}: {
  contract: any;
  request: any;
  dealLabel: string;
  myRole: 'CONSUMER' | 'GENERATOR';
  onGoToContracts: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const showToast = useToastStore((s) => s.add);
  const contractId = Number(contract.id);
  const sigStatus = useSignatureStatus('PPA', contractId);
  const signMutation = useSignContract();
  const activateMut = useActivatePpaContract();
  const updateReqMut = useUpdateRequestStatus();
  const { data: documents } = useContractDocuments(contractId);

  const status = sigStatus.data as any;
  const signatures: any[] = status?.signatures ?? [];
  const fullySigned = status?.fullySigned ?? false;
  const alreadySigned = signatures.some((s) => s.signerRole === myRole);
  // SPC가 계약서(PDF)를 발행(업로드)해야 당사자 서명 가능
  const contractDoc = (documents ?? [])[0];
  const issued = !!contractDoc;

  // 양측 서명이 완료되면: 계약 발효(NEW→ACTIVE) + 거래 FINALIZED (목록에서 '계약 서명 대기' 해제)
  useEffect(() => {
    if (!fullySigned) return;
    if (contract.status && contract.status !== 'ACTIVE') {
      activateMut.mutate(contractId, {
        onSuccess: () => showToast('success', '양측 서명 완료 — 계약이 발효되었습니다'),
      });
    }
    if (request?.id && request.status && request.status !== 'FINALIZED') {
      updateReqMut.mutate({ id: Number(request.id), status: 'FINALIZED' });
    }
    // contract.status / request.status / fullySigned 변화에만 반응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullySigned, contract.status, request?.status, contractId]);

  // 양측 서명 완료 → 발효 안내
  if (fullySigned) {
    return (
      <div className="space-y-4">
        <div className="py-2 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-3">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">양측 서명 완료 — 계약이 발효되었습니다</h3>
          <p className="text-sm text-slate-400 mt-1.5">
            계약번호 {contract.contractNumber} · {dealLabel}
          </p>
        </div>
        <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-4 space-y-1.5">
          {signatures.map((s) => (
            <p key={s.id} className="text-xs text-slate-400">
              <span className="text-slate-200">{s.signerName}</span> (
              {s.signerRole === 'CONSUMER' ? '수용가' : '발전사'}){' — '}
              {s.signedAt ? new Date(s.signedAt).toLocaleString('ko-KR') : ''} ·{' '}
              {s.signMethod === 'draw' ? '직접 서명' : '이름 입력'}
            </p>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onGoToContracts}>
            계약관리로 이동 <ArrowRight size={14} className="ml-1.5" />
          </Button>
        </div>
      </div>
    );
  }

  // 내 서명은 끝났고 상대방 서명 대기
  if (alreadySigned) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-sky-500/[0.06] ring-1 ring-sky-500/20 p-5 text-center">
          <Clock size={22} className="mx-auto text-sky-400 mb-2" />
          <p className="text-sm font-medium text-sky-300">내 서명 완료 — 상대방 서명을 기다리는 중</p>
          <p className="text-xs text-slate-500 mt-1">
            {myRole === 'CONSUMER' ? '발전사' : '수용가'}가 서명하면 계약이 자동으로 발효됩니다.
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onGoToContracts}>
            계약관리로 이동
          </Button>
        </div>
      </div>
    );
  }

  // SPC 발행 전 — 당사자는 아직 서명 불가
  if (!issued) {
    return (
      <div className="rounded-lg bg-amber-500/[0.06] ring-1 ring-amber-500/20 p-6 text-center">
        <Clock size={24} className="mx-auto text-amber-400 mb-2" />
        <p className="text-sm font-medium text-amber-300">SPC 계약서 발행 대기 중</p>
        <p className="text-xs text-slate-500 mt-1.5">
          SPC가 계약서(PDF)를 발행하면 본 화면에서 계약서를 확인하고 전자서명할 수 있습니다.
        </p>
      </div>
    );
  }

  // 서명 입력 — 계약서(PDF) 확인 후 전자서명(캔버스/이름)으로 내 측 서명 기록
  const genSigned = signatures.some((s) => s.signerRole === 'GENERATOR');
  const consSigned = signatures.some((s) => s.signerRole === 'CONSUMER');
  return (
    <div className="space-y-4">
      {/* 계약서 발행·서명 주체 안내 — SPC 발행, 양측(발전사·수용가) 서명 */}
      <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/[0.06] p-3">
        <p className="text-[11px] text-slate-500 mb-2">
          SPC가 발행한 아래 계약서를 확인하고, 발전사·수용가{' '}
          <span className="text-slate-300">양측이 모두 전자서명</span>하면 효력이 발생합니다.
        </p>
        <div className="flex gap-2">
          <SignPartyChip label="발전사" done={genSigned} mine={myRole === 'GENERATOR'} />
          <SignPartyChip label="수용가" done={consSigned} mine={myRole === 'CONSUMER'} />
        </div>
      </div>
      {/* SPC 발행 계약서(PDF) — 실제 계약 내용 */}
      <ContractPdfViewer fileId={contractDoc.fileId} fileName={contractDoc.fileName} />
      <ContractSignature
        contractTitle={`${dealLabel} 계약 — ${contract.contractNumber}`}
        contractSummary={[]}
        signerName={user?.name ?? ''}
        loading={signMutation.isPending}
        onSign={(data) => {
          signMutation.mutate(
            {
              contractType: 'PPA',
              contractId,
              signerRole: myRole,
              signMethod: data.method,
              signatureImage: data.image,
              typedName: data.typedName,
            },
            {
              onSuccess: () => showToast('success', '전자서명이 기록되었습니다'),
              onError: () => showToast('error', '서명 처리에 실패했습니다'),
            },
          );
        }}
      />
    </div>
  );
}

function SignPartyChip({ label, done, mine }: { label: string; done: boolean; mine: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ring-1',
        done
          ? 'bg-emerald-500/[0.08] ring-emerald-500/30 text-emerald-300'
          : 'bg-white/[0.02] ring-white/[0.08] text-slate-400',
      )}
    >
      {done ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {label} {done ? '서명 완료' : '서명 대기'}
      {mine && !done && <span className="text-primary">· 내 차례</span>}
    </span>
  );
}

/* 계약서 본문 — 계약 조건 + 표준 PPA 조항을 데이터로 렌더 (SPC 발행본 = 당사자 확인본 동일) */
function ContractDocBody({
  contract,
  request,
  dealLabel,
  isLease,
  acceptedMatch,
  leaseProposal,
  signUnitPrice,
}: {
  contract: any;
  request: any;
  dealLabel: string;
  isLease: boolean;
  acceptedMatch: any;
  leaseProposal: any;
  signUnitPrice: number;
}) {
  const generatorName = acceptedMatch?.generatorCompanyName ?? leaseProposal?.generatorCompanyName ?? '발전사';
  const consumerName = request?.companyName ?? '수용가';
  const cap = (request?.capacityKw ?? 0).toLocaleString();
  const years = request?.durationYears ?? '—';
  return (
    <div className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.02] max-h-[42vh] overflow-y-auto p-5 text-xs leading-relaxed text-slate-300 space-y-2.5">
      <div className="text-center pb-2 border-b border-white/[0.08]">
        <p className="text-sm font-bold text-white">전력 구매 계약서 (PPA)</p>
        <p className="text-[11px] text-slate-500 mt-0.5">계약번호 {contract.contractNumber}</p>
      </div>
      <p>
        본 계약은 <b className="text-slate-200">{generatorName}</b>(이하 “발전사”)와{' '}
        <b className="text-slate-200">{consumerName}</b>(이하 “수용가”) 간, SPC{' '}
        <b className="text-slate-200">주식회사 알엠에스플랫폼</b>의 중개로 체결하는 전력 구매 계약이다.
      </p>
      <Clause n={1} title="계약의 목적">
        발전사가 생산한 전력을 수용가에게 공급하고 그 대가를 정산하는 데 관한 권리·의무를 정한다.
      </Clause>
      <Clause n={2} title="공급 설비 및 용량">
        {dealLabel} · 계약 용량 {cap} kW.
      </Clause>
      <Clause n={3} title="계약 기간">
        계약 효력 발생일로부터 {years}년.
      </Clause>
      <Clause n={4} title={isLease ? '수익 분배' : '공급 단가'}>
        {isLease
          ? `발전 수익에 대한 발전사 분배율 ${leaseProposal?.sharePct ?? 0}%를 적용한다.`
          : `전력 공급 단가는 ₩${signUnitPrice.toLocaleString()}/kWh로 하며 계약 기간 동안 고정한다.`}
      </Clause>
      <Clause n={5} title="대금 정산">
        매월 실제 발전량을 기준으로 정산하며, 세금계산서 발행 후 익월에 정산·지급한다.
      </Clause>
      <Clause n={6} title="계약의 효력">
        본 계약은 발전사·수용가 양측의 전자서명이 모두 완료된 날에 효력이 발생한다.
      </Clause>
      <Clause n={7} title="계약의 해지">
        관계 법령 및 전력거래소 규정에 따르며, 일방 해지 시 상대방 동의 및 위약 정산 절차를 따른다.
      </Clause>
      <Clause n={8} title="분쟁의 해결">
        본 계약과 관련한 분쟁은 상호 협의로 해결하며, 협의가 이루어지지 않을 경우 관할 법원의 판단에 따른다.
      </Clause>
    </div>
  );
}

function Clause({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <p>
      <b className="text-slate-200">
        제{n}조 ({title})
      </b>{' '}
      {children}
    </p>
  );
}

/* SPC 발행 계약서 PDF 뷰어 — 컨설팅 패턴: fetch 로 PDF를 blob 으로 받아 blob: URL 을 iframe 에 렌더
 * (서버 X-Frame-Options/인증 영향 없이 same-origin blob 으로 표시) */
function ContractPdfViewer({ fileId, fileName }: { fileId: number; fileName?: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const res = await fetch(getViewUrl(fileId), { credentials: 'include' });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [fileId]);

  return (
    <div className="rounded-lg ring-1 ring-white/[0.08] bg-black/20 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.08] bg-white/[0.02]">
        <span className="flex items-center gap-1.5 text-xs text-slate-300 min-w-0">
          <FileText size={13} className="text-slate-400 shrink-0" />
          <span className="truncate">{fileName || '계약서.pdf'}</span>
        </span>
        <a
          href={getDownloadUrl(fileId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
        >
          <Download size={12} /> 다운로드
        </a>
      </div>
      {loading ? (
        <div className="h-[46vh] flex items-center justify-center bg-white/[0.02]">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      ) : error || !blobUrl ? (
        <div className="h-[40vh] flex flex-col items-center justify-center gap-2 text-center px-4">
          <FileText size={24} className="text-slate-500" />
          <p className="text-xs text-slate-400">PDF 미리보기를 불러올 수 없습니다.</p>
          <a
            href={getDownloadUrl(fileId)}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary hover:underline"
          >
            다운로드로 열기
          </a>
        </div>
      ) : (
        <iframe src={blobUrl} title="계약서" className="w-full h-[46vh] bg-white" />
      )}
    </div>
  );
}

/* SPC 계약서 등록·발행 — 매칭 조건의 계약서(PDF)를 업로드해 발행한다.
 * 발행(contract_documents)된 후에야 발전사·수용가가 PDF를 확인·전자서명할 수 있다. */
function SpcContractRegister({
  contract,
  request,
  dealLabel,
  isLease,
  acceptedMatch,
  leaseProposal,
  signUnitPrice,
  onPublished,
}: {
  contract: any;
  request: any;
  dealLabel: string;
  isLease: boolean;
  acceptedMatch: any;
  leaseProposal: any;
  signUnitPrice: number;
  onPublished: () => void;
}) {
  const showToast = useToastStore((s) => s.add);
  const contractId = Number(contract.id);
  const sigStatus = useSignatureStatus('PPA', contractId);
  const { data: documents } = useContractDocuments(contractId);
  const addDocMut = useAddContractDocument();
  const [picked, setPicked] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const signatures: any[] = (sigStatus.data as any)?.signatures ?? [];
  const contractDoc = (documents ?? [])[0];
  const issued = !!contractDoc;
  const genSigned = signatures.some((s) => s.signerRole === 'GENERATOR');
  const consSigned = signatures.some((s) => s.signerRole === 'CONSUMER');

  const publish = async () => {
    if (!picked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', picked);
      const info = await uploadFile(fd);
      await addDocMut.mutateAsync({ contractId, fileId: info.id, documentType: 'PPA_CONTRACT' });
      showToast('success', '계약서가 발행되었습니다 — 발전사·수용가 서명 단계로 진행됩니다');
      setPicked(null);
      onPublished();
    } catch {
      showToast('error', '계약서 발행(업로드)에 실패했습니다');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'rounded-lg ring-1 px-4 py-3 text-sm',
          issued
            ? 'bg-emerald-500/[0.06] ring-emerald-500/30 text-emerald-300'
            : 'bg-blue-500/[0.06] ring-blue-500/20 text-blue-300',
        )}
      >
        {issued
          ? '계약서 발행 완료 — 발전사·수용가 전자서명 대기'
          : '매칭 조건을 확인한 뒤, 계약서(PDF)를 업로드해 발행하세요. 발행 후 발전사·수용가가 확인·전자서명합니다.'}
      </div>

      {issued ? (
        <>
          <div className="flex gap-2">
            <SignPartyChip label="발전사" done={genSigned} mine={false} />
            <SignPartyChip label="수용가" done={consSigned} mine={false} />
          </div>
          {/* 발행된 실제 계약서(PDF) */}
          <ContractPdfViewer fileId={contractDoc.fileId} fileName={contractDoc.fileName} />
        </>
      ) : (
        <div className="space-y-3">
          {/* 작성 참고용 매칭 조건 요약 (발행 전, 아직 PDF 없음) */}
          <ContractDocBody
            contract={contract}
            request={request}
            dealLabel={dealLabel}
            isLease={isLease}
            acceptedMatch={acceptedMatch}
            leaseProposal={leaseProposal}
            signUnitPrice={signUnitPrice}
          />
          <p className="text-xs text-slate-400">계약서 파일 (PDF)</p>
          <FileUpload accept="application/pdf,.pdf" maxSizeMB={20} onChange={(files) => setPicked(files[0] ?? null)} />
          <div className="flex justify-end">
            <Button variant="primary" disabled={!picked || uploading} onClick={publish}>
              {uploading ? (
                <Loader2 size={14} className="animate-spin mr-1.5" />
              ) : (
                <Upload size={14} className="mr-1.5" />
              )}
              계약서 발행 (업로드)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
        <Clock size={10} /> {label}
      </p>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}
