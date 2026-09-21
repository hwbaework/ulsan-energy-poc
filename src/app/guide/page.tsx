'use client';

/**
 * 디자인 가이드 — /guide (메뉴에 없음, URL 로만 접근)
 * src/lib/design.ts 의 값을 그대로 렌더하므로 코드가 바뀌면 이 페이지도 같이 바뀐다.
 */
import Image from 'next/image';
import {
  CHART_PALETTE,
  COLOR,
  METRICS,
  METRIC_ORDER,
  SOURCE,
  SOURCE_ORDER,
  STATUS_KEY,
} from '@/lib/design';
import { MetricIcon, SourceBadge, SourceIcon, SourceMarker, StatusBadge, StatusDot, StatusPill } from '@/components/ui/Design';
import { PlantNameCell } from '@/components/features/monitoring/PlantNameCell';
import { DataTable, type Column } from '@/components/features/DataList';

interface GuidePlantSample {
  id: number;
  type: string;
  name: string;
  capacity: number;
  ok: boolean;
}

const TABLE_SAMPLE: GuidePlantSample[] = [
  { id: 1, type: 'SOLAR', name: '용인금속', capacity: 152.32, ok: true },
  { id: 2, type: 'FUEL_CELL', name: '연료전지', capacity: 2000, ok: false },
];

const TABLE_SAMPLE_COLUMNS: Column<GuidePlantSample>[] = [
  { key: 'no', header: 'No.', width: '56px', align: 'right', render: (_r, i) => <span className="text-sm text-slate-500 tabular-nums">{i + 1}</span> },
  { key: 'name', header: '발전소', render: (r) => <PlantNameCell type={r.type} name={r.name} /> },
  { key: 'capacity', header: '설비용량', width: '140px', align: 'right', sortable: true, sortValue: (r) => r.capacity, render: (r) => <span className="text-sm text-slate-300 tabular-nums">{r.capacity.toLocaleString()} kW</span> },
  { key: 'status', header: '상태', width: '110px', render: (r) => <StatusPill tone={r.ok ? 'normal' : 'danger'} label={r.ok ? '정상' : '오류'} /> },
];

const COLOR_GROUPS: { title: string; items: { name: string; hex: string; note?: string }[] }[] = [
  {
    title: '메인 컬러',
    items: [
      { name: 'Primary', hex: COLOR.primary, note: '주요 버튼·강조' },
      { name: 'Primary Hover', hex: COLOR.primaryHover },
      { name: 'Primary Light', hex: COLOR.primaryLight, note: '링크·보조 강조' },
      { name: 'Secondary', hex: COLOR.secondary },
      { name: 'Accent', hex: COLOR.accent, note: '보더·비활성 텍스트' },
    ],
  },
  {
    title: '배경',
    items: [
      { name: '전체 배경', hex: COLOR.bg },
      { name: '카드', hex: COLOR.card },
      { name: '솔리드 카드', hex: COLOR.cardSolid },
      { name: '패널', hex: COLOR.panel },
    ],
  },
  {
    title: '상태 컬러',
    items: [
      { name: '정상 · 성공', hex: COLOR.green },
      { name: '경고 · 대기', hex: COLOR.yellow, note: 'POC 관제에서는 사용 안 함' },
      { name: '위험 (텍스트)', hex: COLOR.red },
      { name: '위험 (면·버튼)', hex: COLOR.redSolid },
      { name: '오렌지', hex: COLOR.orange },
      { name: '정보 · 진행중', hex: COLOR.blue },
    ],
  },
  {
    title: '텍스트',
    items: [
      { name: '제목 · 강조', hex: '#FFFFFF' },
      { name: '본문', hex: COLOR.textBody },
      { name: '보조 설명', hex: COLOR.textMuted },
      { name: '캡션 · 비활성', hex: COLOR.textCaption },
    ],
  },
];

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="border-l-[3px] border-primary-hover pl-3">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-slate-400">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, hex, note }: { name: string; hex: string; note?: string }) {
  return (
    <div className="rounded-lg bg-[#13233C] overflow-hidden ring-1 ring-white/[0.06]">
      <div className="h-16" style={{ backgroundColor: hex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.08)' }} />
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-semibold text-white">{name}</p>
        <p className="mt-0.5 font-mono text-xs text-slate-400">{hex}</p>
        {note && <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>}
      </div>
    </div>
  );
}

