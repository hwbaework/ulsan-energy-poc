'use client';

// E-데이터마켓 › 카본 마켓플레이스 — 연동 · 거래 실행 없음.
// 공식 공개 정보는 링크로 보내고, 서식은 법제처 원본 그대로 보여주고 받게 한다. 법령이 바뀌면 관리자가 새 서식을 올린다.
// 근거 · 절차: docs/카본마켓-조사.md (2026-10-08).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, ExternalLink, RotateCcw, Upload } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PAPER } from '@/components/features/trading-poc/BillingPaper';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCarbonFormStore, type FormFileKind, type UploadedForm } from '@/stores/useCarbonFormStore';
import { useToastStore } from '@/stores/useToastStore';
import { useGhgRole } from '@/components/features/ghg/GhgScreens';
import { CARBON_FORMS, LINKS, type CarbonForm } from '@/lib/carbon-docs';
import { fitPdf } from '@/lib/utils/fitPdf';

/* ── 공통 ── */
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`text-sm ${cls}`}>{v}</span>;

function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[{ label: 'E-데이터마켓', path: '/e-data/inventory' }, { label: '카본 마켓플레이스' }, { label: title }]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

/** 바깥 공식 사이트 — 새 탭 */
function OutLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      <Button variant="secondary" size="sm">
        <ExternalLink size={14} /> {label}
      </Button>
    </a>
  );
}

/** 표 — 칸 이름 · 줄(글자), widths 를 주면 위아래 표 칸 너비를 맞춘다 */
function TextTable({
  head,
  rows,
  keyCol = 0,
  widths,
}: {
  head: string[];
  rows: ReactNode[][];
  keyCol?: number;
  widths?: (string | undefined)[];
}) {
  type R = { i: number; cells: ReactNode[] };
  const cols: Column<R>[] = head.map((h, ci) => ({
    key: String(ci),
    header: h,
    width: widths?.[ci],
    render: (r) => (ci === keyCol ? cell(r.cells[ci], 'font-medium text-white') : cell(r.cells[ci])),
  }));
  return <DataTable data={rows.map((cells, i) => ({ i, cells }))} columns={cols} rowKey={(r) => r.i} />;
}

/** 파일 → data URL (POC — 파일 서버 대신) */
function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const MAX_MB = 2;
const nowText = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16).replace('T', ' ');

/** 오늘 YYYY-MM-DD (한국 시각) */
const today = () => nowText().slice(0, 10);

const base = (f: CarbonForm) => `${f.form}_${f.title.replace(/\//g, '·')}`;

/** 서식 파일 — 관리자가 올린 파일이 있으면 그것, 없으면 법제처 원본 */
function useFormFile(f: CarbonForm) {
  const up = useCarbonFormStore((s) => s.files[f.key]);
  const pdf = up?.pdf?.url ?? f.pdf;
  const last = [up?.pdf, up?.hwp]
    .filter((x) => x !== undefined)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  const from = up?.from ?? f.from;
  return {
    up,
    pdf,
    hwp: up?.hwp?.url ?? f.hwp,
    /** 저장된 문서 이름 — 올린 파일은 그 이름, 원본은 별지 · 서식 이름 (받을 때도 이 이름) */
    pdfName: up?.pdf?.name ?? `${base(f)}.pdf`,
    hwpName: up?.hwp?.name ?? `${base(f)}.hwpx`,
    /** 시행일 — 관리자가 넣은 날, 없으면 법제처 원본 시행일 */
    from,
    /** 아직 시행 전 — 미리 올린 서식 */
    before: from > today(),
    /** 올린 일시 · 올린 사람 (올린 적 없으면 없음) */
    uploaded: last ? `${last.at} 업로드 · ${last.by}` : undefined,
  };
}

/** 기준일 — 시행일, 시행 전이면 표시 */
function FormFrom({ f }: { f: CarbonForm }) {
  const { from, before } = useFormFile(f);
  return (
    <span className="inline-flex items-center gap-2">
      {from}
      {before && <Badge variant="warning">시행 전</Badge>}
    </span>
  );
}

