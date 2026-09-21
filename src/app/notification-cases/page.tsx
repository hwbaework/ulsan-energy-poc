'use client';

/**
 * 알림 케이스(유형) 카탈로그 — 시스템이 발송할 수 있는 알림 종류를 한 곳에 정리.
 * 디자인 가이드(/guide)와 같은 성격의 참조 페이지. URL: /notification-cases
 */

interface NotifCase {
  code: string;
  label: string;
}
interface NotifGroup {
  title: string;
  scope: 'POC' | '확장';
  items: NotifCase[];
}

const GROUPS: NotifGroup[] = [
  {
    title: '이상감지 · 관제',
    scope: 'POC',
    items: [
      { code: 'ANOMALY_DETECTED', label: '이상 감지' },
      { code: 'ANOMALY_ACKNOWLEDGED', label: '이상 확인' },
      { code: 'ANOMALY_WORK_STARTED', label: '조치 시작' },
      { code: 'ANOMALY_RESOLVED', label: '이상 해소' },
      { code: 'ANOMALY_FALSE_ALARM', label: '오탐 처리' },
      { code: 'ANOMALY_ESCALATED', label: '이상 에스컬레이션' },
      { code: 'DETECTION_RESOLVED', label: '감지 해소' },
      { code: 'OPERATOR_ACKNOWLEDGED', label: '운영자 확인' },
      { code: 'OPERATOR_ACTION_REPORTED', label: '조치 보고' },
    ],
  },
  {
    title: '수급 · 리포트',
    scope: 'POC',
    items: [
      { code: 'SUPPLY_DEMAND_ALERT', label: '수급 경보' },
      { code: 'DAILY_REPORT_GENERATED', label: '일일 리포트 생성' },
      { code: 'KPX_FORECAST_SUBMITTED', label: 'KPX 예측 제출' },
      { code: 'DAILY_AGGREGATION_COMPLETED', label: '일일 집계 완료' },
    ],
  },
  {
    title: 'PPA 계약',
    scope: 'POC',
    items: [
      { code: 'PPA_CONTRACT_CREATED', label: 'PPA 계약 생성' },
      { code: 'PPA_CONTRACT_ACTIVATED', label: '계약 발효' },
      { code: 'PPA_CONTRACT_TERMINATED', label: '계약 해지' },
      { code: 'PPA_CONTRACT_ISSUED', label: '계약서 발행' },
      { code: 'TRADING_LEASE_PROPOSAL_CREATED', label: '제안 생성' },
      { code: 'TRADING_LEASE_PROPOSAL_AGREED', label: '제안 합의' },
      { code: 'PPA_CONTRACT_CHANGE_REQUESTED', label: '변경 요청' },
      { code: 'PPA_CONTRACT_CHANGE_APPROVED', label: '변경 승인' },
      { code: 'PPA_CONTRACT_CHANGE_REJECTED', label: '변경 반려' },
      { code: 'PPA_GENERATOR_APPROVAL_REQUESTED', label: '발전사 승인 요청' },
      { code: 'PPA_GENERATOR_APPROVAL_COMPLETED', label: '발전사 승인 완료' },
      { code: 'PPA_GENERATOR_APPROVAL_REJECTED', label: '발전사 승인 반려' },
    ],
  },
  {
    title: '정산 · 세금계산서',
    scope: 'POC',
    items: [
      { code: 'SETTLEMENT_CONFIRMED', label: '정산 확정' },
      { code: 'SETTLEMENT_DISPUTED', label: '정산 이의' },
      { code: 'SETTLEMENT_REVIEW_STARTED', label: '정산 검토 시작' },
      { code: 'SETTLEMENT_ADJUSTED', label: '정산 조정' },
      { code: 'SETTLEMENT_RECONFIRMED', label: '정산 재확정' },
      { code: 'INVOICE_ISSUED', label: '세금계산서 발행' },
      { code: 'INVOICE_PAID', label: '대금 입금' },
    ],
  },
  {
    title: '거래 · 매칭',
    scope: 'POC',
    items: [
      { code: 'TRADING_REQUEST_CREATED', label: '거래 신청 등록' },
      { code: 'TRADING_REQUEST_UPDATED', label: '거래 신청 수정' },
      { code: 'TRADING_REQUEST_DELETED', label: '거래 신청 삭제' },
      { code: 'TRADING_REQUEST_STATUS_CHANGED', label: '거래 신청 상태 변경' },
      { code: 'MATCH_CREATED', label: '매칭 생성' },
      { code: 'MATCH_GENERATOR_ACCEPTED', label: '발전사 매칭 수락' },
      { code: 'MATCH_ACCEPTED', label: '매칭 수락' },
      { code: 'MATCH_DECLINED', label: '매칭 거절' },
    ],
  },
  {
    title: '온보딩',
    scope: 'POC',
    items: [
      { code: 'ONBOARDING_STARTED', label: '온보딩 시작' },
      { code: 'ONBOARDING_STEP_SUBMITTED', label: '단계 제출' },
      { code: 'ONBOARDING_STEP_APPROVED', label: '단계 승인' },
      { code: 'ONBOARDING_STEP_REJECTED', label: '단계 반려' },
      { code: 'ONBOARDING_COMPLETED', label: '온보딩 완료' },
    ],
  },
  {
    title: '컨설팅 (확장 · 참고)',
    scope: '확장',
    items: [
      { code: 'CONSULTATION_CREATED', label: '상담 생성' },
      { code: 'CONSULTANT_ASSIGNED', label: '컨설턴트 배정' },
      { code: 'CONSULTATION_COMPLETED', label: '상담 완료' },
      { code: 'CONSULTATION_CANCELLED', label: '상담 취소' },
      { code: 'PROPOSAL_CREATED', label: '제안서 생성' },
      { code: 'PROPOSAL_ACCEPTED', label: '제안 수락' },
      { code: 'PROPOSAL_DECLINED', label: '제안 거절' },
      { code: 'REPORT_SUBMITTED', label: '보고서 제출' },
      { code: 'REPORT_APPROVED', label: '보고서 승인' },
      { code: 'REPORT_SPC_REVIEW_REQUESTED', label: 'SPC 검토 요청' },
      { code: 'REPORT_SPC_APPROVED', label: 'SPC 승인' },
      { code: 'REPORT_COMMENT_ADDED', label: '보고서 코멘트' },
      { code: 'CONSULTING_SETTLEMENT_APPROVED', label: '컨설팅 정산 승인' },
      { code: 'CONSULTING_SETTLEMENT_PAID', label: '컨설팅 정산 지급' },
      { code: 'CONSULTING_INVOICE_ISSUED', label: '컨설팅 계산서 발행' },
      { code: 'REVIEW_CREATED', label: '리뷰 등록' },
      { code: 'MILESTONE_CREATED', label: '마일스톤 생성' },
      { code: 'MILESTONE_STARTED', label: '마일스톤 시작' },
      { code: 'MILESTONE_COMPLETED', label: '마일스톤 완료' },
      { code: 'SCHEDULE_REQUESTED', label: '일정 요청' },
      { code: 'SCHEDULE_CONFIRMED', label: '일정 확정' },
      { code: 'SCHEDULE_CANCELLED', label: '일정 취소' },
      { code: 'SCHEDULE_ACCEPTED', label: '일정 수락' },
      { code: 'SCHEDULE_REJECTED', label: '일정 거절' },
      { code: 'SCHEDULE_RESCHEDULE_REQUESTED', label: '일정 변경 요청' },
      { code: 'CHAT_MESSAGE_SENT', label: '채팅 메시지' },
      { code: 'SURVEY_SUBMITTED', label: '설문 제출' },
      { code: 'REFERRAL_CREATED', label: '추천 등록' },
      { code: 'CONTRACT_SIGNED', label: '계약 서명' },
    ],
  },
  {
    title: '리스 (확장 · 참고)',
    scope: '확장',
    items: [
      { code: 'LEASE_CONTRACT_CREATED', label: '리스 계약 생성' },
      { code: 'LEASE_TERMINATED', label: '리스 해지' },
      { code: 'LEASE_INVOICE_ISSUED', label: '리스 계산서 발행' },
      { code: 'LEASE_INVOICE_PAID', label: '리스 대금 입금' },
      { code: 'LEASE_INVOICE_DISPUTED', label: '리스 대금 이의' },
      { code: 'LEASE_REQUEST_SUBMITTED', label: '리스 신청' },
      { code: 'LEASE_REQUEST_ACCEPTED', label: '리스 신청 수락' },
      { code: 'LEASE_EQUIPMENT_REGISTERED', label: '설비 등록' },
      { code: 'LEASE_RECOVERY_SCHEDULED', label: '회수 예정' },
      { code: 'LEASE_RECOVERY_COMPLETED', label: '회수 완료' },
      { code: 'LEASE_WARRANTY_WARNING', label: '보증 만료 임박' },
      { code: 'LEASE_INSURANCE_EXPIRED', label: '보험 만료' },
    ],
  },
];

export default function NotificationCasesPage() {
  const total = GROUPS.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="min-h-screen bg-surface-dark bg-[url('/images/bg.jpg')] bg-cover bg-fixed bg-center">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">알림 케이스 정리</h1>
          <p className="mt-1 text-sm text-slate-400">
            시스템이 발송할 수 있는 알림 유형 전체({total}종)를 카테고리로 정리했습니다. POC 범위와 확장(참고)을 구분했습니다.
          </p>
        </div>

        {GROUPS.map((g) => (
          <section key={g.title} className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{g.title}</h2>
              <span className="text-xs text-slate-500">{g.items.length}종</span>
              <span
                className={
                  'rounded-md px-2 py-0.5 text-[10px] font-medium ' +
                  (g.scope === 'POC' ? 'bg-primary/10 text-primary' : 'bg-white/[0.06] text-slate-400')
                }
              >
                {g.scope === 'POC' ? 'POC 범위' : '확장 · 참고'}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0d1520]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-xs text-slate-500">
                    <th className="px-4 py-2.5 font-medium">알림</th>
                    <th className="px-4 py-2.5 font-medium">코드</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it) => (
                    <tr key={it.code} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5 text-white">{it.label}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{it.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
