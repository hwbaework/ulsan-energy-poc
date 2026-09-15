'use client';

import { useState } from 'react';
import { Card, CardHeader } from '@/components/edm/ui/Card';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { Tabs } from '@/components/edm/ui/Tabs';
import { StatCard, StatsGrid } from '@/components/edm/features/StatCard';
import { ProgressBar } from '@/components/edm/ui/ProgressBar';
import { Modal } from '@/components/ui/Modal';
import { Key, Copy, Trash2, Plus, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, useDatasets, type ApiKeyRow } from '@/hooks/edm/useDm';
import { useAnalyticsApiUsage } from '@/hooks/edm/useAnalytics';

const API_TABS = [
  { id: 'catalog', label: 'API 카탈로그' },
  { id: 'keys', label: '내 API 키' },
  { id: 'usage', label: '사용량' },
];

export default function ApiHubPage() {
  const [tab, setTab] = useState('catalog');
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);

  // API 카탈로그 — 게시된 API형 데이터셋 실조회(GET datamarket.datasets?status=PUBLISHED, format=API).
  // 설계 22: mock(MOCK_APIS) 금지 — 실데이터/빈/오류 정직. 카탈로그(2번)와 동일 소스.
  const { data: publishedDatasets, isError: catalogError } = useDatasets('PUBLISHED');
  const apiDatasets = publishedDatasets.filter((d) => d.format === 'API');

  // §3 키 생명주기 CRUD (설계 12 §3)
  const { data: liveKeys, isLive, isError: keysError } = useApiKeys(companyId);
  // §6 API 사용량 실집계 (기획 14 §6) — 키별 쿼터/사용 누적. 일별 호출 시계열은 원천 로그 부재로 "준비중".
  const apiUsage = useAnalyticsApiUsage(companyId);
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const [createOpen, setCreateOpen] = useState(false);
  const [datasetIdInput, setDatasetIdInput] = useState('');
  const [quotaInput, setQuotaInput] = useState('');
  const [issuedPrefix, setIssuedPrefix] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // 설계 22: mock(MOCK_KEYS) 폴백 제거 — 실 조회만. 오류/빈 상태는 배지·빈 행으로 정직 노출.
  const keyRows: ApiKeyRow[] = liveKeys;
  const keysGuard =
    companyId == null
      ? '회사 정보가 없어 API 키를 관리할 수 없습니다'
      : keysError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  async function handleCreate() {
    const res = await createKey.mutateAsync({
      consumerCompanyId: companyId,
      datasetId: Number(datasetIdInput) || 0,
      quota: quotaInput ? Number(quotaInput) : undefined,
    });
    setIssuedPrefix(res.key.keyPrefix); // 원문 키 1회 노출(마스킹 prefix)
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    await revokeKey.mutateAsync(revokeTarget.id);
    setRevokeTarget(null);
  }

  function copyPrefix(row: ApiKeyRow) {
    navigator.clipboard?.writeText(row.keyPrefix).catch(() => {});
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 1500);
  }

  // §6 누적 쿼터/사용 — 실집계 우선(quotaUsedSum/quotaLimitSum). 일별 호출·에러율은 원천 로그 부재로 미제공.
  const quotaUsed = apiUsage.data.quotaUsedSum;
  const quotaLimit = Math.max(1, apiUsage.data.quotaLimitSum);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">API 허브</h1>

      <Tabs tabs={API_TABS} activeId={tab} onChange={setTab} />

      {tab === 'catalog' &&
        (catalogError ? (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <AlertTriangle size={28} className="text-semantic-yellow" />
              <Badge variant="warning">불러오기 실패</Badge>
              <p className="text-sm text-white font-medium">API 카탈로그를 불러오지 못했습니다</p>
              <p className="text-xs text-accent">잠시 후 다시 시도하거나 다시 로그인하세요.</p>
            </div>
          </Card>
        ) : apiDatasets.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center gap-2 text-center">
              <Zap size={28} className="text-accent/40" />
              <p className="text-sm text-white font-medium">공개 API 카탈로그가 없습니다</p>
              <p className="text-xs text-accent">게시된 API형 데이터셋이 등록되면 이곳에 노출됩니다.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {apiDatasets.map((d) => (
              <Card key={d.id} className="p-4 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap size={16} className="text-primary shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{d.title}</span>
                  </div>
                  <Badge variant="success">API</Badge>
                </div>
                <p className="text-xs text-accent line-clamp-2">{d.description}</p>
                <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-accent">
                  <span>{d.provider.name}</span>
                  <span className="tabular-nums">
                    {d.priceModel.type === 'FREE'
                      ? '무료'
                      : `₩${(d.priceModel.basePrice ?? 0).toLocaleString()}${d.priceModel.type === 'SUBSCRIPTION' ? '/월' : ''}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-accent/70">
                  <span>{d.category.name || d.category.slug || '미분류'}</span>
                  <span>
                    품질 {d.qualityScore}점 · {d.updateFrequency}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {tab === 'keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant={isLive ? 'success' : keysError ? 'warning' : 'default'}>
              {isLive ? '실시간' : keysError ? '불러오기 실패' : '—'}
            </Badge>
            <Button
              size="sm"
              onClick={() => {
                setIssuedPrefix(null);
                setDatasetIdInput('');
                setQuotaInput('');
                setCreateOpen(true);
              }}
            >
              <Plus size={14} /> 새 API 키 생성
            </Button>
          </div>
          {keysGuard && <p className="text-xs text-amber-400">{keysGuard}</p>}
          <Card padding={false}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-accent/20 bg-white/[0.02]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-accent">데이터셋</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-accent">키</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-accent">상태</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-accent">사용/쿼터</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-accent">액션</th>
                </tr>
              </thead>
              <tbody>
                {keyRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-accent">
                      발급된 API 키가 없습니다. &quot;새 API 키 생성&quot;으로 발급하세요.
                    </td>
                  </tr>
                )}
                {keyRows.map((key) => (
                  <tr key={key.id} className="border-b border-accent/10 hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-accent" />
                        <span className="text-xs font-medium text-white">
                          {key.datasetTitle || `데이터셋 #${key.datasetId}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-accent">{key.keyPrefix}…</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={key.status === 'ACTIVE' ? 'success' : 'default'}>
                        {key.status === 'ACTIVE' ? '활성' : '폐기'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-accent tabular-nums">
                      {key.used.toLocaleString()} / {key.quota != null ? key.quota.toLocaleString() : '무제한'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={key.status === 'REVOKED'}
                          onClick={() => copyPrefix(key)}
                        >
                          {copiedId === key.id ? (
                            <CheckCircle size={12} className="text-semantic-green" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={key.status === 'REVOKED' || !isLive}
                          onClick={() => setRevokeTarget(key)}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {!isLive && <p className="text-xs text-accent">실데이터 조회 상태에서만 파괴적 액션(폐기)이 활성화됩니다.</p>}
        </div>
      )}

      {tab === 'usage' && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <Badge variant={apiUsage.isLive ? 'success' : apiUsage.isError ? 'warning' : 'default'}>
              {apiUsage.isLive ? '실시간' : apiUsage.isError ? '불러오기 실패' : '—'}
            </Badge>
          </div>
          <StatsGrid columns={4}>
            <StatCard label="누적 사용 (쿼터)" value={quotaUsed.toLocaleString()} sub="건" />
            <StatCard label="활성 키" value={apiUsage.data.perKey.length.toLocaleString()} sub="개" />
            <StatCard label="쿼터 소진율" value={`${((quotaUsed / quotaLimit) * 100).toFixed(1)}%`} sub="" />
            <StatCard
              label="남은 쿼터"
              value={`${Math.max(0, quotaLimit - quotaUsed).toLocaleString()}`}
              sub={`/ ${quotaLimit.toLocaleString()}`}
            />
          </StatsGrid>

          {/* Quota Bar */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-accent">API 호출 쿼터</span>
              <span className="text-xs text-white font-medium">
                {quotaUsed.toLocaleString()} / {quotaLimit.toLocaleString()}
              </span>
            </div>
            <ProgressBar value={(quotaUsed / quotaLimit) * 100} />
            {quotaUsed / quotaLimit >= 0.8 && (
              <div className="flex items-center gap-1 mt-2 text-xs text-semantic-yellow">
                <AlertTriangle size={12} /> 쿼터 80%를 초과했습니다. 플랜 업그레이드를 고려하세요.
              </div>
            )}
          </Card>

          {/* 키별 사용/쿼터 — 실집계 (기획 14 §6). 일별 호출 시계열은 호출로그 부재로 준비중. */}
          <Card className="p-5">
            <CardHeader title="키별 사용량" description="쿼터 대비 누적 사용" />
            {apiUsage.data.perKey.length === 0 ? (
              <p className="py-6 text-center text-xs text-accent">API 키가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {apiUsage.data.perKey.map((k) => {
                  const limit = k.quota ?? 0;
                  const pct = limit > 0 ? (k.used / limit) * 100 : 0;
                  return (
                    <div key={k.keyId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-accent">{k.prefix}…</span>
                        <span className="text-white">
                          {k.used.toLocaleString()} / {k.quota != null ? k.quota.toLocaleString() : '무제한'}
                        </span>
                      </div>
                      <ProgressBar value={pct} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <CardHeader title="일별 API 호출 추이" description="요일 × 시간대" />
            <div className="flex h-24 flex-col items-center justify-center gap-2 text-center">
              <Badge variant="info">준비중</Badge>
              <p className="text-xs text-accent">일별 호출 시계열은 호출로그 수집 인프라 구축 후 제공됩니다.</p>
            </div>
          </Card>
        </div>
      )}

      {/* 키 생성 모달 (§3.2) — 대상 데이터셋·쿼터 → 발급, 원문 키 1회 노출 */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="새 API 키 생성" size="sm">
        {issuedPrefix ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20 px-3 py-2.5">
              <CheckCircle size={16} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">키가 발급되었습니다. 아래 원문 키는 지금 한 번만 표시됩니다.</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-4 py-3">
              <p className="text-[11px] text-slate-400 mb-1">API 키 (마스킹 prefix)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-sm text-white break-all">{issuedPrefix}…</code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigator.clipboard?.writeText(issuedPrefix).catch(() => {})}
                >
                  <Copy size={12} /> 복사
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setCreateOpen(false)}>
                완료
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-xs text-slate-400">
              대상 데이터셋 ID *
              <input
                value={datasetIdInput}
                onChange={(e) => setDatasetIdInput(e.target.value)}
                placeholder="예: 1"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <label className="block text-xs text-slate-400">
              호출 쿼터 (비우면 무제한)
              <input
                type="number"
                value={quotaInput}
                onChange={(e) => setQuotaInput(e.target.value)}
                placeholder="10000"
                className="mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" size="sm" onClick={() => setCreateOpen(false)}>
                취소
              </Button>
              <Button
                size="sm"
                loading={createKey.isPending}
                disabled={!(Number(datasetIdInput) > 0)}
                onClick={handleCreate}
              >
                발급
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 키 폐기 확인 다이얼로그 (§3.2 파괴적 액션) */}
      <Modal open={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="API 키 폐기" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 ring-1 ring-red-500/20 px-3 py-2.5">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300">폐기 후에는 이 키로 API를 호출할 수 없습니다. 되돌릴 수 없습니다.</p>
          </div>
          {revokeTarget && (
            <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-400">데이터셋</span>
                <span className="text-white">{revokeTarget.datasetTitle || `#${revokeTarget.datasetId}`}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">키</span>
                <span className="font-mono text-white">{revokeTarget.keyPrefix}…</span>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setRevokeTarget(null)}>
              취소
            </Button>
            <Button variant="danger" size="sm" loading={revokeKey.isPending} onClick={handleRevoke}>
              폐기
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