/** 서식 업로드 — 파일(PDF · HWP 중 하나 이상) + 시행일 */
function FormUploadModal({ f, open, onClose }: { f: CarbonForm; open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const save = useCarbonFormStore((s) => s.save);
  const toast = useToastStore((s) => s.add);
  const ff = useFormFile(f);
  const [pick, setPick] = useState<Partial<Record<FormFileKind, File>>>({});
  const [from, setFrom] = useState(today());
  const pdfRef = useRef<HTMLInputElement>(null);
  const hwpRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setPick({});
    setFrom(ff.up?.from ?? today());
  }, [open, ff.up?.from]);

  const choose = (kind: FormFileKind, file?: File) => {
    if (!file) return;
    const ext = file.name.toLowerCase().split('.').pop() ?? '';
    const ok = kind === 'pdf' ? ext === 'pdf' : ext === 'hwp' || ext === 'hwpx';
    if (!ok) return toast('error', kind === 'pdf' ? 'PDF 파일만 올릴 수 있습니다' : 'HWP · HWPX 파일만 올릴 수 있습니다');
    if (file.size > MAX_MB * 1024 * 1024) return toast('error', `${MAX_MB}MB 이하 파일만 올릴 수 있습니다`);
    setPick((p) => ({ ...p, [kind]: file }));
  };
  // 새 파일이 하나는 있거나, 이미 올린 서식의 시행일만 고치는 경우
  const canSave = !!from && (!!pick.pdf || !!pick.hwp || !!ff.up);

  const onSave = async () => {
    try {
      const at = nowText();
      const by = user?.name ?? '관리자';
      const files: Partial<Record<FormFileKind, UploadedForm>> = {};
      for (const kind of ['pdf', 'hwp'] as const) {
        const file = pick[kind];
        if (file) files[kind] = { name: file.name, url: await toDataUrl(file), at, by };
      }
      save(f.key, from, files);
      toast('success', '서식을 저장했습니다');
      onClose();
    } catch {
      toast('error', '저장에 실패했습니다');
    }
  };

  const row = (kind: FormFileKind, label: string, accept: string, ref: React.RefObject<HTMLInputElement | null>) => (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-sm text-slate-400">{label}</span>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          choose(kind, e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>
        <Upload size={14} /> 파일 선택
      </Button>
      <span className="min-w-0 truncate text-sm text-slate-300">
        {pick[kind]?.name ?? (kind === 'pdf' ? ff.pdfName : ff.hwpName)}
      </span>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`서식 업로드 · ${f.title}`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" size="sm" disabled={!canSave} onClick={() => void onSave()}>
            저장
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {row('pdf', 'PDF', '.pdf', pdfRef)}
        {row('hwp', 'HWP', '.hwp,.hwpx', hwpRef)}
        <div className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-sm text-slate-400">시행일</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md bg-white/[0.04] px-3 py-1.5 text-sm text-white ring-1 ring-white/[0.1]"
          />
        </div>
      </div>
    </Modal>
  );
}

