'use client';

// E-데이터마켓 › 카본 마켓플레이스 — 연동 · 거래 실행 없음.
// 공식 공개 정보는 링크로 보내고, 기업이 직접 신청 · 신고할 때 쓸 준비 서류를 우리 데이터로 채워 PDF로 만든다.
// 서식 · 절차 근거: docs/카본마켓-조사.md (2026-10-08). 감축량은 온실가스 인벤토리와 같은 값(자가소비 설비만).

import { useState, type ReactNode } from 'react';
import { Download, ExternalLink, Eye } from 'lucide-react';
import { StatCard, StatsGrid } from '@/components/features/StatCard';
import { SectionCard } from '@/components/features/SectionCard';
import { DataTable, type Column } from '@/components/features/DataList';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToastStore } from '@/stores/useToastStore';
import { MonthRange, useGhgRole, useMonthRange, useRows, type Role } from '@/components/features/ghg/GhgScreens';
import { COMPANIES, fmt, pick, totalsOf } from '@/lib/ghg-reduction';
import {
  LAST12,
  LINKS,
  METHOD,
  annualOf,
  approvalDoc,
  certifyDoc,
  monitoringDoc,
  otcReportDoc,
  planDoc,
  scaleOf,
  selfFacilities,
  transferDoc,
  type DocCompany,
  type DocSpec,
} from '@/lib/carbon-docs';
import { BLANK, exportCarbonDocPdf } from '@/lib/utils/exportCarbonDoc';

/* ── 공통 ── */
const cell = (v: ReactNode, cls = 'text-slate-300') => <span className={`text-sm ${cls}`}>{v}</span>;
const num = (v: ReactNode) => <span className="whitespace-nowrap text-sm tabular-nums text-slate-300">{v}</span>;
const strong = (v: ReactNode) => <span className="whitespace-nowrap text-sm font-medium tabular-nums text-white">{v}</span>;

function Header({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'E-데이터마켓', path: '/e-data/inventory' }, { label: '카본 마켓플레이스' }, { label: title }]} />
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

