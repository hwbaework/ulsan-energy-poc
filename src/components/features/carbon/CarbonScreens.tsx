'use client';

// E-데이터마켓 › 카본 마켓플레이스 — 연동 · 거래 실행 없음.
// 공식 공개 정보는 링크로 보내고, 서식은 법제처 원본 그대로 보여주고 받게 한다. 법령이 바뀌면 관리자가 새 서식을 올린다.
// 근거 · 절차: docs/카본마켓-조사.md (2026-10-08). 감축량은 온실가스 인벤토리와 같은 값(자가소비 설비만).

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
import { useGhgRole, useRows, type Role } from '@/components/features/ghg/GhgScreens';
import { fmt } from '@/lib/ghg-reduction';
import {
  CARBON_FORMS,
  LAST12,
  LINKS,
  METHOD,
  annualOf,
  scaleOf,
  selfFacilities,
  type CarbonForm,
} from '@/lib/carbon-docs';
import { fitPdf } from '@/lib/utils/fitPdf';

/* ── 공통 ── */
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`text-sm ${cls}`}>{v}</span>;
const num = (v: ReactNode) => <span className="whitespace-nowrap text-sm tabular-nums text-slate-300">{v}</span>;
const strong = (v: ReactNode) => (
  <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white">{v}</span>
);

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

const base = (f: CarbonForm) => `${f.form}_${f.title.replace('/', '·')}`;

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
      <a href={ff.hwp} download={ff.hwpName}>
        <Button variant="secondary" size="sm">
          <Download size={14} /> HWP
        </Button>
      </a>
      <a href={ff.pdf} download={ff.pdfName}>
        <Button variant="secondary" size="sm">
          <Download size={14} /> PDF
        </Button>
      </a>
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
function FormBoard({ forms }: { forms: CarbonForm[] }) {
  const [key, setKey] = useState(forms[0]?.key);
  const sel = forms.find((f) => f.key === key) ?? forms[0];
  const cols: Column<CarbonForm>[] = [
    { key: 'title', header: '서식', render: (f) => cell(f.title, 'font-medium text-white') },
    { key: 'from', header: '기준일', render: (f) => cell(<FormFrom f={f} />, 'whitespace-nowrap text-slate-300') },
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:grid-cols-[minmax(0,1fr)_560px]">
      <SectionCard title="서식" noPadding className="min-w-0 !h-auto">
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

/** 기업별 외부사업 규모 — 최근 12개월 자가소비 감축량 */
function ScaleCard({ role }: { role: Role }) {
  const { rows } = useRows();
  const list = role.companies.map((c) => {
    const a = annualOf(rows, c.id);
    const kw = selfFacilities(role.facilities, c.id).reduce((x, f) => x + f.kw, 0);
    return { ...c, kw, ...a };
  });
  const sum = list.reduce((a, c) => a + c.tco2, 0);
  type R = (typeof list)[number];
  const cols: Column<R>[] = [
    { key: 'name', header: '기업', render: (c) => cell(c.name, 'font-medium text-white') },
    { key: 'kw', header: '자가소비 설비 (kW)', align: 'right', render: (c) => num(fmt(c.kw, 2)) },
    { key: 'mwh', header: '연 발전량 (MWh)', align: 'right', render: (c) => num(fmt(c.mwh, 1)) },
    {
      key: 'tco2',
      header: '연 감축량 (tCO₂eq)',
      align: 'right',
      sortable: true,
      sortValue: (c) => c.tco2,
      render: (c) => strong(fmt(c.tco2, 2)),
    },
    { key: 'scale', header: '사업 규모', render: (c) => cell(scaleOf(c.tco2)) },
  ];
  return (
    <SectionCard title={`기업별 외부사업 규모 (${list.length})`} description={`${LAST12[0]} ~ ${LAST12[1]}`}>
      <DataTable data={list} columns={cols} rowKey={(c) => c.id} />
      {role.isAdmin && list.length > 1 && (
        <div className="flex justify-end gap-6 border-t border-white/[0.06] px-5 py-3 text-sm">
          <span className="text-slate-400">합계</span>
          <span className="font-medium tabular-nums text-white">{fmt(sum, 2)} tCO₂eq</span>
          <span className="text-slate-300">묶음 {sum <= 500 ? '극소규모' : '소규모'}</span>
        </div>
      )}
    </SectionCard>
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

/* ══ 3.2.3 탄소배출권 장외거래 — 우리 기업은 KOC 이전 ══ */
export function CarbonOtcScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 장외거래" />
      <SectionCard title="장외거래 구분">
        <TextTable
          head={['거래 대상', '거래 주체', '신청 · 신고 절차', '근거']}
          rows={[
            [
              'KOC (외부사업 인증실적)',
              '외부사업 참여자 (상쇄등록부 보유계정 법인)',
              '양도인이 이전신청서 · 계약 증빙자료를 상쇄등록부에 전자 제출',
              '지침 제37조',
            ],
            [
              'KAU · KCU (배출권)',
              '할당대상업체 · 배출권거래중개회사 · 신탁업자',
              '양도인이 장외거래 신고서 · 공증 서류를 배출권등록부에 제출',
              '거래 고시 제26조의2 · 제27조',
            ],
          ]}
        />
      </SectionCard>
      <FormBoard forms={[CARBON_FORMS.transfer]} />
    </div>
  );
}

/* ══ 3.2.4 탄소배출권 계약관리 — 거래 신고 항목 · 절차 · 신고서 서식 ══ */
export function CarbonContractScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 계약관리" />
      <SectionCard title="계약 · 신고 필수 항목">
        <TextTable
          head={['항목', '근거']}
          rows={[
            ['배출권 종류 · 이행연도', '시행령 제33조제1항'],
            ['수량 (tCO₂eq) · 가격 (원)', '시행령 제33조제1항'],
            ['거래 일시', '시행령 제33조제1항'],
            ['양도인 · 양수인 법인 정보', '거래 고시 별지 제7호'],
            ['거래 합의 공증서류', '거래 고시 제27조제2항'],
          ]}
        />
      </SectionCard>
      <SectionCard title="신고 절차">
        <TextTable
          head={['단계', '내용', '근거']}
          rows={[
            ['1. 거래', '양도인 · 양수인 합의, 공증', '거래 고시 제27조'],
            ['2. 신고', '양도인이 거래 후 지체 없이 배출권등록부에 신고서 제출', '거래 고시 제27조제1항'],
            ['3. 승인', '기후에너지환경부장관 승인 → 온실가스종합정보센터 통지', '시행령 제33조제3항'],
            ['4. 이전', '양도인 계정 → 양수인 계정, 등록 시 효력', '법 제21조'],
          ]}
        />
      </SectionCard>
      <FormBoard forms={[CARBON_FORMS.otcReport]} />
    </div>
  );
}

