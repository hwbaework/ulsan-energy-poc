'use client';

// E-데이터마켓 › 카본 마켓플레이스 — 연동 · 거래 실행 없음.
// 공식 공개 정보는 링크로 보내고, 서식은 법제처 원본 그대로 보여주고 받게 한다. 법령이 바뀌면 관리자가 새 서식을 올린다.
// 근거 · 절차: docs/카본마켓-조사.md (2026-10-08).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Download, ExternalLink, Pencil, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
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
import { useGhgRole, useRows } from '@/components/features/ghg/GhgScreens';
import { GHG_TODAY, fmt, fmtT, totalsOf } from '@/lib/ghg-reduction';
import { CARBON_FORMS, LINKS, type CarbonForm } from '@/lib/carbon-docs';
import { useCompany } from '@/hooks/platform/useCompanies';
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

/** 화면에 보이는 문서 이름 — '(별지 제1호) 외부사업 사업계획서'. 구분 끝의 '서식'은 뺀다 */
const nameOf = (f: CarbonForm) => (f.form ? `(${f.form.replace(/\s*서식$/, '')}) ${f.title}` : f.title);

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
    /** 새 파일을 올렸는지 — 이름 · 구분 · 시행일만 고친 건 아님 */
    newFile: !!(up?.hwp || up?.xls || up?.pdf),
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
  const remove = useCarbonFormStore((s) => s.remove);
  const toast = useToastStore((s) => s.add);
  const ff = useFormFile(f ?? EMPTY_FORM);
  // 삭제 확인 — 업로드 팝업 왼쪽 아래 빨간 버튼(배출원 계수 변경 팝업과 같은 자리)
  const [delAsk, setDelAsk] = useState(false);
  const [title, setTitle] = useState('');
  const [no, setNo] = useState('');
  const [from, setFrom] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setTitle(f?.title ?? '');
    setNo(f?.form ?? '');
    setFrom(f ? ff.from : today());
    setFile(null);
    // 팝업을 열 때만 채운다 — f 는 목록이 다시 그려질 때마다 새 객체라 key 로 비교(입력 중 값이 지워지지 않게)
  }, [open, f?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // 업로드는 그 문서와 같은 종류만(PDF 만 있는 방법론은 PDF), 등록은 HWP · 엑셀
  const kinds: FileKind[] = f ? [docKind(f)] : ['hwp', 'xls'];
  const kindOf = (name: string): FileKind | null => {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    return ext === 'hwp' || ext === 'hwpx' ? 'hwp' : ext === 'xls' || ext === 'xlsx' ? 'xls' : ext === 'pdf' ? 'pdf' : null;
  };
  const accept = kinds.map((k) => ACCEPT[k]).join(',');
  const choose = (picked?: File) => {
    if (!picked) return;
    const k = kindOf(picked.name);
    if (!k || !kinds.includes(k)) {
      return toast('error', `${kinds.map((k) => KIND_LABEL[k]).join(', ')} 파일만 올릴 수 있습니다`);
    }
    if (picked.size > MAX_MB * 1024 * 1024) return toast('error', `${MAX_MB}MB 이하 파일만 올릴 수 있습니다`);
    setFile(picked);
  };
  // 추가는 전부 필수, 업로드는 새 파일 또는(이미 올린 서식의) 시행일만 고치기
  // 등록은 전부 필수, 업로드는 이름 · 구분 · 시행일 중 하나라도 바꾸거나 새 파일
  const canSave =
    !!from && !!title.trim() && !!no.trim() && (f ? !!file || title.trim() !== f.title || no.trim() !== f.form || from !== ff.from : !!file);

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
        const k = docKind(f);
        const files: Partial<Record<FormFileKind, UploadedForm>> = {};
        if (file) files[k] = { name: file.name, url: await toDataUrl(file), at: nowText(), by: user?.name ?? '관리자' };
        save(f.key, from, files, {
          ...(title.trim() !== f.title ? { title: title.trim() } : {}),
          ...(no.trim() !== f.form ? { form: no.trim() } : {}),
        });
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
      <input aria-label={text} value={value} placeholder={placeholder} onChange={(e) => set(e.target.value)} className={FIELD} />
    </label>
  );
  const current = f ? { xls: ff.xlsName, hwp: ff.hwpName, pdf: ff.pdfName }[docKind(f)] : '';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={f ? '문서 업로드' : '문서 등록'}
      size="md"
      footer={
        <>
          {f && (
            <Button variant="danger" size="sm" className="mr-auto" onClick={() => setDelAsk(true)}>
              <Trash2 size={14} className="mr-1" /> 삭제
            </Button>
          )}
          <Button variant="cancel" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" size="sm" disabled={!canSave} onClick={() => void onSave()}>
            저장
          </Button>
        </>
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
          {/* 파일 이름이 길어도 버튼은 줄지 않고 한 줄 — 이름만 … 로 줄인다 */}
          <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> 파일 선택
          </Button>
          <span className="min-w-0 truncate text-sm text-slate-300" title={file?.name ?? current}>
            {file?.name ?? current}
          </span>
        </div>
      </div>
      {f && (
        <ConfirmDialog
          open={delAsk}
          onClose={() => setDelAsk(false)}
          onConfirm={() => {
            remove(board, f.key);
            setDelAsk(false);
            onClose();
            toast('success', `${f.title} 문서를 삭제했습니다`);
          }}
          title="문서 삭제"
          message={f.custom ? `'${f.title}'을(를) 지웁니다. 올린 파일도 함께 지워집니다.` : `'${f.title}'을(를) 이 화면 문서 목록에서 지웁니다.`}
          confirmLabel="삭제"
          variant="danger"
        />
      )}
    </Modal>
  );
}