/** 서식 버튼 — 관리자 업로드 · 원본으로, 모두 HWP / PDF 받기 */
function FormButtons({ f }: { f: CarbonForm }) {
  const role = useGhgRole();
  const reset = useCarbonFormStore((s) => s.reset);
  const ff = useFormFile(f);
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {role.isAdmin && (
        <>
          {ff.up && (
            <Button variant="secondary" size="sm" onClick={() => reset(f.key)}>
              <RotateCcw size={14} /> 원본으로
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Upload size={14} /> 서식 업로드
          </Button>
          <FormUploadModal f={f} open={open} onClose={() => setOpen(false)} />
        </>
      )}
      {ff.hwp && (
        <a href={ff.hwp} download={ff.hwpName}>
          <Button variant="secondary" size="sm">
            <Download size={14} /> HWP
          </Button>
        </a>
      )}
      <a href={ff.pdf} download={ff.pdfName}>
        <Button variant="secondary" size="sm">
          <Download size={14} /> PDF
        </Button>
      </a>
      {/* 바깥 사이트는 파일 버튼과 떨어뜨려 오른쪽 끝에 */}
      {f.site && (
        <div className="ml-auto">
          <OutLink href={f.site.href} label={f.site.label} />
        </div>
      )}
    </div>
  );
}

/** 서식 원본 그대로 — 고치거나 다시 그리지 않는다. 보기는 세금계산서 원본과 같게(도구 막대 없이 너비 맞춤) */
function FormPdf({ f }: { f: CarbonForm }) {
  const { pdf } = useFormFile(f);
  return <iframe src={fitPdf(pdf)} title={f.form} className="w-full bg-white" style={PAPER} />;
}

/** 미리보기 머리 — 서식 이름 · 별지, 올린 적 있으면 올린 일시 · 올린 사람 */
function FormHead({ f }: { f: CarbonForm }) {
  const { uploaded } = useFormFile(f);
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">미리보기</p>
      <p className="truncate text-sm font-semibold text-white">
        {f.title} ({f.form})
      </p>
      {uploaded && <p className="mt-0.5 text-xs text-slate-500">{uploaded}</p>}
    </div>
  );
}

/** 서식 — 목록 왼쪽 · 원본 오른쪽(줄을 누르면 오른쪽이 그 서식으로), 명세서 화면과 같은 배치 */
function FormBoard({ forms, title = '서식' }: { forms: CarbonForm[]; title?: string }) {
  const [key, setKey] = useState(forms[0]?.key);
  const sel = forms.find((f) => f.key === key) ?? forms[0];
  const cols: Column<CarbonForm>[] = [
    {
      key: 'title',
      header: title,
      render: (f) => (
        <span className="inline-flex items-center gap-2">
          {f.ref && <Badge variant="info">참고</Badge>}
          {cell(f.title, 'font-medium text-white')}
        </span>
      ),
    },
    { key: 'from', header: '기준일', render: (f) => cell(<FormFrom f={f} />, 'whitespace-nowrap text-slate-300') },
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:grid-cols-[minmax(0,1fr)_560px]">
      <SectionCard title={title} noPadding className="min-w-0 !h-auto">
        <DataTable
          columns={cols}
          data={forms}
          rowKey={(f) => f.key}
          onRowClick={(f) => setKey(f.key)}
          rowClassName={(f) => (f.key === sel?.key ? '!bg-primary/10' : '')}
        />
      </SectionCard>
      {sel && (
        <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
          {/* 버튼이 많아 한 줄에 안 들어가니 제목 아래 줄로 */}
          <div className="space-y-3 border-b border-white/[0.06] px-5 py-3">
            <FormHead f={sel} />
            <FormButtons f={sel} />
          </div>
          <FormPdf key={sel.key} f={sel} />
        </div>
      )}
    </div>
  );
}

