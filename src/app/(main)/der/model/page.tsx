'use client';

import { useState } from 'react';
import { FlaskConical, Scale, Share2, Info, ShieldCheck } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';

// 탄소중립 사업모델 — 사업계획서 지표10(탄소중립 사업모델 발굴). doc 04 §4: 규제 샌드박스 ▸ LCA 평가 ▸ 확산.
// 백엔드 도메인 미구축 — 모델 프레임 안내 + 항목 단위 "준비 중" 라벨(doc 00 §6 정직성 원칙).

// 규제 샌드박스 — 규제신속확인·실증특례(연료전지 배열활용·ORC, 계획서 p.170~171).
const SANDBOX_TRACKS = [
  {
    key: 'quick',
    title: '규제 신속확인',
    desc: '적용 규제 유무·내용을 정부에 확인 요청 — 30일 내 회신. 규제 불명확 사업모델의 진입 리스크 해소.',
    items: [
      '분산에너지 특화지역 직접 전력거래(분산법 §43) 적용 규제 확인',
      '연료전지 배열 활용(히트펌프·흡수식냉동) 열공급 규제 확인',
      'V2G(양방향 충전) 계통 역송 규제 확인',
    ],
  },
  {
    key: 'sandbox',
    title: '실증 특례',
    desc: '현행 규제 특례를 받아 제한된 범위에서 사업모델을 실증 — 연료전지 배열활용·ORC 실증(p.170~171).',
    items: [
      '연료전지 배열 활용 실증 — 회수 열 열공급·흡수식 냉동 통합 운전',
      'ORC(유기랭킨사이클) 공정 배열 회수 발전 실증',
      '에너지스테이션(수소발전 + 전기차 충전) 통합 실증',
    ],
  },
];

const LCA_STEPS = [
  { step: '전과정 정의', desc: '설비 원료–제조–운영–폐기 경계 설정' },
  { step: '배출량 산정', desc: '단계별 온실가스 배출량 산정 — 인벤토리(지표8) 연계' },
  { step: '감축 효과', desc: '기준 대비 감축량 대사(지표3 연계)' },
  { step: '통합 평가', desc: '경제성·탄소저감 통합 평가 → 모델 우선순위' },
];

const SPREAD_ITEMS = [
  '검증 모델 표준화·패키징(설비 구성·운영 매뉴얼)',
  '타 산단 적용 타당성 분석(수요·계통·규제 적합성)',
  '확산 실적 관리 — 성과확산(지표9) 메뉴 연동',
];

const TABS = [
  { key: 'sandbox', label: '규제 샌드박스', icon: <FlaskConical size={14} /> },
  { key: 'lca', label: 'LCA 평가', icon: <Scale size={14} /> },
  { key: 'spread', label: '확산', icon: <Share2 size={14} /> },
] as const;

export default function DerModelPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('sandbox');

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: '분산에너지 효율화' }, { label: '탄소중립 사업모델' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">탄소중립 사업모델</h1>
        <span className="text-xs text-slate-400">사업계획서 지표10 — 모델 발굴·검증·확산</span>
      </div>

      <div className="flex items-center gap-1 border-b border-white/[0.06]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-sky-400 text-white font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'sandbox' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            규제 샌드박스 기반 사업모델 실증 — 분산에너지 특화지역(분산법 §33·35) 내 직접 전력거래(§43) 모델을 규제
            신속확인·실증 특례 트랙으로 검증합니다.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {SANDBOX_TRACKS.map((t) => (
              <div key={t.key} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ShieldCheck size={14} className="text-sky-400" /> {t.title}
                </div>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">{t.desc}</p>
                <ul className="mt-3 space-y-2">
                  {t.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-300">
              <b className="text-amber-400">준비 중</b> — 샌드박스 과제 신청·진행 상태 관리는 백엔드 도메인 구축 후
              제공됩니다. 현재는 계획서 규제 트랙 프레임 안내입니다.
            </div>
          </div>
        </div>
      )}

      {tab === 'lca' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            사업모델별 전과정 탄소저감 효과 평가 — 온실가스 인벤토리(지표8)·감축량(지표3)과 연계.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {LCA_STEPS.map((s, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] text-slate-500">STEP {i + 1}</div>
                <div className="mt-0.5 text-sm font-semibold text-white">{s.step}</div>
                <div className="mt-1 text-[11px] text-slate-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-300">
              <b className="text-amber-400">준비 중</b> — 모델별 LCA 산정 결과는 백엔드 도메인 구축 후 제공됩니다.
              현재는 평가 절차 프레임입니다.
            </div>
          </div>
        </div>
      )}

      {tab === 'spread' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-300">검증된 모델의 타 산단 확산 — 성과확산(지표9) 연계.</p>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <ul className="space-y-2">
              {SPREAD_ITEMS.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" /> {it}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 flex items-start gap-3">
            <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-300">
              <b className="text-amber-400">준비 중</b> — 확산 실적 원장은 백엔드 도메인 구축 후 제공됩니다. 현재는 확산
              절차 프레임 안내입니다.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
