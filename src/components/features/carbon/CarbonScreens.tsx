'use client';

// E-데이터마켓 › 카본 마켓플레이스 — 연동 · 거래 실행 없음.
// 공식 공개 정보는 링크로 보내고, 서식은 법제처 원본 그대로 보여주고 받게 한다. 법령이 바뀌면 관리자가 새 서식을 올린다.
// 근거 · 절차: docs/카본마켓-조사.md (2026-10-08).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Copy, Download, ExternalLink, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { PAPER } from '@/components/features/trading-poc/BillingPaper';
import { useAuthStore } from '@/stores/useAuthStore';
import { useCarbonInfoStore } from '@/stores/useCarbonInfoStore';
import { useCarbonFormStore, type FormFileKind, type UploadedForm } from '@/stores/useCarbonFormStore';
import { useToastStore } from '@/stores/useToastStore';
import { contractGroups, useGhgRole, useRows } from '@/components/features/ghg/GhgScreens';
import { GHG_TODAY, fmt, fmtT, totalsOf } from '@/lib/ghg-reduction';
import { CARBON_FORMS, LINKS, type CarbonForm } from '@/lib/carbon-docs';
import { useCompany } from '@/hooks/platform/useCompanies';
import { Select } from '@/components/ui/Select';
import { fillHwpx, type HwpxCell, type HwpxReplace } from '@/lib/utils/fillHwpx';
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