export default function DesignGuidePage() {
  return (
    <div className="min-h-screen bg-surface-dark text-white">
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-14">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="" width={96} height={60} className="h-10 w-auto" />
            <h1 className="text-2xl font-bold">울산 에자자 POC · 디자인 가이드</h1>
          </div>
          <p className="text-sm text-slate-400">
            근거: DT WEB 기본 디자인 가이드(28_디자인-토큰-가이드, 컬러가이드). 이 페이지는 코드의 디자인 정의를 그대로 그리므로 값이 바뀌면
            같이 바뀝니다.
          </p>
        </header>

        {COLOR_GROUPS.map((g) => (
          <Section key={g.title} title={g.title}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {g.items.map((it) => (
                <Swatch key={it.name} {...it} />
              ))}
            </div>
          </Section>
        ))}

        <Section title="발전원" desc="화면(배지·목록·범례·요약)에서는 아이콘과 고유색을 쓰고, 핀 모양 마커 그림은 지도 위에서만 씁니다.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {SOURCE_ORDER.map((t) => {
              const s = SOURCE[t];
              return (
                <div key={t} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/[0.06]">
                      <SourceIcon type={t} size={28} />
                    </span>
                    <div className="flex-1">
                      <p className="text-base font-semibold text-white">{s.label}</p>
                      <p className="font-mono text-xs text-slate-400">{s.color}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <SourceMarker type={t} size={32} />
                      <span className="text-[10px] text-slate-500">지도 마커</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SourceBadge type={t} />
                    <SourceBadge type={t} withIcon={false} />
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className={`h-full w-2/3 rounded-full ${s.barClass}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="상태" desc="정상은 전부 초록, 이상감지만 빨강. 주의·정비·정지 같은 세부 상태는 판정 근거가 없어 구분하지 않습니다.">
          <div className="flex flex-wrap items-center gap-6">
            {STATUS_KEY.map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <StatusDot status={s.label === '정상' ? 'NORMAL' : 'ANOMALY'} pulse />
                <StatusBadge status={s.label === '정상' ? 'NORMAL' : 'ANOMALY'} />
                <span className={`text-sm ${s.textClass}`}>{s.label}</span>
                <span className="font-mono text-xs text-slate-500">{s.color}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="상태 칩 (StatusPill)"
          desc="정상/이상 외에 통신·전원처럼 세부 상태를 색으로 구분할 때 쓰는 공통 칩. 앱의 모든 상태 표기는 '동그라미 + 라벨' 이 한 형태로 통일합니다. 별도의 배지 모양을 새로 만들지 않습니다."
        >
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <StatusPill tone="normal" label="정상" />
            <StatusPill tone="danger" label="오류" />
            <StatusPill tone="warning" label="주의" />
            <StatusPill tone="muted" label="비활성" />
          </div>
        </Section>

        <Section
          title="발전소 이름 셀 (PlantNameCell)"
          desc="표에서 발전소를 나타내는 공통 형태. [발전원 아이콘] 이름 / 발전원 라벨. 발전소를 행으로 갖는 표(발전소 목록·예지보전 등)는 모두 이 컴포넌트를 씁니다. 순번이 필요하면 시스템 ID가 아니라 표의 별도 'No.' 컬럼(1,2,3…)으로 매깁니다."
        >
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <PlantNameCell type="SOLAR" name="용인금속" />
          </div>
        </Section>

        <Section
          title="표 (DataTable)"
          desc="목록·표는 모두 DataTable(features/DataList)로 만듭니다. 순번은 No. 컬럼, 발전소는 PlantNameCell, 상태는 StatusPill, 숫자는 우측정렬(tabular-nums), 정렬은 헤더 sortable, 행 클릭 이동은 onRowClick. 필터는 이 표를 감싸는 SectionCard 헤더 actions에 둡니다."
        >
          <DataTable columns={TABLE_SAMPLE_COLUMNS} data={TABLE_SAMPLE} rowKey={(r) => r.id} />
        </Section>

        <Section title="아이콘 사용 규칙" desc="숫자 KPI 카드(현재 출력·발전량·설비 용량·금액 등)에는 아이콘을 붙이지 않습니다. 아이콘은 발전원·상태·날씨처럼 그림 자체가 뜻을 전달하는 곳에만 씁니다. 아래는 날씨 아이콘.">
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02] text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium">아이콘</th>
                  <th className="px-4 py-3 font-medium">대표 라벨</th>
                  <th className="px-4 py-3 font-medium">쓰는 곳</th>
                  <th className="px-4 py-3 font-medium">색</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ORDER.map((k) => {
                  const m = METRICS[k];
                  return (
                    <tr key={k} className="border-b border-white/[0.04] text-slate-300">
                      <td className="px-4 py-2.5">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
                          <MetricIcon k={k} />
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium text-white">{m.label}</td>
                      <td className="px-4 py-2.5 text-slate-400">{m.usage}</td>
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <span className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: m.color }} />
                        {m.color}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="차트 팔레트" desc="시리즈 색을 따로 정하지 않으면 이 순서대로 배정. 발전량=초록, 예상=오렌지 점선, 발전소별=팔레트 순환.">
          <div className="flex flex-wrap gap-2">
            {CHART_PALETTE.map((c, i) => (
              <div key={c} className="flex items-center gap-2 rounded-lg bg-[#13233C] px-3 py-2 ring-1 ring-white/[0.06]">
                <span className="h-4 w-4 rounded-sm" style={{ backgroundColor: c }} />
                <span className="text-xs text-slate-400">#{i + 1}</span>
                <span className="font-mono text-xs text-slate-300">{c}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="표기 규칙">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>용량 합계는 MW 두 자리(0.75 MW), 개별 설비는 kW 그대로(429.44 kW).</li>
            <li>퍼센트는 화면에서 쓰지 않는다. 가동률·비중·달성률 같은 파생 비율은 표시하지 않는다.</li>
            <li>이모지는 쓰지 않는다. 발전원은 아이콘(해·불꽃·배터리) + 고유색, 지도 위 마커만 핀 그림을 쓴다.</li>
            <li>숫자 KPI 카드에는 아이콘을 넣지 않는다. 라벨 + 수치만.</li>
            <li>계약 유형 배지는 회색 중립(자가소비 · 온사이트). 연료전지·ORC에는 계약 배지를 붙이지 않는다.</li>
            <li>페이지 제목 24px bold, 카드 제목 16px semibold, 라벨 12px slate-400, 카드 수치 24px bold.</li>
            <li>상태·통신·전원 칩은 StatusPill(동그라미 + 라벨) 한 형태로 통일한다. 새 배지 모양을 만들지 않는다.</li>
            <li>표에서 발전소는 PlantNameCell(아이콘 + 이름 + 발전원 라벨)로 표기한다. 순번은 시스템 ID가 아니라 별도 'No.' 컬럼(1,2,3…)으로 매긴다.</li>
            <li>숫자 KPI 카드(StatCard)에는 sub 설명을 넣지 않는다. 라벨 + 수치만.</li>
            <li>
              목록 표는 SectionCard로 감싸고 제목(예: &lsquo;기업 목록&rsquo;)을 단다. 검색창·필터(Select)·등록 버튼은 위에 따로 줄로 두지 않고 카드 헤더의 actions(제목 오른쪽)에 한 줄로 붙인다. 순서는 검색 → 필터 → 등록(맨 오른쪽). 검색창 폭은 w-64.
            </li>
            <li>목록·표는 DataTable(features/DataList)로 만든다. 숫자 열은 우측정렬 + tabular-nums, 정렬 필요한 열은 sortable, 상세로 들어가는 표는 onRowClick.</li>
            <li>상세 화면은 제목 왼쪽에 ← 아이콘 버튼(ghost)으로 뒤로 간다. 오른쪽에 '목록으로' 텍스트 버튼을 두지 않는다.</li>
            <li>
              카드의 주요 액션(수정·저장·등록·다운로드·업로드)은 SectionCard 헤더 actions(제목 오른쪽)에 둔다. 카드 하단에 별도 버튼 줄을 만들지 않는다.
            </li>
            <li>
              실행 버튼(수정·저장·등록·다운로드·업로드)은 앞에 의미에 맞는 아이콘(size 14)을 붙인다. 취소·닫기 같은 되돌리기 버튼은 아이콘 없이 텍스트만.
            </li>
            <li>정보 수정은 팝업(Modal) 대신 그 자리에서 인라인 편집(수정 → 필드가 입력으로 바뀌고 헤더에 취소·저장).</li>
            <li>중요 식별정보(사업자등록번호·사업자 등록증)는 임의 수정 불가. 등록증 교체는 저장 시 '변경 승인 대기'로 두고 관리자 확인 후 반영한다.</li>
            <li>변경 불가(읽기 전용) 항목은 비활성 입력칸이 아니라 라벨 + 텍스트로 표시한다(예: 이메일·상태·설립일). 편집 가능한 항목만 Input을 쓴다.</li>
            <li>역할·상태 등은 코드값(SYSTEM_ADMIN 등)을 그대로 노출하지 않고 한글 라벨(관리자·발전사업자·전기사용자)로 표시한다.</li>
            <li>회원이 갖는 항목(이름·부서·연락처·이메일)은 가입 화면에서 받는 항목과 목록·상세 표시가 서로 일치해야 한다.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
