'use client';

import { Suspense, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Video, Phone, MapPin, Calendar, Clock, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { useConsultation, useCreateSchedule } from '@/hooks/consulting/useConsultations';
import { useToastStore } from '@/stores/useToastStore';

type ConsultMethod = 'video' | 'phone' | 'visit';

const METHODS = [
  { id: 'video' as ConsultMethod, icon: Video, label: '화상 상담', desc: 'Zoom/Google Meet으로 진행' },
  { id: 'phone' as ConsultMethod, icon: Phone, label: '전화 상담', desc: '전화로 간편하게 진행' },
  { id: 'visit' as ConsultMethod, icon: MapPin, label: '방문 상담', desc: '컨설턴트가 직접 방문' },
];

const TIME_SLOTS = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

export default function PreConsultationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">로딩 중...</div>}>
      <PreConsultationContent />
    </Suspense>
  );
}

function PreConsultationContent() {
  const { id } = useParams<{ id: string }>();
  const consultationId = Number(id);
  const router = useRouter();
  const toast = useToastStore((s) => s.add);

  const { data: consultation } = useConsultation(consultationId);
  const createSchedule = useCreateSchedule();

  const c = (consultation ?? {}) as any;

  const [method, setMethod] = useState<ConsultMethod>('video');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [agenda, setAgenda] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const today = new Date();
  const minDate = new Date(today.getTime() + 86400000).toISOString().split('T')[0];

  const handleSubmit = () => {
    if (!selectedDate || !selectedTime) return;
    createSchedule.mutate(
      {
        consultationId,
        data: {
          scheduledDate: selectedDate,
          scheduledTime: selectedTime,
          memo: `[사전상담] ${method === 'video' ? '화상' : method === 'phone' ? '전화' : '방문'} | ${agenda}`.trim(),
        },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          toast('success', '사전 상담이 예약되었습니다');
        },
        onError: () => toast('error', '예약에 실패했습니다'),
      },
    );
  };

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="relative z-10 w-full max-w-lg mx-4 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden p-8">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mb-4">
              <CheckCircle2 size={32} className="text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white">사전 상담이 예약되었습니다</h2>
            <p className="text-sm text-slate-400 mt-2">
              {selectedDate} {selectedTime} · {method === 'video' ? '화상' : method === 'phone' ? '전화' : '방문'} 상담
            </p>
            <p className="text-xs text-slate-500 mt-4">컨설턴트 확정 후 알림으로 안내드립니다</p>
          </div>

          <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-5 mt-6">
            <p className="text-xs text-slate-500 mb-3">다음 단계</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  &#10003;
                </div>
                <span className="text-xs text-slate-400 line-through">견적 요청</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  &#10003;
                </div>
                <span className="text-xs text-slate-400 line-through">제안서 수락</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                  &#10003;
                </div>
                <span className="text-xs text-slate-400 line-through">사전 상담 예약</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary text-[10px] ring-2 ring-primary/30">
                  4
                </div>
                <span className="text-xs text-primary font-medium">계약 체결</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button variant="secondary" className="flex-1" onClick={() => router.push('/consulting')}>
              나중에 진행
            </Button>
            <Button className="flex-1" onClick={() => router.push(`/consulting/contract/${consultationId}`)}>
              계약 진행하기 <ArrowRight size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-2xl mx-4 my-8 rounded-2xl bg-[#0d1520] ring-1 ring-white/[0.08] shadow-2xl overflow-hidden">
        <div className="px-8 pt-5">
          <Breadcrumb items={[{ label: '통합에너지 컨설팅', path: '/consulting' }, { label: '사전 상담' }]} />
        </div>

        <div className="flex items-center justify-between border-b border-white/[0.06] px-8 py-5">
          <div>
            <h1 className="text-xl font-bold text-white">사전 상담 예약</h1>
            <p className="mt-0.5 text-xs text-slate-400">계약 전 컨설턴트와 프로젝트 범위를 조율하세요</p>
          </div>
          <button
            onClick={() => router.push('/consulting')}
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            aria-label="닫기"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Progress */}
          <div className="flex items-center gap-3">
            {['견적 요청', '제안서 비교', '사전 상담', '계약 체결'].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                      i < 2 && 'bg-emerald-500/20 text-emerald-400',
                      i === 2 && 'bg-primary/20 text-primary ring-2 ring-primary/30',
                      i > 2 && 'bg-white/[0.04] text-slate-500',
                    )}
                  >
                    {i < 2 ? <CheckCircle2 size={10} /> : i + 1}
                  </div>
                  <span
                    className={cn('text-xs whitespace-nowrap', i === 2 ? 'text-primary font-medium' : 'text-slate-500')}
                  >
                    {step}
                  </span>
                </div>
                {i < 3 && <div className={cn('h-px w-8', i < 2 ? 'bg-emerald-500/40' : 'bg-white/[0.08]')} />}
              </div>
            ))}
          </div>

          {/* Consultant info */}
          {c.consultantName && (
            <div className="rounded-xl bg-[#0d1520] ring-1 ring-white/[0.06] p-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {c.consultantName.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{c.consultantName} 컨설턴트</p>
                <p className="text-xs text-slate-500">{c.domain ?? 'RE100'} 컨설팅</p>
              </div>
            </div>
          )}

          {/* Method selection */}
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">상담 방식</p>
            <div className="grid grid-cols-3 gap-3">
              {METHODS.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className={cn(
                      'rounded-xl p-4 text-center ring-1 transition-all',
                      method === m.id
                        ? 'bg-primary/10 ring-primary/40'
                        : 'bg-white/[0.02] ring-white/[0.06] hover:ring-white/[0.12]',
                    )}
                  >
                    <Icon size={20} className={cn('mx-auto', method === m.id ? 'text-primary' : 'text-slate-400')} />
                    <p className={cn('mt-2 text-sm font-medium', method === m.id ? 'text-white' : 'text-slate-400')}>
                      {m.label}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{m.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date selection */}
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">날짜 선택</p>
            <input
              type="date"
              min={minDate}
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime('');
              }}
              className="w-full h-10 rounded-xl border border-accent/30 bg-surface-dark px-4 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          {/* Time selection */}
          {selectedDate && (
            <div>
              <p className="text-sm font-medium text-slate-400 mb-3">시간 선택</p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {TIME_SLOTS.map((time) => (
                  <button
                    key={time}
                    onClick={() => setSelectedTime(time)}
                    className={cn(
                      'rounded-lg py-2.5 text-xs ring-1 transition-all flex items-center justify-center gap-1',
                      selectedTime === time
                        ? 'bg-primary/10 ring-primary/40 text-primary font-medium'
                        : 'bg-white/[0.02] ring-white/[0.06] text-slate-400 hover:ring-white/[0.12]',
                    )}
                  >
                    <Clock size={10} />
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Agenda */}
          <div>
            <p className="text-sm font-medium text-slate-400 mb-3">상담 시 논의하고 싶은 내용 (선택)</p>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              rows={3}
              placeholder="예: 사업장 2곳의 우선순위, PPA 계약 가능 여부, 6월 중 시작 가능한지"
              className="w-full rounded-xl border border-accent/30 bg-surface-dark px-4 py-3 text-sm text-white placeholder:text-accent/40 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
          </div>

          {/* Summary */}
          {selectedDate && selectedTime && (
            <div className="rounded-xl bg-primary/5 ring-1 ring-primary/20 p-5">
              <p className="text-xs text-slate-500 mb-3">예약 확인</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <Calendar size={14} />
                  </div>
                  <p className="text-sm font-bold text-white">{selectedDate}</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    <Clock size={14} />
                  </div>
                  <p className="text-sm font-bold text-white">{selectedTime}</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-primary mb-1">
                    {method === 'video' ? (
                      <Video size={14} />
                    ) : method === 'phone' ? (
                      <Phone size={14} />
                    ) : (
                      <MapPin size={14} />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white">
                    {method === 'video' ? '화상' : method === 'phone' ? '전화' : '방문'}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center mt-3">
                예약 후 컨설턴트가 확정하면 양쪽 모두에게 알림이 발송됩니다
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => router.back()}>
              돌아가기
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push(`/consulting/contract/${consultationId}`)}>
                상담 없이 계약 진행
              </Button>
              <Button onClick={handleSubmit} disabled={!selectedDate || !selectedTime || createSchedule.isPending}>
                {createSchedule.isPending ? (
                  <Loader2 size={14} className="animate-spin mr-1" />
                ) : (
                  <Calendar size={14} className="mr-1" />
                )}
                상담 예약하기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
