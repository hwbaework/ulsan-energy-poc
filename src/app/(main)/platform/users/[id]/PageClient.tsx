'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Mail, Phone, Building2, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Badge } from '@/components/ui/Badge';
import { SectionCard } from '@/components/features/SectionCard';
import { useUser, useSuspendUser, useActivateUser } from '@/hooks/platform/useUsers';
import { useToastStore } from '@/stores/useToastStore';

const ROLE_LABEL_MAP: Record<string, string> = {
  SYSTEM_ADMIN: '시스템 관리자',
  COMPANY_ADMIN: '기업 관리자',
  POWER_OPERATOR: '발전사업자',
  CONSUMER_MANAGER: '수용가 담당자',
  CONSULTANT: '컨설턴트',
  SPC_OPERATOR: 'SPC 운영자',
  FIELD_OPERATOR: '현장 운영자',
  AGENCY_ADMIN: '용역사 관리자',
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const showToast = useToastStore((s) => s.add);
  const userId = Number(params.id);

  const { data: user, isLoading } = useUser(userId);
  const suspendMut = useSuspendUser();
  const activateMut = useActivateUser();

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">로딩 중...</p>
      </div>
    );
  }

  const userRole = user?.roles?.[0] ?? '';

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: '관리' }, { label: '회원 관리', path: '/platform/users' }, { label: user.name }]} />

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/platform/users')}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name}</h1>
          <p className="text-sm text-slate-400">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <SectionCard title="기본 정보">
            <div className="grid grid-cols-2 gap-y-5 gap-x-8">
              <InfoField icon={<Mail size={14} />} label="이메일" value={user.email} />
              <InfoField icon={<Phone size={14} />} label="연락처" value={user.phone || '-'} />
              <InfoField icon={<Building2 size={14} />} label="소속" value={user.companyName || '-'} />
              <InfoField
                icon={<Shield size={14} />}
                label="역할"
                value={ROLE_LABEL_MAP[userRole] ?? (userRole || '미배정')}
              />
              <InfoField icon={<Calendar size={14} />} label="가입일" value={user.createdAt?.split('T')[0] ?? '-'} />
              <InfoField
                icon={<Calendar size={14} />}
                label="최근 로그인"
                value={user.lastLoginAt?.replace('T', ' ').slice(0, 16) ?? '-'}
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="상태">
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] text-2xl font-bold text-slate-300">
                {user.name[0]}
              </div>
              <Badge variant={user.status === 'ACTIVE' ? 'success' : user.status === 'PENDING' ? 'warning' : 'danger'}>
                {user.status === 'ACTIVE' ? '활성' : user.status === 'PENDING' ? '대기' : '정지'}
              </Badge>
            </div>
          </SectionCard>

          <SectionCard title="관리">
            <div className="space-y-2">
              {user.status === 'ACTIVE' && (
                <Button
                  variant="danger"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await suspendMut.mutateAsync(userId);
                      showToast('success', '계정이 정지되었습니다');
                    } catch {
                      showToast('error', '처리에 실패했습니다');
                    }
                  }}
                >
                  계정 정지
                </Button>
              )}
              {user.status === 'SUSPENDED' && (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    try {
                      await activateMut.mutateAsync(userId);
                      showToast('success', '계정이 활성화되었습니다');
                    } catch {
                      showToast('error', '처리에 실패했습니다');
                    }
                  }}
                >
                  계정 활성화
                </Button>
              )}
              <Button variant="secondary" size="sm" className="w-full" onClick={() => router.push('/platform/users')}>
                목록으로
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-slate-500">{icon}</span>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-sm text-white">{value}</p>
    </div>
  );
}