/* ══ 3.2.1 탄소배출권 정보 ══ */
export function CarbonInfoScreen() {
  // 위아래 표 칸 너비를 같게 — 근거 칸이 같은 자리에 오도록
  const widths = ['22%', undefined, '28%'];
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 정보" />
      <SectionCard title="거래 종목">
        <TextTable
          widths={widths}
          head={['종목', '정의', '근거']}
          rows={[
            ['KAU 할당배출권', '할당대상업체에 할당된 배출허용량. 이행연도별 상장', '법 제12조'],
            ['KCU 상쇄배출권', '외부사업 감축량에서 전환된 배출권. 전환은 할당대상업체만', '법 제29조'],
            ['KOC 외부사업 감축량', '할당대상업체 밖에서 줄여 정부 인증을 받은 실적', '법 제30조'],
          ]}
        />
      </SectionCard>
      <SectionCard title="참여 자격">
        <TextTable
          widths={widths}
          head={['구분', '거래 범위', '근거']}
          rows={[
            ['할당대상업체', 'KAU · KCU 장내 · 장외 거래, 상쇄배출권 전환', '법 제19조 · 거래 고시 제26조의2'],
            [
              '외부사업 사업자 (법인)',
              'KOC 인증 · 보유 · 이전, KRX 외부사업 감축량 전문회원(KOC 자기매매)',
              '지침 제37조 · KRX 운영규정 제12조',
            ],
            ['배출권거래중개회사 · 신탁업자 등', '중개 · 금융투자상품 목적 거래', '시행령 제31조'],
          ]}
        />
      </SectionCard>
      <SectionCard title="공식 사이트">
        <div className="flex flex-wrap gap-2">
          <OutLink href={LINKS.krxItems} label="KRX 거래종목" />
          <OutLink href={LINKS.krxMember} label="KRX 회원자격요건" />
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.2 탄소배출권 KRX 거래 — 시세는 KRX 화면으로(재게시 금지) ══ */
export function CarbonKrxScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 KRX 거래" />
      <SectionCard title="매매시간">
        <TextTable
          head={['구분', '시간']}
          rows={[
            ['호가접수', '09:00 ~ 12:00'],
            ['시가 단일가', '10:00'],
            ['복수가격 매매', '10:00 ~ 11:30'],
            ['종가 단일가', '12:00'],
            ['휴장', '토 · 일 · 공휴일 · 근로자의 날 · 12-31'],
          ]}
        />
      </SectionCard>
      <SectionCard title="KRX 회원 구분">
        <TextTable
          head={['회원 구분', '자격 대상', '거래 범위']}
          rows={[
            ['일반회원', '할당대상업체 · 시장조성자 등', 'KAU · KCU · KOC'],
            ['외부사업 감축량 전문회원', '법인인 외부사업 사업자', 'KOC 자기매매'],
            ['거래중개회원', '배출권거래중개회사(증권사)', '위탁 중개'],
          ]}
        />
      </SectionCard>
      <SectionCard title="공식 사이트">
        <div className="flex flex-wrap gap-2">
          <OutLink href={LINKS.krxPrice} label="KRX 시세조회" />
          <OutLink href={LINKS.krxBoard} label="KRX 공지사항" />
          <OutLink href={LINKS.krxHours} label="KRX 매매거래시간" />
          <OutLink href={LINKS.krxMember} label="KRX 회원자격요건" />
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.3 탄소배출권 장외거래 — 외부사업 인증실적 이전 신청서 서식. 신청은 기업이 직접 ══ */
export function CarbonOtcScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 장외거래" />
      <FormBoard title="문서" forms={[CARBON_FORMS.transfer]} />
    </div>
  );
}

/* ══ 3.2.4 탄소배출권 계약관리 — 장외 거래 신고서 서식. 신고는 기업이 직접 ══ */
export function CarbonContractScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 계약관리" />
      <FormBoard title="문서" forms={[CARBON_FORMS.otcReport]} />
    </div>
  );
}

/* ══ 3.2.5 외부감축사업 정보 — 참고 문서(방법론) · 사업계획서 · 승인 신청서 서식. 절차는 기업이 직접 ══ */
export function CarbonOffsetScreen() {
  return (
    <div className="space-y-6">
      <Header title="외부감축사업 정보" />
      <FormBoard title="문서" forms={[CARBON_FORMS.method, CARBON_FORMS.plan, CARBON_FORMS.approval]} />
    </div>
  );
}

/* ══ 3.2.6 외부감축사업 보고서 — 모니터링 보고서 · 인증신청서 서식 ══ */
export function CarbonOffsetReportScreen() {
  return (
    <div className="space-y-6">
      <Header title="외부감축사업 보고서" />
      <FormBoard forms={[CARBON_FORMS.monitoring, CARBON_FORMS.certify]} />
    </div>
  );
}