/** 훅 순서를 지키려고 업로드 대상이 없을 때(문서 등록) 쓰는 빈 서식 */
const EMPTY_FORM: CarbonForm = { key: '', title: '', form: '', basis: '', from: '', pdf: '' };

/** 문서 줄의 관리 — [업로드] · [원본으로](원본 서식을 바꿨을 때) · [삭제](추가한 서식) */
/** 문서 파일 종류 — 엑셀 / HWP / PDF 만 있는 문서(방법론) */
type FileKind = 'hwp' | 'xls' | 'pdf';
const docKind = (f: CarbonForm): FileKind => (f.xls ? 'xls' : f.hwp ? 'hwp' : 'pdf');
const ACCEPT: Record<FileKind, string> = { hwp: '.hwp,.hwpx', xls: '.xls,.xlsx', pdf: '.pdf' };
const KIND_LABEL: Record<FileKind, string> = { hwp: 'HWP', xls: '엑셀', pdf: 'PDF' };

/** 줄 버튼 수 — 업로드는 늘, 원본 문서를 고쳤으면 원본으로(삭제는 업로드 팝업 안) */
const rowButtons = (f: CarbonForm, changed: boolean) => 1 + (changed && !f.custom ? 1 : 0);

function FormRowActions({ board, f }: { board: string; f: CarbonForm }) {
  const reset = useCarbonFormStore((s) => s.reset);
  const ff = useFormFile(f);
  const [upOpen, setUpOpen] = useState(false);
  return (
    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
      <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => setUpOpen(true)}>
        <Upload size={14} /> 업로드
      </Button>
      {ff.up && !f.custom && (
        <Button variant="secondary" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => reset(f.key)}>
          <RotateCcw size={14} /> 원본으로
        </Button>
      )}
      <FormModal board={board} f={f} open={upOpen} onClose={() => setUpOpen(false)} />
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

/** 서식 채움 — 원본 서식의 HWP 칸(표 · 열 · 행)에 값을 넣어 받는다. 미리보기는 원본 그대로.
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

/** HWP 에 넣을 값 — 기업 · 내 계정 · 설비 · 감축량 */
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
  // 새 파일을 올렸으면 칸이 달라 채우지 않는다(이름 · 구분만 고친 건 원본 그대로)
  if (!doc || ff.newFile || f.custom || !info.co) return null;
  const v = info.values;
  return {
    company: v.name,
    cells: doc.cells.map(({ key, ...c }) => ({ ...c, text: v[key] })),
    replaces: doc.replaces({ ...v, date: info.date }),
  };
}