/* ══ 3.2.5 외부감축사업 정보 — 조건 · 방법론 · 절차 · 사업계획서 · 승인 신청서 서식 ══ */
export function CarbonOffsetScreen() {
  const role = useGhgRole();
  return (
    <div className="space-y-6">
      <Header title="외부감축사업 정보" />
      <SectionCard title="신청 조건">
        <TextTable
          head={['조건', '내용', '근거']}
          rows={[
            ['조직경계 밖', '할당대상업체가 아닌 기업(또는 조직경계 밖)의 감축', '지침 제2조제1호 · 제8조제2항'],
            ['시작 시점', '2016-12-03 이후 시작한 사업', '법 제30조제1항'],
            ['의무 설치 아님', '다른 법령 의무로 설치한 설비가 아닐 것', '지침 제8조제2항제4호'],
            ['추가성', '연 60,000 t 이하 사업은 법적 · 제도적 추가성만', '지침 제14조'],
            ['승인 방법론', `${METHOD.code} 등 인증위원회 승인 방법론`, '지침 제8조제2항제7호'],
            ['중복 금지', 'REC · RE100 등 다른 제도와 같은 감축량을 함께 쓰지 않을 것', '시행령 제49조제5항'],
          ]}
        />
      </SectionCard>
      <SectionCard title="적용 방법론">
        <TextTable
          head={['고유번호', '방법론', '유효 시작일']}
          rows={[
            [METHOD.code, METHOD.name, METHOD.from],
            [
              '01B-008-Ver01',
              '전력 자가사용 및 독립된 소규모 계통 연계를 위한 재생에너지 발전사업의 방법론',
              '2020-06-05',
            ],
            ['01B-004-Ver01', '재생에너지를 이용한 전력 생산 및 자가 사용 사업의 방법론', '2016-05-26'],
          ]}
        />
      </SectionCard>
      <SectionCard title="절차">
        <TextTable
          head={['단계', '내용', '기한', '서류']}
          rows={[
            ['0. 보유계정', '상쇄등록부 보유계정 등록', '', '별지 제36호'],
            [
              '1. 승인 신청',
              '사업계획서 · 승인 신청서 제출 → 타당성 평가',
              '평가 30일 (연장 30일)',
              '별지 제1호 · 제5호',
            ],
            ['2. 승인', '기후에너지환경부 협의 → 인증위원회 → 승인서', '협의 30일', ''],
            ['3. 착수신고', '승인일부터 1년 안에 사업 시작', '1년', '별지 제16호'],
            ['4. 모니터링', '발전량 수집 → 모니터링 보고서', '기간 종료 후 12개월', '별지 제17호'],
            ['5. 검증', '지정 검증기관 검증', '', '검증보고서'],
            ['6. 인증 신청', '감축량 인증신청서 (1 t 이상, 정수)', '검토 30일', '별지 제18호'],
            ['7. KOC 발행 · 판매', 'KRX 전문회원 매매 또는 장외 이전', '', '별지 제22호'],
          ]}
        />
      </SectionCard>
      <ScaleCard role={role} />
      <FormBoard forms={[CARBON_FORMS.plan, CARBON_FORMS.approval]} />
      <SectionCard title="공식 사이트">
        <div className="flex flex-wrap gap-2">
          <OutLink href={LINKS.orsMethod} label="방법론 현황" />
        </div>
      </SectionCard>
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
