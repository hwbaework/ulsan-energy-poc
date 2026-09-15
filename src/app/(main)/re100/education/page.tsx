'use client';

import { GraduationCap, Award, PlayCircle } from 'lucide-react';
import { Breadcrumb } from '@/components/layout';
import { useAuthStore } from '@/stores/useAuthStore';
import { useEducationCourses } from '@/hooks/re100/useRe100Ext';

// RE100 교육 — 설계 v2/docs/11 §2.3 + 백엔드 배선(17). 계획서 p.141: 정책정보·수료증 발급/관리.
// 정직 상태(설계 22 정합): mock 폴백 없음 — 실데이터/빈/오류를 정확히 구분 표시.

export default function EducationPage() {
  const companyId = useAuthStore((s) => s.user?.companyId ?? undefined);
  const coursesQ = useEducationCourses(companyId);
  const COURSES = coursesQ.data ?? [];
  const certified = COURSES.filter((c) => c.certified).length;

  const guardReason =
    companyId == null
      ? '회사 정보가 없어 교육 과정을 조회할 수 없습니다'
      : coursesQ.isError
        ? '데이터를 불러오지 못했습니다 — 다시 로그인하세요'
        : '';

  return (
    <div className="p-6 space-y-6">
      <Breadcrumb items={[{ label: 'RE100' }, { label: 'RE100 교육' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">RE100 교육</h1>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <Award size={14} /> 수료 {certified}/{COURSES.length}
        </span>
      </div>
      <p className="text-xs text-slate-400">
        On-line 기초교육 + 현장 1:1 심화교육. 수강 완료 시 수료증이 발급·관리됩니다.
      </p>

      {guardReason && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-300">
          {guardReason}
        </div>
      )}
      {!guardReason && COURSES.length === 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-sm text-slate-400">
          등록된 교육 과정이 없습니다.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {COURSES.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-primary" />
                <h3 className="text-sm font-medium text-white">{c.title}</h3>
              </div>
              {c.certified && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                  <Award size={11} /> 수료
                </span>
              )}
            </div>
            <div className="mt-4 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${c.progress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{c.progress}% 완료</span>
              {!c.certified && (
                <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
                  <PlayCircle size={13} /> {c.progress > 0 ? '이어보기' : '수강 시작'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