/** 원본 서식 그대로 — 값은 얹지 않는다(넣는 건 HWP). 새로 올린 HWP · 추가한 서식은 미리보기 없음 */
function FormPdf({ f }: { f: CarbonForm }) {
  const ff = useFormFile(f);
  // 올린 PDF 는 data URL 이라 브라우저 PDF 보기가 열리지 않을 수 있어 blob 주소로 바꿔 띄운다
  const blobUrl = useBlobUrl(ff.up?.pdf?.url);
  // 추가 · 새로 올린 서식, PDF 가 없는 자료(엑셀)는 미리보기 없음
  if (f.custom || (ff.newFile && !f.ref) || !ff.pdf) {
    // 높이는 미리보기(PDF)와 같게 — 문서를 바꿔도 화면 높이가 튀지 않게
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height: PAPER.height, minHeight: PAPER.minHeight }}>
        미리보기 없음
      </div>
    );
  }
  return <iframe src={fitPdf(blobUrl ?? ff.pdf)} title={f.form} className="w-full bg-white" style={PAPER} />;
}

/** data URL → blob 주소(화면을 떠나면 놓는다) */
function useBlobUrl(dataUrl?: string) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!dataUrl?.startsWith('data:')) return setUrl(null);
    const [head = '', body = ''] = dataUrl.split(',');
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const u = URL.createObjectURL(new Blob([bytes], { type: head.slice(5).split(';')[0] || 'application/pdf' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [dataUrl]);
  return url;
}

/** 미리보기 머리 — 서식 이름 · 별지, 올린 적 있으면 올린 일시 · 올린 사람 */
function FormHead({ f }: { f: CarbonForm }) {
  const { uploaded } = useFormFile(f);
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-400">미리보기</p>
      <p className="truncate text-sm font-semibold text-white">{nameOf(f)}</p>
      {uploaded && <p className="mt-0.5 text-xs text-slate-500">{uploaded}</p>}
    </div>
  );
}