/** 문서 대상 기업 — 관리자는 고르고(처음엔 첫 기업), 기업 계정은 자기 회사 */
function useDocCompany(role: Role) {
  const [chosen, setChosen] = useState<number>(role.companies[0]?.id ?? 0);
  const id = role.isAdmin ? chosen : role.myId;
  const company: DocCompany | undefined = COMPANIES.find((c) => c.id === id);
  return { company, chosen, setChosen };
}
function CompanyPicker({ role, value, onChange }: { role: Role; value: number; onChange: (v: number) => void }) {
  if (!role.isAdmin) return null;
  return (
    <div className="w-48">
      <Select
        options={role.companies.map((c) => ({ value: String(c.id), label: c.name }))}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** 표 — 칸 이름 · 줄(글자) */
function TextTable({ head, rows, keyCol = 0 }: { head: string[]; rows: ReactNode[][]; keyCol?: number }) {
  type R = { i: number; cells: ReactNode[] };
  const cols: Column<R>[] = head.map((h, ci) => ({
    key: String(ci),
    header: h,
    render: (r) => (ci === keyCol ? cell(r.cells[ci], 'font-medium text-white') : cell(r.cells[ci])),
  }));
  return <DataTable data={rows.map((cells, i) => ({ i, cells }))} columns={cols} rowKey={(r) => r.i} />;
}

/** 준비 서류 카드 — 서식 · 근거 · 제출처 · 기한, 미리보기 · PDF */
function DocCards({ docs, company }: { docs: DocSpec[]; company?: DocCompany }) {
  const toast = useToastStore((s) => s.add);
  const [open, setOpen] = useState<DocSpec | null>(null);
  const download = async (d: DocSpec) => {
    if (!company) return;
    try {
      await exportCarbonDocPdf(`${d.title}_${d.form}_${company.name}`, d, company.name);
    } catch {
      toast('error', '내려받기에 실패했습니다');
    }
  };
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {docs.map((d) => {
          const filled = d.sections.reduce(
            (a, s) => (s.kind === 'fields' ? a + s.fields.filter((f) => f.value).length : a),
            0,
          );
          const all = d.sections.reduce((a, s) => (s.kind === 'fields' ? a + s.fields.length : a), 0);
          return (
            <div key={d.key} className="flex flex-col rounded-xl bg-[#0d1520] p-5 ring-1 ring-white/[0.06]">
              <p className="text-sm text-slate-400">{d.form}</p>
              <p className="mt-1 text-lg font-semibold text-white">{d.title}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                {[
                  ['근거', d.basis],
                  ['제출처', d.submitTo],
                  ['기한', d.deadline],
                  ['채운 칸', `${filled} / ${all}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-14 shrink-0 text-slate-500">{k}</dt>
                    <dd className="text-slate-300">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto flex gap-2 pt-4">
                <Button variant="secondary" size="sm" onClick={() => setOpen(d)}>
                  <Eye size={15} /> 미리보기
                </Button>
                <Button variant="primary" size="sm" onClick={() => void download(d)} disabled={!company}>
                  <Download size={15} /> PDF
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `${open.title} (${open.form})` : ''}
        size="xl"
        footer={
          open && (
            <Button variant="primary" size="sm" onClick={() => void download(open)}>
              <Download size={15} /> PDF
            </Button>
          )
        }
      >
        {open && <DocPreview d={open} />}
      </Modal>
    </>
  );
}

/** 미리보기 — PDF와 같은 순서 */
function DocPreview({ d }: { d: DocSpec }) {
  return (
    <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
      {d.sections.map((s) => (
        <div key={s.title}>
          <p className="mb-2 text-sm font-semibold text-white">{s.title}</p>
          {s.kind === 'fields' ? (
            <div className="divide-y divide-white/[0.05] rounded-lg ring-1 ring-white/[0.06]">
              {s.fields.map((f) => (
                <div key={f.label} className="grid grid-cols-5 gap-3 px-3 py-2 text-sm">
                  <span className="col-span-2 text-slate-400">{f.label}</span>
                  <span className={`col-span-3 ${f.value ? 'text-white' : 'text-slate-600'}`}>{f.value ?? BLANK}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg ring-1 ring-white/[0.06]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-slate-400">
                    {s.head.map((h, i) => (
                      <th key={h} className={`px-3 py-2 font-medium ${i ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.body.map((r) => (
                    <tr key={r[0]} className="border-b border-white/[0.04]">
                      {r.map((v, i) => (
                        <td key={i} className={`px-3 py-1.5 tabular-nums text-slate-300 ${i ? 'text-right' : ''}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {s.foot && (
                    <tr className="font-medium text-white">
                      {s.foot.map((v, i) => (
                        <td key={i} className={`px-3 py-1.5 tabular-nums ${i ? 'text-right' : ''}`}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      <div>
        <p className="mb-2 text-sm font-semibold text-white">주의</p>
        <ul className="space-y-1 text-sm text-slate-400">
          {d.notes.map((n) => (
            <li key={n}>· {n}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** 기업별 외부사업 규모 — 최근 12개월 자가소비 감축량 */
function ScaleCard({ role }: { role: Role }) {
  const { rows } = useRows();
  const list = role.companies.map((c) => {
    const a = annualOf(rows, c.id);
    const kw = selfFacilities(c.id).reduce((x, f) => x + f.kw, 0);
    return { ...c, kw, ...a };
  });
  const sum = list.reduce((a, c) => a + c.tco2, 0);
  type R = (typeof list)[number];
  const cols: Column<R>[] = [
    { key: 'name', header: '기업명', render: (c) => cell(c.name, 'font-medium text-white') },
    { key: 'kw', header: '자가소비 설비 (kW)', align: 'right', render: (c) => num(fmt(c.kw, 2)) },
    { key: 'mwh', header: '연 발전량 (MWh)', align: 'right', render: (c) => num(fmt(c.mwh, 1)) },
    { key: 'tco2', header: '연 감축량 (tCO₂eq)', align: 'right', sortable: true, sortValue: (c) => c.tco2, render: (c) => strong(fmt(c.tco2, 2)) },
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
  const role = useGhgRole();
  const { rows } = useRows();
  const ids = role.companies.map((c) => c.id);
  const a = ids.reduce((s, id) => s + annualOf(rows, id).tco2, 0);
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 정보" />
      <StatsGrid columns={3}>
        <StatCard label="연 감축량 (자가소비)" value={`${fmt(a, 2)} tCO₂eq`} sub={`${LAST12[0]} ~ ${LAST12[1]}`} />
        <StatCard label="적용 방법론" value={METHOD.code} />
        <StatCard label="받을 수 있는 실적" value="KOC (외부사업 감축량)" />
      </StatsGrid>
      <SectionCard title="거래 종목 (3)">
        <TextTable
          head={['종목', '뜻', '근거', '우리 기업']}
          rows={[
            ['KAU 할당배출권', '할당대상업체에 할당된 배출허용량. 이행연도별 상장', '법 제12조', '해당 없음'],
            ['KCU 상쇄배출권', '외부사업 감축량에서 전환된 배출권. 전환은 할당대상업체만', '법 제29조', '해당 없음'],
            ['KOC 외부사업 감축량', '할당대상업체 밖에서 줄여 정부 인증을 받은 실적', '법 제30조', '외부사업 승인 · 인증 후 판매'],
          ]}
        />
      </SectionCard>
      <SectionCard title="참여 자격">
        <TextTable
          head={['구분', '할 수 있는 것', '근거']}
          rows={[
            ['할당대상업체', 'KAU · KCU 장내 · 장외 거래, 상쇄배출권 전환', '법 제19조 · 거래 고시 제26조의2'],
            ['외부사업 사업자 (법인)', 'KOC 인증 · 보유 · 이전, KRX 외부사업 감축량 전문회원(KOC 자기매매)', '지침 제37조 · KRX 운영규정 제12조'],
            ['배출권거래중개회사 · 신탁업자 등', '중개 · 금융투자상품 목적 거래', '시행령 제31조'],
          ]}
        />
      </SectionCard>
      <ScaleCard role={role} />
      <SectionCard title="공식 사이트">
        <div className="flex flex-wrap gap-2">
          <OutLink href={LINKS.krxItems} label="KRX 거래종목" />
          <OutLink href={LINKS.etrs} label="배출권등록부 ETRS" />
          <OutLink href={LINKS.ors} label="상쇄등록부 ORS" />
          <OutLink href={LINKS.allocList} label="할당대상업체 현황" />
          <OutLink href={LINKS.lawAct} label="배출권거래법" />
          <OutLink href={LINKS.lawOffset} label="외부사업 지침" />
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.2 탄소배출권 KRX 거래 — 시세는 KRX 화면으로(재게시 금지) ══ */
export function CarbonKrxScreen() {
  return (
    <div className="space-y-6">
      <Header
        title="탄소배출권 KRX 거래"
        actions={
          <>
            <OutLink href={LINKS.krxPrice} label="KRX 시세조회" />
            <OutLink href={LINKS.krxBoard} label="KRX 공지 · 시장동향" />
          </>
        }
      />
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
          head={['회원', '대상', '거래']}
          rows={[
            ['일반회원', '할당대상업체 · 시장조성자 등', 'KAU · KCU · KOC'],
            ['외부사업 감축량 전문회원', '법인인 외부사업 사업자', 'KOC 자기매매'],
            ['거래중개회원', '배출권거래중개회사(증권사)', '위탁 중개'],
          ]}
        />
      </SectionCard>
      <SectionCard title="공식 사이트">
        <div className="flex flex-wrap gap-2">
          <OutLink href={LINKS.krxItems} label="거래종목" />
          <OutLink href={LINKS.krxHours} label="매매제도" />
          <OutLink href={LINKS.krxMember} label="회원자격요건" />
        </div>
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.3 탄소배출권 장외거래 — 우리 기업은 KOC 이전 ══ */
export function CarbonOtcScreen() {
  const role = useGhgRole();
  const dc = useDocCompany(role);
  const docs = dc.company ? [transferDoc(dc.company)] : [];
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 장외거래" actions={<CompanyPicker role={role} value={dc.chosen} onChange={dc.setChosen} />} />
      <SectionCard title="장외거래 구분">
        <TextTable
          head={['대상', '거래할 수 있는 사람', '신청 · 신고', '근거']}
          rows={[
            ['KOC (외부사업 인증실적)', '외부사업 참여자(보유계정 있는 법인)', '양도인이 이전 신청서 + 계약 증빙 → 상쇄등록부', '지침 제37조'],
            ['KAU · KCU (배출권)', '할당대상업체 · 중개회사 · 신탁업자', '양도인이 장외 거래 신고서 + 공증 → 배출권등록부', '거래 고시 제26조의2 · 제27조'],
          ]}
        />
      </SectionCard>
      <SectionCard title="준비 서류 (1)">
        <DocCards docs={docs} company={dc.company} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.4 탄소배출권 계약관리 — 거래 신고에 들어가야 하는 것 · 신고서 ══ */
export function CarbonContractScreen() {
  const role = useGhgRole();
  const dc = useDocCompany(role);
  const docs = dc.company ? [otcReportDoc(dc.company)] : [];
  return (
    <div className="space-y-6">
      <Header title="탄소배출권 계약관리" actions={<CompanyPicker role={role} value={dc.chosen} onChange={dc.setChosen} />} />
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
      <SectionCard title="준비 서류 (1)">
        <DocCards docs={docs} company={dc.company} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.5 외부감축사업 정보 — 조건 · 방법론 · 절차 · 사업계획서 · 승인 신청서 ══ */
export function CarbonOffsetScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const dc = useDocCompany(role);
  const docs = dc.company ? [planDoc(dc.company, rows, fx), approvalDoc(dc.company, rows)] : [];
  return (
    <div className="space-y-6">
      <Header
        title="외부감축사업 정보"
        actions={
          <>
            <CompanyPicker role={role} value={dc.chosen} onChange={dc.setChosen} />
            <OutLink href={LINKS.orsMethod} label="방법론 현황" />
          </>
        }
      />
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
            ['01B-008-Ver01', '전력 자가사용 및 독립된 소규모 계통 연계를 위한 재생에너지 발전사업의 방법론', '2020-06-05'],
            ['01B-004-Ver01', '재생에너지를 이용한 전력 생산 및 자가 사용 사업의 방법론', '2016-05-26'],
          ]}
        />
      </SectionCard>
      <SectionCard title="절차">
        <TextTable
          head={['단계', '내용', '기한', '서류']}
          rows={[
            ['0. 보유계정', '상쇄등록부 보유계정 등록', '', '별지 제36호'],
            ['1. 승인 신청', '사업계획서 · 승인 신청서 제출 → 타당성 평가', '평가 30일 (연장 30일)', '별지 제1호 · 제5호'],
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
      <SectionCard title={`준비 서류 (${docs.length})`}>
        <DocCards docs={docs} company={dc.company} />
      </SectionCard>
    </div>
  );
}

/* ══ 3.2.6 외부감축사업 보고서 — 기간 실적 · 모니터링 보고서 · 인증신청서 ══ */
export function CarbonOffsetReportScreen() {
  const role = useGhgRole();
  const { fx, rows } = useRows();
  const dc = useDocCompany(role);
  const range = useMonthRange();
  const id = dc.company?.id;
  const mine = rows.filter((r) => r.facility.companyId === id && r.facility.kind === '자가소비');
  const t = totalsOf(pick(mine, range.from, range.to));
  const docs = dc.company
    ? [monitoringDoc(dc.company, rows, fx, range.from, range.to), certifyDoc(dc.company, rows, range.from, range.to)]
    : [];
  return (
    <div className="space-y-6">
      <Header
        title="외부감축사업 보고서"
        actions={
          <>
            <MonthRange {...range} />
            <CompanyPicker role={role} value={dc.chosen} onChange={dc.setChosen} />
          </>
        }
      />
      <StatsGrid columns={3}>
        <StatCard label="모니터링 감축량" value={`${fmt(t.tco2, 3)} tCO₂eq`} />
        <StatCard label="자가소비 발전량" value={`${fmt(t.mwh, 3)} MWh`} />
        <StatCard label="인증신청량 (정수)" value={`${fmt(Math.floor(t.tco2))} tCO₂eq`} />
      </StatsGrid>
      <SectionCard title={`준비 서류 (${docs.length})`}>
        <DocCards docs={docs} company={dc.company} />
      </SectionCard>
    </div>
  );
}
