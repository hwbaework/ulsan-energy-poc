'use client';

// 판매자 등록 위저드 — 설계 12 §1. 5스텝(메타·표준화·업로드·가격/동의·검토).
// POST datamarket.datasets(DRAFT) + POST datamarket.consents(동의 게이트).
// 파일 업로드 RAW 스토리지는 스텁(후속 트랙 §1.4) — 가짜 성공 금지.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check, Upload, ShieldCheck, FileText } from 'lucide-react';
import { Card } from '@/components/edm/ui/Card';
import { Button } from '@/components/edm/ui/Button';
import { Badge } from '@/components/edm/ui/Badge';
import { Breadcrumb } from '@/components/edm/layout/Breadcrumb';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCreateDataset, useCreateConsent, type PriceModelKind } from '@/hooks/edm/useDm';
import { useUploadDatasetFile } from '@/hooks/edm/useDmFile';

const STEPS = ['메타', '데이터 표준화', '데이터 업로드', '가격·동의 서명', '검토·제출'] as const;

const CATEGORIES: { id: number; name: string }[] = [
  { id: 1, name: '에너지/발전' },
  { id: 2, name: '설비/운영' },
  { id: 3, name: '환경/기후' },
  { id: 4, name: '경제/시장' },
  { id: 5, name: 'IoT/센서' },
];
const FORMATS = ['API', 'FILE', 'TABLE'] as const;
const FREQUENCIES = ['REALTIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'ONCE'] as const;
const PRICE_TYPES: { value: PriceModelKind; label: string }[] = [
  { value: 'FREE', label: '무료' },
  { value: 'ONETIME', label: '건별 구매' },
  { value: 'SUBSCRIPTION', label: '구독' },
  { value: 'PAY_PER_USE', label: '사용량 기반' },
];
const DEIDENT = ['가명처리', '총계처리', '값삭제', '범주화', '마스킹'];

const inputCls =
  'mt-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

interface SchemaCol {
  name: string;
  type: string;
  description: string;
}

export default function RegisterWizardPage() {
  const router = useRouter();
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const createDataset = useCreateDataset();
  const createConsent = useCreateConsent();
  const uploadFile = useUploadDatasetFile();

  const [step, setStep] = useState(0);

  // 스텝1 메타
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number>(1);
  const [providerName, setProviderName] = useState('');
  const [tags, setTags] = useState('');

  // 스텝2 표준화
  const [columns, setColumns] = useState<SchemaCol[]>([{ name: '', type: 'STRING', description: '' }]);
  const [standardChecked, setStandardChecked] = useState(false);
  const [format, setFormat] = useState<(typeof FORMATS)[number]>('API');
  const [frequency, setFrequency] = useState<(typeof FREQUENCIES)[number]>('DAILY');

  // 스텝3 업로드 (실동작 — 실제 File 보관, 제출 시 데이터셋 생성 후 업로드)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileName = selectedFile?.name ?? '';
  const [uploadState, setUploadState] = useState<'idle' | 'uploaded' | 'pending' | 'failed'>('idle');

  // 스텝4 가격·동의
  const [priceType, setPriceType] = useState<PriceModelKind>('SUBSCRIPTION');
  const [basePrice, setBasePrice] = useState('');
  const [scope, setScope] = useState<'AGGREGATED' | 'RAW_DESIGNATED'>('AGGREGATED');
  const [methods, setMethods] = useState<string[]>(['마스킹', '총계처리']);
  const [signer, setSigner] = useState('');
  const [consentSigned, setConsentSigned] = useState(false);

  // 제출 상태
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [isLive, setIsLive] = useState(true);

  const toggleMethod = (m: string) => setMethods((c) => (c.includes(m) ? c.filter((x) => x !== m) : [...c, m]));

  const isFree = priceType === 'FREE';

  // 스텝별 진행 가능 여부
  const canNext = (() => {
    if (step === 0) return title.trim() !== '' && providerName.trim() !== '';
    if (step === 3) return consentSigned && signer.trim() !== '' && (isFree || Number(basePrice) > 0);
    return true;
  })();

  const submitDisabled = !consentSigned || signer.trim() === '' || submitting || (!isFree && !(Number(basePrice) > 0));

  async function handleSubmit() {
    setSubmitErr('');
    setSubmitting(true);
    try {
      const created = await createDataset.mutateAsync({
        providerCompanyId: companyId,
        providerName,
        title,
        description,
        categoryId,
        format,
        updateFrequency: frequency,
        priceType,
        basePrice: isFree ? 0 : Number(basePrice) || 0,
      });
      setCreatedId(created.id);
      setIsLive(created.isLive);

      // 동의 서명 — 데이터셋 생성 성공 시 동의 게이트도 함께 배선 (§5·§5.4 게이트 체인)
      if (created.id > 0) {
        await createConsent.mutateAsync({
          datasetId: created.id,
          companyId,
          scope,
          methods: methods.join(','),
        });

        // 파일 업로드 (format='FILE' 실동작) — 데이터셋 생성 후 실제 원본 저장 (§1.4).
        // 서버 저장 경계(로컬 impl, MinIO 전환은 BE impl 교체) 통해 저장 + 메타 INSERT.
        if (selectedFile) {
          const up = await uploadFile.mutateAsync({
            datasetId: created.id,
            file: selectedFile,
            companyId,
          });
          setUploadState(up.isLive ? 'uploaded' : 'pending');
        }
      } else if (selectedFile) {
        // 데이터셋이 낙관 폴백(id<0)이면 파일도 서버 저장 불가 — 가짜 성공 금지
        setUploadState('pending');
      }

      // 등록한 데이터 탭으로 이동
      router.push('/e-data/catalog/my-data?tab=registered');
    } catch {
      setSubmitErr('등록 제출 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '데이터 카탈로그', path: '/e-data/catalog' }, { label: '데이터 등록' }]} />
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-white">데이터 등록</h1>
        <Badge variant="info">판매자</Badge>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium',
                  i < step
                    ? 'bg-primary text-white'
                    : i === step
                      ? 'border border-primary text-primary'
                      : 'border border-accent/30 text-accent/50',
                )}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <p className={cn('mt-1.5 text-[11px]', i === step ? 'text-white font-medium' : 'text-accent')}>{label}</p>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-2 h-px flex-1', i < step ? 'bg-primary' : 'bg-accent/20')} />
            )}
          </div>
        ))}
      </div>

      <Card className="p-5">
        {/* 스텝1: 메타 */}
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">메타 정보 (등록 신청)</h2>
            <label className="block text-xs text-slate-400">
              제목 *
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 울산 태양광 발전량 시계열"
                className={inputCls}
              />
            </label>
            <label className="block text-xs text-slate-400">
              설명
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={inputCls}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">
                카테고리
                <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} className={inputCls}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                판매기관명 *
                <input value={providerName} onChange={(e) => setProviderName(e.target.value)} className={inputCls} />
              </label>
            </div>
            <label className="block text-xs text-slate-400">
              태그 (쉼표 구분)
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="태양광, 발전량, 시계열"
                className={inputCls}
              />
            </label>
          </div>
        )}

        {/* 스텝2: 표준화 */}
        {step === 1 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">데이터 표준화 (컬럼 스키마)</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">
                데이터 형식
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as typeof format)}
                  className={inputCls}
                >
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                업데이트 주기
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as typeof frequency)}
                  className={inputCls}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-400">컬럼 스키마 (명·타입·설명)</p>
              {columns.map((col, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_1.5fr_auto] items-center gap-2">
                  <input
                    value={col.name}
                    onChange={(e) =>
                      setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))
                    }
                    placeholder="컬럼명"
                    className={inputCls}
                  />
                  <select
                    value={col.type}
                    onChange={(e) =>
                      setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, type: e.target.value } : c)))
                    }
                    className={inputCls}
                  >
                    {['STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'DATETIME', 'JSON'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    value={col.description}
                    onChange={(e) =>
                      setColumns((cs) => cs.map((c, j) => (j === i ? { ...c, description: e.target.value } : c)))
                    }
                    placeholder="설명"
                    className={inputCls}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setColumns((cs) => (cs.length > 1 ? cs.filter((_, j) => j !== i) : cs))}
                  >
                    삭제
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setColumns((cs) => [...cs, { name: '', type: 'STRING', description: '' }])}
              >
                + 컬럼 추가
              </Button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400">
              <input
                type="checkbox"
                checked={standardChecked}
                onChange={(e) => setStandardChecked(e.target.checked)}
                className="h-4 w-4"
              />
              데이터 표준지침서 준수를 확인했습니다.
            </label>
          </div>
        )}

        {/* 스텝3: 업로드 (실동작 — 제출 시 서버 저장) */}
        {step === 2 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">데이터 업로드 (RAW)</h2>
            <div className="mb-1 flex items-center gap-2 rounded-lg bg-sky-500/10 ring-1 ring-sky-500/20 px-3 py-2">
              <Upload size={15} className="text-sky-400 shrink-0" />
              <p className="text-xs text-sky-300">
                파일 형식(FILE) 데이터셋의 원본은 제출 시 서버에 저장됩니다. 최대 50MB. 저장된 파일은 구매(결제 완료) 후
                서버 경유로만 다운로드됩니다(경로 비노출).
              </p>
            </div>
            <label className="block">
              <span className="text-xs text-slate-400">파일 선택 (CSV/JSON/Parquet, ≤50MB)</span>
              <input
                type="file"
                accept=".csv,.json,.parquet"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setSelectedFile(f);
                  setUploadState('idle');
                }}
                className={cn(
                  inputCls,
                  'file:mr-3 file:rounded file:border-0 file:bg-white/[0.06] file:px-2 file:py-1 file:text-slate-300',
                )}
              />
            </label>
            {selectedFile && (
              <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">파일명</span>
                  <span className="text-white">{selectedFile.name}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">크기</span>
                  <span className="text-white">
                    {(selectedFile.size / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">상태</span>
                  {uploadState === 'uploaded' ? (
                    <Badge variant="success">업로드 완료</Badge>
                  ) : uploadState === 'pending' ? (
                    <Badge variant="warning">업로드 대기(서버 미연결)</Badge>
                  ) : uploadState === 'failed' ? (
                    <Badge variant="danger">업로드 실패</Badge>
                  ) : (
                    <Badge variant="info">제출 시 저장</Badge>
                  )}
                </div>
              </div>
            )}
            {selectedFile && selectedFile.size > 50 * 1024 * 1024 && (
              <p className="text-xs text-red-400">파일이 50MB를 초과합니다. 더 작은 파일을 선택하세요.</p>
            )}
          </div>
        )}

        {/* 스텝4: 가격·동의 */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">가격 모델 · 동의 서명</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">
                가격 모델
                <select
                  value={priceType}
                  onChange={(e) => setPriceType(e.target.value as PriceModelKind)}
                  className={inputCls}
                >
                  {PRICE_TYPES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-slate-400">
                단가 (원){isFree && ' — 무료'}
                <input
                  type="number"
                  value={isFree ? '' : basePrice}
                  disabled={isFree}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className={inputCls}
                />
              </label>
            </div>
            <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
              수익 배분 고지 — <span className="text-white">판매자 85% / 플랫폼 15%</span> (거래액의 15% 수수료 차감 후
              정산)
            </div>

            {/* 동의 서명 위젯 (§5 흡수) */}
            <div className="rounded-lg border border-white/[0.08] p-4 space-y-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                <ShieldCheck size={15} /> 데이터 제공 동의 (법적 게이트)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-slate-400">
                  제공 범위
                  <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} className={inputCls}>
                    <option value="AGGREGATED">비식별 집계만 (권장)</option>
                    <option value="RAW_DESIGNATED">원천 시계열 (지정 구매자)</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-400">
                  서명자 *
                  <input
                    value={signer}
                    onChange={(e) => setSigner(e.target.value)}
                    placeholder="담당자명"
                    className={inputCls}
                  />
                </label>
              </div>
              <div className="text-xs text-slate-400">
                비식별 처리 (5기법)
                <div className="mt-2 flex flex-wrap gap-2">
                  {DEIDENT.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMethod(m)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-xs',
                        methods.includes(m) ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.03] text-slate-400',
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentSigned}
                  onChange={(e) => setConsentSigned(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span className="text-xs text-slate-400">
                  데이터 3법·데이터산업진흥법에 따른 제공 동의·비식별·수익배분에 동의하며 전자서명합니다. (미서명 시
                  제출 불가)
                </span>
              </label>
            </div>
          </div>
        )}

        {/* 스텝5: 검토·제출 */}
        {step === 4 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">검토 · 제출</h2>
            <div className="rounded-lg bg-white/[0.03] px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">제목</span>
                <span className="text-white">{title || '—'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">판매기관</span>
                <span className="text-white">{providerName || '—'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">형식·주기</span>
                <span className="text-white">
                  {format} · {frequency}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">컬럼 수</span>
                <span className="text-white">{columns.filter((c) => c.name).length}개</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">가격</span>
                <span className="text-white">{isFree ? '무료' : `₩${Number(basePrice || 0).toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">파일</span>
                <span className="text-white">{fileName || '업로드 예정'}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">동의 서명</span>
                <span className="text-white">{consentSigned ? `${signer} (서명 완료)` : '미서명'}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-accent">
              <FileText size={14} /> 제출 시 데이터셋은 <span className="text-white">DRAFT</span> 상태로 생성됩니다.
              게시는 운영자 심사(승인) 후 이루어집니다.
            </div>
            {createdId != null && !isLive && (
              <Badge variant="warning">BE 미가동 — 낙관 처리(isLive:false), 실제 저장은 서버 연결 후</Badge>
            )}
            {submitErr && <p className="text-xs text-red-400">{submitErr}</p>}
          </div>
        )}
      </Card>

      {/* 하단 네비게이션 */}
      <div className="flex justify-between">
        <Button
          variant="secondary"
          size="sm"
          disabled={step === 0 || submitting}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          <ChevronLeft size={14} /> 이전
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" disabled={!canNext} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
            다음 <ChevronRight size={14} />
          </Button>
        ) : (
          <Button size="sm" loading={submitting} disabled={submitDisabled} onClick={handleSubmit}>
            등록 제출
          </Button>
        )}
      </div>
    </div>
  );
}
