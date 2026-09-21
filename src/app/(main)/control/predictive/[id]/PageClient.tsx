'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Info, Send, Sparkles } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { ConnectionBanner, InverterDetailSection } from '@/components/features/monitoring/InverterPanels';
import { useMonitoringPlantDetail } from '@/hooks/monitoring/useMonitoring';
import { getPersona, usePersonaOverride } from '@/lib/persona';
import { useAuthStore } from '@/stores/useAuthStore';
import type { InverterStatus, MonitoringPlant } from '@/types/monitoring';

// 예지보전 상세 — 발전소 1곳의 인버터별 현황 + 규칙 기반 점검 제안.
// 제안은 실측 이력·예측 모델이 아니라 현재 연결 상태(connectionState·statusMessages)만 보는
// 단순 규칙이다. 실제 예측/AI 판단으로 바꾸려면 이력 데이터와 모델이 먼저 필요하다.
interface Suggestion {
  id: string;
  level: 'danger' | 'warning' | 'success';
  text: string;
}

function buildSuggestions(plant: MonitoringPlant): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const status = plant.connectionStatus;

  if (status?.rtuPower === 'OFF') {
    suggestions.push({ id: 'rtu-power', level: 'danger', text: 'RTU 전원이 꺼져 있습니다 — 전원 공급 상태를 먼저 확인하세요.' });
  }
  if (status?.rtuConnection !== 'NORMAL') {
    suggestions.push({ id: 'rtu-conn', level: 'warning', text: 'RTU 통신이 불안정합니다 — 네트워크·게이트웨이 연결을 점검하세요.' });
  }
  for (const inv of plant.inverters ?? []) {
    if (inv.connectionState !== 'NORMAL') {
      suggestions.push({
        id: `inv-${inv.number}-conn`,
        level: 'danger',
        text: `인버터 #${inv.number} 통신 오류 — 케이블 연결과 통신 모듈 상태를 점검하세요.`,
      });
    } else if (inv.statusMessages.length > 0) {
      suggestions.push({
        id: `inv-${inv.number}-msg`,
        level: 'warning',
        text: `인버터 #${inv.number} "${inv.statusMessages[0]}" — 현장 점검을 권장합니다.`,
      });
    }
  }
  if (suggestions.length === 0) {
    suggestions.push({ id: 'ok', level: 'success', text: '이상 징후가 없습니다. 정기 점검 일정만 확인하면 됩니다.' });
  }
  return suggestions;
}

const SUGGESTION_DOT: Record<Suggestion['level'], string> = {
  danger: 'bg-red-500',
  warning: 'bg-amber-500',
  success: 'bg-emerald-500',
};

/** 진단 질의 UI 목업 — 실제 백엔드·LLM 연동 없이 키워드 매칭으로만 응답한다. */
function answerQuery(query: string, plant: MonitoringPlant, suggestions: Suggestion[]): string {
  const inverters = plant.inverters ?? [];
  const abnormal = suggestions.filter((s) => s.level !== 'success');
  const q = query.trim();

  if (!q) return '질문을 입력해 주세요.';
  if (/이상|문제|점검|상태/.test(q)) {
    if (abnormal.length === 0) return '현재 이상 징후가 없습니다. 모든 인버터가 정상입니다.';
    return `현재 ${abnormal.length}건의 점검 필요 항목이 있습니다: ${abnormal.map((s) => s.text).join(' / ')}`;
  }
  if (/발전량|출력|kwh|kw/i.test(q)) {
    const totalAc = inverters.reduce((s, inv) => s + inv.ac.power, 0);
    const totalDaily = inverters.reduce((s, inv) => s + inv.dailyEnergy, 0);
    return `현재 AC 출력 합계는 ${totalAc.toFixed(1)}kW, 금일 발전량 합계는 ${totalDaily.toFixed(1)}kWh입니다.`;
  }
  if (/온도/.test(q)) {
    return '설비 온도 실계측 연동은 아직 준비되지 않았습니다. (하드웨어 확인 필요)';
  }
  return '죄송합니다 — 아직 데모 단계라 "이상 여부", "발전량" 관련 질문만 답변할 수 있어요.';
}

export default function PredictiveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const override = usePersonaOverride((s) => s.override);
  const persona = override ?? getPersona(user);
  // 발전사업자는 목록을 거치지 않고 바로 상세로 오므로 목록 뒤로가기를 두지 않는다.
  const showBack = persona !== 'generator';
  const numId = Number(id);
  const { data: plant, isLoading } = useMonitoringPlantDetail(numId);

  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<{ q: string; a: string }[]>([]);

  if (isLoading || !plant) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: '통합관제', path: '/dashboard' }, { label: '예지보전', path: '/control/predictive' }]} />
        <p className="text-sm text-slate-400">불러오는 중…</p>
      </div>
    );
  }

  const suggestions = buildSuggestions(plant);

  const submitQuery = () => {
    if (!query.trim()) return;
    const a = answerQuery(query, plant, suggestions);
    setHistory((h) => [...h, { q: query, a }]);
    setQuery('');
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: '통합관제', path: '/dashboard' },
          { label: '예지보전', path: '/control/predictive' },
          { label: plant.name },
        ]}
      />
      <div className="flex items-center gap-3">
        {showBack && (
          <Button size="sm" variant="ghost" onClick={() => router.push('/control/predictive')} aria-label="예지보전 목록으로">
            <ArrowLeft size={16} />
          </Button>
        )}
        <h1 className="text-xl font-bold text-white">{plant.name}</h1>
      </div>

      {plant.connectionStatus && <ConnectionBanner status={plant.connectionStatus} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI 점검 제안 */}
        <div className="rounded-xl border border-white/[0.06] bg-surface-card p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <Sparkles size={15} className="text-primary" /> AI 점검 제안
          </h3>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-3 py-2.5">
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', SUGGESTION_DOT[s.level])} />
                <span className="text-sm text-slate-300">{s.text}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5">
            <Info size={14} className="mt-0.5 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-200/90">
              현재 연결 상태 기반 규칙 제안입니다. 이력 데이터·예측 모델 연동 전까지는 참고용으로만 사용하세요.
            </p>
          </div>
        </div>

        {/* AI 진단 대화 */}
        <div className="rounded-xl border border-white/[0.06] bg-surface-card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-1.5">
            <Sparkles size={15} className="text-primary" /> AI 진단 대화
          </h3>
          <div className="flex-1 space-y-2 mb-3 min-h-[120px] max-h-64 overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-slate-500">예: &quot;지금 이상 있어?&quot;, &quot;발전량 얼마나 나와?&quot; 처럼 물어보세요.</p>
            ) : (
              history.map((h, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-xs text-sky-400">Q. {h.q}</p>
                  <p className="text-sm text-slate-300">A. {h.a}</p>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitQuery()}
              placeholder="질문을 입력하세요"
              className="flex-1 rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
            />
            <Button variant="primary" size="sm" onClick={submitQuery}>
              <Send size={14} />
            </Button>
          </div>
        </div>
      </div>

      {plant.inverters && plant.inverters.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-surface-card p-5">
          <h3 className="text-sm font-semibold text-white mb-3">인버터별 현황</h3>
          <InverterDetailSection inverters={plant.inverters as InverterStatus[]} />
        </div>
      )}
    </div>
  );
}