/** 서식 — 목록 왼쪽 · 원본 오른쪽(줄을 누르면 오른쪽이 그 서식으로), 명세서 화면과 같은 배치 */
function FormBoard({
  board,
  forms: base,
  title = '문서',
}: {
  board: string;
  forms: CarbonForm[];
  title?: string;
}) {
  const role = useGhgRole();
  const added = useCarbonFormStore((s) => s.added[board]);
  const files = useCarbonFormStore((s) => s.files);
  // 관리자가 고친 문서 이름 · 구분을 얹는다
  const hidden = useCarbonFormStore((s) => s.hidden?.[board]);
  const forms = [...base, ...(added ?? [])].filter((f) => !hidden?.includes(f.key)).map((f) => ({ ...f, title: files[f.key]?.title ?? f.title, form: files[f.key]?.form ?? f.form }));
  const [addOpen, setAddOpen] = useState(false);
  const [key, setKey] = useState(forms[0]?.key);
  // 채울 기업 — 기업 계정은 자기 기업 값이 들어간 HWP, 관리자는 원본(기업을 고르는 칸이 없다)
  const companyId = role.isAdmin ? 0 : role.myId;
  const sel = forms.find((f) => f.key === key) ?? forms[0];
  // 기준일 · 관리 칸은 들어갈 것만큼만 — 시행 전 표시 · 버튼 2개(원본으로 / 삭제)인 줄이 있을 때만 넓혀 문서 이름 칸을 넉넉하게
  const anyBefore = forms.some((f) => (files[f.key]?.from ?? f.from) > today());
  const maxButtons = Math.max(1, ...forms.map((f) => rowButtons(f, !!files[f.key])));
  const cols: Column<CarbonForm>[] = [
    {
      key: 'title',
      header: title,
      render: (f) => (
        // 긴 문서 이름은 … 로 줄이고(전체는 마우스 올리면), 기준일 · 관리 칸은 폭 고정
        <span className="flex min-w-0 items-center gap-2" title={nameOf(f)}>
          <span className="min-w-0 truncate text-sm font-medium text-white">{nameOf(f)}</span>
        </span>
      ),
    },
    { key: 'from', header: '기준일', width: anyBefore ? '170px' : '120px', render: (f) => cell(<FormFrom f={f} />, 'whitespace-nowrap text-slate-300') },
    ...(role.isAdmin
      ? [{ key: 'manage', header: '', width: maxButtons > 1 ? '220px' : '120px', align: 'right' as const, render: (f: CarbonForm) => <FormRowActions board={board} f={f} /> }]
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

/* ══ 3.2.3 탄소배출권 장외거래 — 거래할 수 있는 업체 명단(엑셀) + 배출권(KAU) 장외 거래 신고서 서식.
   배출권 거래는 시장 참여자만(법 제19조 · 시행령 제31조: 할당대상업체 · 시장조성자 · 중개회사 · 금융기관 등) — 전기사용자 기업은 해당 없음 ══ */
export function CarbonOtcScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 장외거래" />
      <FormBoard board="otc" title="문서" forms={[CARBON_FORMS.targetList, CARBON_FORMS.otcReport]} />
      {/* 업체 명단(엑셀)의 원본 — 할당대상업체 + 관리업체 목록 */}
      <SiteLinks id="sites-otc" rows={[['명세서 배출량 통계', LINKS.girStatement]]} />
    </div>
  );
}

/* ══ 3.2.4 탄소배출권 계약관리 — KOC 를 팔기까지 문서 전부, 절차 순서대로: 사업계획서(제1호) · 승인 신청서(제5호) · 보유계정 등록신청서(제36호)
   · 모니터링 보고서(제17호) · 감축량 인증신청서(제18호) · 이전 신청서(제22호, 기업 값 채운 HWP). 같은 서식은 외부감축사업 정보 · 보고서 화면과 같은 파일 ══ */
export function CarbonContractScreen() {
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 계약관리" />
      <FormBoard
        board="contract"
        title="문서"
        forms={[CARBON_FORMS.plan, CARBON_FORMS.approval, CARBON_FORMS.account, CARBON_FORMS.monitoring, CARBON_FORMS.certify, CARBON_FORMS.transfer]}
      />
      {/* KOC 서식은 모두 부문별 관장기관에 내고 상쇄등록부에 기록된다(지침 제12조③④ · 제39조), 검증만 검증기관(제30조) */}
      <SiteLinks
        id="sites-contract"
        rows={[
          ['상쇄등록부', LINKS.ors],
          ['온실가스 검증기관 지정현황', LINKS.verifiers],
        ]}
      />
    </div>
  );
}

/* ══ 3.2.5 외부감축사업 정보 — 사업 등록 · 계정 문서: 방법론(참고) · 사업계획서 · 승인 신청서 · 보유계정 등록신청서, 공식 사이트(관리자 수정).
   모니터링 보고서 · 인증신청서는 3.2.6 보고서. 검증 · 인증(KOC 발행)은 검증기관 · 관장기관이 한다 — 플랫폼은 문서만 ══ */
export function CarbonOffsetScreen() {
  return (
    <div className="space-y-6">
      <Header title="외부감축사업 정보" />
      <FormBoard board="offset" title="문서" forms={[CARBON_FORMS.method, CARBON_FORMS.plan, CARBON_FORMS.approval, CARBON_FORMS.account]} />
      <SiteLinks
        id="sites-offset"
        rows={[
          ['상쇄등록부', LINKS.ors],
          ['방법론 · 외부사업 · 감축량 인증 현황', LINKS.orsMethod],
          ['온실가스 검증기관 지정현황', LINKS.verifiers],
        ]}
      />
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