/** 공식 사이트 — 관리자가 [수정]으로 이름 · 주소를 고치고 더하고 지운다(기본은 코드의 줄). 누르면 새 탭 */
function SiteLinks({ id, rows }: { id: string; rows: string[][] }) {
  return (
    <EditTable
      id={id}
      title="공식 사이트"
      head={['이름', '주소']}
      widths={['30%', undefined]}
      rows={rows}
      check={(rs) =>
        rs.some(([name, url]) => !name || !/^https?:\/\/\S+$/.test(url ?? ''))
          ? '이름과 http:// 또는 https:// 로 시작하는 주소를 모두 넣어 주세요'
          : null
      }
      view={(rs) => (
        <div className="flex flex-wrap gap-2 p-4">
          {rs.map(([name, url], i) => (
            <OutLink key={`${i}-${name}`} href={url ?? ''} label={name ?? ''} />
          ))}
        </div>
      )}
    />
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

/** 표 편집 칸 — 에너지 설정과 같은 모양 */
const FIELD =
  'h-9 min-w-0 flex-1 rounded-md bg-white/[0.04] ring-1 ring-white/[0.08] px-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-primary/60';

/** 정보 표 — 모두 보기, 관리자는 [수정]으로 줄을 고치고(추가 · 삭제) 저장. 칸 이름은 고정 */
function EditTable({
  id,
  title,
  head,
  rows: defaults,
  widths,
  view,
  check,
}: {
  id: string;
  title: string;
  head: string[];
  rows: string[][];
  widths?: (string | undefined)[];
  /** 보기 모양 — 없으면 표 */
  view?: (rows: string[][]) => ReactNode;
  /** 저장 전 검사 — 문제가 있으면 알림 글자, 없으면 null */
  check?: (rows: string[][]) => string | null;
}) {
  const role = useGhgRole();
  const saved = useCarbonInfoStore((s) => s.rows[id]);
  const setRows = useCarbonInfoStore((s) => s.setRows);
  const toast = useToastStore((s) => s.add);
  const rows = saved ?? defaults;
  const [draft, setDraft] = useState<string[][] | null>(null);
  /** 삭제 확인할 줄 */
  const [ask, setAsk] = useState<number | null>(null);

  const cellAt = (r: number, c: number, v: string) =>
    setDraft((d) => d && d.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));
  const save = () => {
    if (!draft) return;
    const next = draft.filter((row) => row.some((x) => x.trim())).map((row) => row.map((x) => x.trim()));
    const bad = check?.(next);
    if (bad) {
      toast('error', bad);
      return;
    }
    setRows(id, next);
    setDraft(null);
    toast('success', `${title}을(를) 저장했습니다`);
  };

  const actions = !role.isAdmin ? undefined : draft ? (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => setDraft([...draft, head.map(() => '')])}>
        <Plus size={14} className="mr-1" /> 줄 추가
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setDraft(null)}>
        취소
      </Button>
      <Button size="sm" variant="primary" onClick={save}>
        저장
      </Button>
    </div>
  ) : (
    <Button size="sm" variant="secondary" onClick={() => setDraft(rows.map((r) => [...r]))}>
      <Pencil size={14} className="mr-1" /> 수정
    </Button>
  );

  return (
    <SectionCard title={title} actions={actions} noPadding>
      {draft ? (
        <div className="space-y-2 p-4">
          {draft.map((row, ri) => (
            <div key={ri} className="flex items-center gap-2">
              {row.map((v, ci) => (
                <input
                  key={ci}
                  aria-label={head[ci]}
                  value={v}
                  placeholder={head[ci]}
                  onChange={(e) => cellAt(ri, ci, e.target.value)}
                  style={widths?.[ci] ? { width: widths[ci], flex: 'none' } : undefined}
                  className={FIELD}
                />
              ))}
              <button
                type="button"
                aria-label={`${row[0] || '줄'} 삭제`}
                onClick={() => setAsk(ri)}
                className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : view ? (
        view(rows)
      ) : (
        <TextTable head={head} rows={rows} widths={widths} />
      )}
      <ConfirmDialog
        open={ask !== null}
        onClose={() => setAsk(null)}
        onConfirm={() => {
          setDraft((d) => d && d.filter((_, i) => i !== ask));
          setAsk(null);
        }}
        title="줄 삭제"
        message={`'${(ask !== null && draft?.[ask]?.[0]) || '이 줄'}'을(를) 지웁니다. [저장]을 눌러야 반영됩니다.`}
        confirmLabel="삭제"
        variant="danger"
      />
    </SectionCard>
  );
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
  const last = [up?.pdf, up?.hwp, up?.xls]
    .filter((x) => x !== undefined)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  const from = up?.from ?? f.from;
  return {
    up,
    pdf,
    hwp: up?.hwp?.url ?? f.hwp,
    xls: up?.xls?.url ?? f.xls,
    /** 저장된 문서 이름 — 올린 파일은 그 이름, 원본은 별지 · 서식 이름 (받을 때도 이 이름) */
    pdfName: up?.pdf?.name ?? f.pdfName ?? `${base(f)}.pdf`,
    hwpName: up?.hwp?.name ?? f.hwpName ?? `${base(f)}.hwpx`,
    xlsName: up?.xls?.name ?? f.xlsName ?? `${f.title}.xls`,
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

/** 문서 팝업 — 문서 등록 · 업로드가 같은 칸(문서 이름 · 구분 · 시행일 · 파일).
 *  추가(f 없음): 다 비워 두고 파일은 HWP 또는 엑셀(XLS · XLSX). 업로드(f 있음): 이름 · 구분은 그 문서 값(고치지 않음), 파일은 그 문서와 같은 종류만.
 *  PDF 는 받지 않는다 — 원본(법제처 · 공식 사이트) 서식만 미리보기 */
function FormModal({ board, f, open, onClose }: { board: string; f?: CarbonForm; open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const add = useCarbonFormStore((s) => s.add);
  const save = useCarbonFormStore((s) => s.save);
  const toast = useToastStore((s) => s.add);
  const ff = useFormFile(f ?? EMPTY_FORM);
  const [title, setTitle] = useState('');
  const [no, setNo] = useState('');
  const [from, setFrom] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setTitle(f?.title ?? '');
    setNo(f?.form ?? '');
    setFrom(f ? (ff.up?.from ?? today()) : today());
    setFile(null);
  }, [open, f, ff.up?.from]);

  // 업로드는 그 문서와 같은 종류만, 추가는 둘 다
  const kinds: ('hwp' | 'xls')[] = f ? [f.xls ? 'xls' : 'hwp'] : ['hwp', 'xls'];
  const kindOf = (name: string): 'hwp' | 'xls' | null => {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    return ext === 'hwp' || ext === 'hwpx' ? 'hwp' : ext === 'xls' || ext === 'xlsx' ? 'xls' : null;
  };
  const accept = kinds.map((k) => (k === 'hwp' ? '.hwp,.hwpx' : '.xls,.xlsx')).join(',');
  const choose = (picked?: File) => {
    if (!picked) return;
    const k = kindOf(picked.name);
    if (!k || !kinds.includes(k)) {
      return toast('error', kinds.length > 1 ? 'HWP, 엑셀 파일만 올릴 수 있습니다' : kinds[0] === 'xls' ? '엑셀 파일만 올릴 수 있습니다' : 'HWP 파일만 올릴 수 있습니다');
    }
    if (picked.size > MAX_MB * 1024 * 1024) return toast('error', `${MAX_MB}MB 이하 파일만 올릴 수 있습니다`);
    setFile(picked);
  };
  // 추가는 전부 필수, 업로드는 새 파일 또는(이미 올린 서식의) 시행일만 고치기
  const canSave = !!from && (f ? !!file || !!ff.up : !!title.trim() && !!no.trim() && !!file);

  const onSave = async () => {
    try {
      if (!f) {
        if (!file) return;
        const k = kindOf(file.name);
        const url = await toDataUrl(file);
        const form: CarbonForm = {
          key: `custom-${Date.now()}`,
          title: title.trim(),
          form: no.trim(),
          basis: '',
          from,
          pdf: '',
          ...(k === 'xls' ? { xls: url, xlsName: file.name } : { hwp: url, hwpName: file.name }),
          custom: true,
        };
        add(board, form);
        toast('success', `${form.title} 문서를 등록했습니다`);
      } else {
        const k = f.xls ? 'xls' : 'hwp';
        const files: Partial<Record<FormFileKind, UploadedForm>> = {};
        if (file) files[k] = { name: file.name, url: await toDataUrl(file), at: nowText(), by: user?.name ?? '관리자' };
        save(f.key, from, files);
        toast('success', '문서를 저장했습니다');
      }
      onClose();
    } catch {
      toast('error', '저장에 실패했습니다');
    }
  };

  const label = (text: string) => <span className="w-16 shrink-0 text-sm text-slate-400">{text}</span>;
  const textRow = (text: string, value: string, set: (v: string) => void, placeholder = '') => (
    <label className="flex items-center gap-3">
      {label(text)}
      <input aria-label={text} value={value} placeholder={placeholder} disabled={!!f} onChange={(e) => set(e.target.value)} className={`${FIELD} disabled:opacity-60`} />
    </label>
  );
  const current = f ? (f.xls ? ff.xlsName : ff.hwpName) : '';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={f ? '문서 업로드' : '문서 등록'}
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
      <div className="space-y-3">
        {textRow('문서 이름', title, setTitle)}
        {textRow('구분', no, setNo, '별지 제00호서식')}
        <div className="flex items-center gap-3">
          {label('시행일')}
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-md bg-white/[0.04] px-3 py-1.5 text-sm text-white ring-1 ring-white/[0.1]"
          />
        </div>
        <div className="flex items-center gap-3">
          {label('파일')}
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              choose(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> 파일 선택
          </Button>
          <span className="min-w-0 truncate text-sm text-slate-300">{file?.name ?? current}</span>
        </div>
      </div>
    </Modal>
  );
}

/** 훅 순서를 지키려고 업로드 대상이 없을 때(문서 등록) 쓰는 빈 서식 */
const EMPTY_FORM: CarbonForm = { key: '', title: '', form: '', basis: '', from: '', pdf: '' };

/** 문서 줄의 관리 — [업로드] · [원본으로](원본 서식을 바꿨을 때) · [삭제](추가한 서식) */
function FormRowActions({ board, f }: { board: string; f: CarbonForm }) {
  const reset = useCarbonFormStore((s) => s.reset);
  const remove = useCarbonFormStore((s) => s.remove);
  const toast = useToastStore((s) => s.add);
  const ff = useFormFile(f);
  const [upOpen, setUpOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      {(!f.ref || f.xls) && (
        <Button variant="secondary" size="sm" onClick={() => setUpOpen(true)}>
          <Upload size={14} /> 업로드
        </Button>
      )}
      {ff.up && !f.custom && (
        <Button variant="secondary" size="sm" onClick={() => reset(f.key)}>
          <RotateCcw size={14} /> 원본으로
        </Button>
      )}
      {f.custom && (
        <Button variant="secondary" size="sm" onClick={() => setAsk(true)}>
          <Trash2 size={14} /> 삭제
        </Button>
      )}
      <FormModal board={board} f={f} open={upOpen} onClose={() => setUpOpen(false)} />
      <ConfirmDialog
        open={ask}
        onClose={() => setAsk(false)}
        onConfirm={() => {
          remove(board, f.key);
          setAsk(false);
          toast('success', `${f.title} 문서를 삭제했습니다`);
        }}
        title="문서 삭제"
        message={`'${f.title}'을(를) 지웁니다. 올린 파일도 함께 지워집니다.`}
        confirmLabel="삭제"
        variant="danger"
      />
    </div>
  );
}

/** 서식 버튼 — HWP 받기(채울 수 있는 서식은 값이 들어간 HWP), 참고 문서만 PDF */
function FormButtons({ f, companyId }: { f: CarbonForm; companyId: number }) {
  const ff = useFormFile(f);
  const fill = useFill(f, companyId);
  const toast = useToastStore((s) => s.add);
  // 채울 수 있는 서식(원본)이면 기업 값이 들어간 HWP 를 받는다
  const onHwp = async () => {
    if (!fill || !ff.hwp) return;
    try {
      const blob = await fillHwpx(ff.hwp, fill.cells, fill.replaces);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${base(f)}_${fill.company}.hwpx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch {
      toast('error', 'HWP 를 만들지 못했습니다');
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ff.hwp &&
        (fill ? (
          <Button variant="secondary" size="sm" onClick={() => void onHwp()}>
            <Download size={14} /> 다운로드
          </Button>
        ) : (
          <a href={ff.hwp} download={ff.hwpName}>
            <Button variant="secondary" size="sm">
              <Download size={14} /> 다운로드
            </Button>
          </a>
        ))}
      {ff.xls && (
        <a href={ff.xls} download={ff.xlsName}>
          <Button variant="secondary" size="sm">
            <Download size={14} /> 다운로드
          </Button>
        </a>
      )}
      {/* 서식은 기업이 채워 내는 것이라 HWP 만 받는다. 원문이 PDF 뿐인 참고 문서(방법론)만 PDF */}
      {!ff.hwp && ff.pdf && (
        <a href={ff.pdf} download={ff.pdfName}>
          <Button variant="secondary" size="sm">
            <Download size={14} /> 다운로드
          </Button>
        </a>
      )}
    </div>
  );
}

/** 서식 채움 — 원본 서식의 HWP 칸(표 · 열 · 행)에 값을 넣어 받는다. 미리보기는 원본 그대로, 값은 '작성 정보' 칸에서 본다.
 *  원본 서식을 고정해 두고 한 번 맞춘다. 관리자가 새로 올리거나 추가한 서식은 칸이 달라 채우지 않는다(보기 · 받기만).
 *  기업이 늘어나는 건 그대로 된다(값은 기업 정보 · 내 계정에서) */
type FillKey = 'name' | 'bizNo' | 'rep' | 'staffName' | 'staffDept' | 'staffPos' | 'staffPhone' | 'staffEmail';
type FillDoc = {
  cells: (Omit<HwpxCell, 'text'> & { key: FillKey })[];
  /** 표 안 글자 바꾸기 — 값으로 만든 글자 */
  replaces: (v: Record<FillKey, string> & { date: string }) => HwpxReplace[];
};
const FILL: Record<string, FillDoc> = {
  // 외부사업 인증실적 이전 신청서(별지 제22호) — 1쪽 양도인 신청서, 2쪽 양수인 신청서. 우리 기업 = 양도인.
  // 양수인 · 이전 신청량은 플랫폼이 모르니 비워 두고 직접 쓴다 — 양수인은 플랫폼 밖 기업일 수도, 신청량은 인증받은 실적(기간별) 중 넘길 양
  transfer: {
    cells: [
      // 1쪽 — 양도인 정보
      { key: 'name', table: 0, col: 2, row: 2 },
      { key: 'bizNo', table: 0, col: 2, row: 3 },
      // 2쪽 — 양도인 정보(담당자 = 내 계정)
      { key: 'name', table: 1, col: 2, row: 6 },
      { key: 'bizNo', table: 1, col: 2, row: 7 },
      { key: 'rep', table: 1, col: 2, row: 8 },
      { key: 'staffName', table: 1, col: 3, row: 9 },
      { key: 'staffDept', table: 1, col: 5, row: 9 },
      { key: 'staffPos', table: 1, col: 7, row: 9 },
      { key: 'staffPhone', table: 1, col: 3, row: 10 },
      { key: 'staffEmail', table: 1, col: 6, row: 10 },
    ],
    replaces: (v) => [
      // 날짜 · 서명란 — 1쪽 양도인(우리)만
      { table: 0, find: '  년    월    일', text: v.date },
      { table: 0, find: '양 도 인 : (법인명/사업장명)   ', text: v.name ? `양 도 인 : ${v.name}   ` : '' },
      { table: 0, find: '           (법인/사업장 대표자명) (서명 또는 인)', text: v.rep ? `           ${v.rep} (서명 또는 인)` : '' },
    ],
  },
};

/** 플랫폼 기업 목록(계약 단위 묶음의 기업) */
function usePlatformCompanies() {
  const role = useGhgRole();
  return [...new Map(contractGroups(role.facilities).map((g) => [g.companyId, g.fs[0]!.company])).entries()];
}

/** 작성 정보 값 — 기업 · 내 계정 · 설비 · 감축량 */
function useFormInfo(companyId: number) {
  const role = useGhgRole();
  const user = useAuthStore((s) => s.user);
  const { rows } = useRows();
  const { data: co } = useCompany(companyId);
  const fs = role.facilities.filter((x) => x.companyId === companyId && x.status === 'ACTIVE');
  const mine = rows.filter((r) => r.facility.companyId === companyId);
  // 담당자 — 그 기업 계정일 때만 내 계정(관리자는 그 기업 직원이 아님)
  const staff = !role.isAdmin && user?.companyId === companyId ? user : null;
  const d = GHG_TODAY.split('-').map(Number);
  return {
    co,
    values: {
      name: co?.name ?? '',
      bizNo: co?.businessNumber ?? '',
      rep: co?.representativeName ?? '',
      staffName: staff?.name ?? '',
      staffDept: staff?.department ?? '',
      staffPos: staff?.position ?? '',
      staffPhone: staff?.phone ?? '',
      staffEmail: staff?.email ?? '',
    } satisfies Record<FillKey, string>,
    address: co?.address ?? '',
    kw: fs.length ? `${fmt(fs.reduce((a, x) => a + x.kw, 0), 2)} kW (${[...new Set(fs.map((x) => x.kind))].join(', ')})` : '',
    start: fs.map((x) => x.startDate).sort()[0] ?? '',
    total: fs.length ? `${fmtT(totalsOf(mine).tco2)} tCO₂eq` : '',
    thisYear: fs.length ? `${fmtT(totalsOf(mine.filter((r) => r.month.startsWith(GHG_TODAY.slice(0, 4)))).tco2)} tCO₂eq` : '',
    date: `  ${d[0]} 년  ${d[1]} 월  ${d[2]} 일`,
  };
}

/** 채울 수 있는 서식(원본 그대로)이면 HWP 에 넣을 칸 · 글자, 아니면 null */
function useFill(f: CarbonForm, companyId: number) {
  const ff = useFormFile(f);
  const info = useFormInfo(companyId);
  const doc = FILL[f.key];
  if (!doc || ff.up || f.custom || !info.co) return null;
  const v = info.values;
  return {
    company: v.name,
    cells: doc.cells.map(({ key, ...c }) => ({ ...c, text: v[key] })),
    replaces: doc.replaces({ ...v, date: info.date }),
  };
}

/** 원본 서식 그대로 — 값은 얹지 않는다(값은 작성 정보 칸, 넣는 건 HWP). 새로 올린 HWP · 추가한 서식은 미리보기 없음 */
function FormPdf({ f }: { f: CarbonForm }) {
  const ff = useFormFile(f);
  // 추가 · 새로 올린 서식, PDF 가 없는 자료(엑셀)는 미리보기 없음
  if (f.custom || (ff.up && !f.ref) || !ff.pdf) {
    return <div className="flex h-60 items-center justify-center text-sm text-slate-400">미리보기 없음</div>;
  }
  return <iframe src={fitPdf(ff.pdf)} title={f.form} className="w-full bg-white" style={PAPER} />;
}

/** 작성 정보 — 접었다 폈다. 플랫폼이 가진 값만 파란 글자로(복사). 모르는 값(양수인 · 신청량 등)은 서식에 직접 쓴다 */
function FormInfoPanel({ companyId, onCompany }: { companyId: number; onCompany: (id: number) => void }) {
  const role = useGhgRole();
  const toast = useToastStore((s) => s.add);
  const companies = usePlatformCompanies();
  const info = useFormInfo(companyId);
  const [open, setOpen] = useState(false);
  const v = info.values;
  const groups: [string, [string, string][]][] = [
    ['기업', [['법인명', v.name], ['사업자등록번호', v.bizNo], ['대표자', v.rep], ['소재지', info.address]]],
    ['담당자', [['성명', v.staffName], ['부서', v.staffDept], ['직위', v.staffPos], ['전화', v.staffPhone], ['E-mail', v.staffEmail]]],
    ['설비 · 감축량', [['설비 용량', info.kw], ['가동일', info.start], ['누적 감축량', info.total], ['금년 감축량', info.thisYear]]],
  ];
  const copy = (text: string) => {
    void navigator.clipboard
      ?.writeText(text)
      .then(() => toast('success', '복사했습니다'))
      .catch(() => toast('error', '복사하지 못했습니다'));
  };
  return (
    <div className="border-b border-white/[0.06] px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-blue-300">
          <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} /> 작성 정보
        </button>
        {role.isAdmin && companies.length > 0 && (
          <div className="w-52">
            <Select
              options={companies.map(([id, name]) => ({ value: String(id), label: name }))}
              value={String(companyId)}
              onChange={(e) => onCompany(Number(e.target.value))}
            />
          </div>
        )}
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          {groups.map(([g, items]) => (
            <div key={g}>
              <p className="mb-1 text-xs text-slate-500">{g}</p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
                {items.map(([k, val]) => (
                  <div key={k} className="contents">
                    <dt className="text-slate-400">{k}</dt>
                    <dd className={`truncate ${val ? 'text-blue-300' : 'text-slate-500'}`}>{val || '-'}</dd>
                    <span>
                      {val && (
                        <button type="button" aria-label={`${k} 복사`} onClick={() => copy(val)} className="rounded p-1 text-slate-500 hover:bg-white/[0.06] hover:text-white">
                          <Copy size={13} />
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
function FormBoard({
  board,
  forms: base,
  title = '문서',
  info = true,
}: {
  board: string;
  forms: CarbonForm[];
  title?: string;
  /** 작성 정보 칸 — 우리 기업이 쓰지 않는 서식만 있는 화면(장외거래)은 끈다 */
  info?: boolean;
}) {
  const role = useGhgRole();
  const added = useCarbonFormStore((s) => s.added[board]);
  const forms = [...base, ...(added ?? [])];
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState(forms[0]?.key);
  // 채울 기업 — 관리자는 셀렉트(처음엔 첫 기업), 기업 계정은 자기 기업
  const firstCompany = contractGroups(role.facilities)[0]?.companyId ?? 0;
  const [picked, setPicked] = useState<number | null>(null);
  const companyId = role.isAdmin ? (picked ?? firstCompany) : role.myId;
  const sel = forms.find((f) => f.key === key) ?? forms[0];
  // 기준일 · 관리 칸은 들어갈 것만큼만 — 시행 전 표시 · 버튼 2개(원본으로 / 삭제)인 줄이 있을 때만 넓혀 문서 이름 칸을 넉넉하게
  const files = useCarbonFormStore((s) => s.files);
  const anyBefore = forms.some((f) => (files[f.key]?.from ?? f.from) > today());
  const anyTwo = forms.some((f) => f.custom || (files[f.key] && (!f.ref || f.xls)));
  const cols: Column<CarbonForm>[] = [
    {
      key: 'title',
      header: title,
      render: (f) => (
        // 긴 문서 이름은 … 로 줄이고(전체는 마우스 올리면), 기준일 · 관리 칸은 폭 고정
        <span className="flex min-w-0 items-center gap-2" title={f.title}>
          <span className="min-w-0 truncate text-sm font-medium text-white">{f.title}</span>
        </span>
      ),
    },
    { key: 'from', header: '기준일', width: anyBefore ? '170px' : '120px', render: (f) => cell(<FormFrom f={f} />, 'whitespace-nowrap text-slate-300') },
    ...(role.isAdmin
      ? [{ key: 'manage', header: '', width: anyTwo ? '220px' : '120px', align: 'right' as const, render: (f: CarbonForm) => <FormRowActions board={board} f={f} /> }]
      : []),
  ];
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] xl:grid-cols-[minmax(0,1fr)_560px]">
      <SectionCard
        title={title}
        actions={
          role.isAdmin ? (
            <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> 문서 등록
            </Button>
          ) : undefined
        }
        noPadding
        className="min-w-0 !h-auto"
      >
        <DataTable
          columns={cols}
          data={forms}
          rowKey={(f) => f.key}
          onRowClick={(f) => setKey(f.key)}
          rowClassName={(f) => (f.key === sel?.key ? '!bg-primary/10' : '')}
        />
        <FormModal board={board} open={addOpen} onClose={() => setAddOpen(false)} />
      </SectionCard>
      {sel && (
        <div className="min-w-0 overflow-hidden rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] md:sticky md:top-4">
          {/* 버튼이 많아 한 줄에 안 들어가니 제목 아래 줄로 */}
          <div className="space-y-3 border-b border-white/[0.06] px-5 py-3">
            <FormHead f={sel} />
            <FormButtons f={sel} companyId={companyId} />
          </div>
          {info && !sel.ref && <FormInfoPanel key={`info-${sel.key}`} companyId={companyId} onCompany={setPicked} />}
          <FormPdf key={`pdf-${sel.key}`} f={sel} />
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
      <EditTable
        id="items"
        title="거래 종목"
        widths={widths}
        head={['종목', '정의', '근거']}
        rows={[
          ['KAU 할당배출권', '할당대상업체에 할당된 배출허용량. 이행연도별 상장', '법 제12조'],
          ['KCU 상쇄배출권', '외부사업 감축량에서 전환된 배출권. 전환은 할당대상업체만', '법 제29조'],
          ['KOC 외부사업 감축량', '할당대상업체 밖에서 줄여 정부 인증을 받은 실적', '법 제30조'],
        ]}
      />
      <EditTable
        id="members"
        title="참여 자격"
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
      <SiteLinks
        id="sites-info"
        rows={[
          ['KRX 거래종목', LINKS.krxItems],
          ['KRX 회원자격요건', LINKS.krxMember],
        ]}
      />
    </div>
  );
}

/* ══ 3.2.2 탄소배출권 KRX 거래 — 시세는 KRX 화면으로(재게시 금지) ══ */
export function CarbonKrxScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 KRX 거래" />
      <EditTable
        id="hours"
        title="매매시간"
        head={['구분', '시간']}
        rows={[
          ['호가접수', '09:00 ~ 12:00'],
          ['시가 단일가', '10:00'],
          ['복수가격 매매', '10:00 ~ 11:30'],
          ['종가 단일가', '12:00'],
          ['휴장', '토 · 일 · 공휴일 · 근로자의 날 · 12-31'],
        ]}
      />
      <EditTable
        id="krxMembers"
        title="KRX 회원 구분"
        head={['회원 구분', '자격 대상', '거래 범위']}
        rows={[
          ['일반회원', '할당대상업체 · 시장조성자 등', 'KAU · KCU · KOC'],
          ['외부사업 감축량 전문회원', '법인인 외부사업 사업자', 'KOC 자기매매'],
          ['거래중개회원', '배출권거래중개회사(증권사)', '위탁 중개'],
        ]}
      />
      <SiteLinks
        id="sites-krx"
        rows={[
          ['KRX 시세조회', LINKS.krxPrice],
          ['KRX 공지사항', LINKS.krxBoard],
          ['KRX 매매거래시간', LINKS.krxHours],
          ['KRX 회원자격요건', LINKS.krxMember],
        ]}
      />
    </div>
  );
}

/* ══ 3.2.3 탄소배출권 장외거래 — 거래할 수 있는 업체 명단(엑셀) + 배출권(KAU) 장외 거래 신고서 서식. 작성 정보 없음.
   배출권 거래는 시장 참여자만(법 제19조 · 시행령 제31조: 할당대상업체 · 시장조성자 · 중개회사 · 금융기관 등) — 전기사용자 기업은 해당 없음 ══ */
export function CarbonOtcScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 장외거래" />
      <FormBoard board="otc" title="문서" info={false} forms={[CARBON_FORMS.targetList, CARBON_FORMS.otcReport]} />
    </div>
  );
}

/* ══ 3.2.4 탄소배출권 계약관리 — 외부사업 인증실적(KOC) 판매 문서. 이전 신청서 + 계약 증빙을 양도인(기업)이 직접 낸다(외부사업 지침 제37조) ══ */
export function CarbonContractScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 계약관리" />
      <FormBoard board="contract" title="문서" forms={[CARBON_FORMS.transfer]} />
    </div>
  );
}

/* ══ 3.2.5 외부감축사업 정보 — 참고 문서(방법론) · 사업계획서 · 승인 신청서 서식. 절차는 기업이 직접 ══ */
export function CarbonOffsetScreen() {
  return (
    <div className="space-y-6">
      <Header title="외부감축사업 정보" />
      <FormBoard board="offset" title="문서" forms={[CARBON_FORMS.method, CARBON_FORMS.plan, CARBON_FORMS.approval]} />
    </div>
  );
}

/* ══ 3.2.6 외부감축사업 보고서 — 모니터링 보고서 · 인증신청서 서식 ══ */
export function CarbonOffsetReportScreen() {
  return (
    <div className="space-y-6">
      <Header title="외부감축사업 보고서" />
      <FormBoard board="offsetReport" title="문서" forms={[CARBON_FORMS.monitoring, CARBON_FORMS.certify]} />
    </div>
  );
}
