'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signUp } from '@/api/auth/auth';
import { AxiosError } from 'axios';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/Input/PasswordInput';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Alert } from '@/components/ui/Alert';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Radio } from '@/components/ui/Radio';
import { FileUpload } from '@/components/ui/FileUpload';

type SignupType = 'enterprise' | 'consultant';
type EnterpriseRole = 'POWER_OPERATOR' | 'CONSUMER_MANAGER' | 'AGENCY_ADMIN' | 'SPC_OPERATOR';
type Step = 1 | 2 | 3 | 4 | 5;

const ENTERPRISE_ROLE_OPTIONS: { value: EnterpriseRole; label: string }[] = [
  { value: 'CONSUMER_MANAGER', label: '전기사용자' },
  { value: 'POWER_OPERATOR', label: '발전사업자' },
  { value: 'SPC_OPERATOR', label: '관리자 (SPC)' },
];


const STEP_LABELS = ['기업 정보', '계정 생성', '약관 동의', '완료'];


const signupSchema = z
  .object({
    companyType: z.enum(['existing', 'new']),
    companyName: z.string(),
    businessNumber: z.string(),
    representative: z.string(),
    companyPhone: z.string(),
    companyAddress: z.string(),

    consultantName: z.string(),
    consultantEmail: z.string(),
    consultantPhone: z.string(),
    consultantRegion: z.string(),
    consultantExperience: z.string(),
    consultantBio: z.string(),

    email: z.string().min(1, '이메일을 입력해주세요.').email('올바른 이메일 형식이 아닙니다.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
    passwordConfirm: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
    name: z.string().min(1, '이름을 입력해주세요.'),
    department: z.string(),
    phone: z.string(),

    termsService: z.literal(true, { error: '서비스 이용약관에 동의해주세요.' }),
    termsPrivacy: z.literal(true, { error: '개인정보 처리방침에 동의해주세요.' }),
    termsMarketing: z.boolean(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

const STEP2_ENTERPRISE_FIELDS: (keyof SignupFormData)[] = ['companyName', 'businessNumber', 'representative'];
const STEP3_FIELDS: (keyof SignupFormData)[] = ['email', 'password', 'passwordConfirm', 'name'];
const STEP4_FIELDS: (keyof SignupFormData)[] = ['termsService', 'termsPrivacy'];

export default function SignupPage() {
  const [step, setStep] = useState<Step>(2);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signupType] = useState<SignupType>('enterprise');
  const [enterpriseRole, setEnterpriseRole] = useState<EnterpriseRole | null>(null);


  const stepLabels = STEP_LABELS;
  const progress = ((step - 2) / (stepLabels.length - 1)) * 100;

  const {
    register,
    trigger,
    getValues,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyType: 'new',
      companyName: '',
      businessNumber: '',
      representative: '',
      companyPhone: '',
      companyAddress: '',
      consultantName: '',
      consultantEmail: '',
      consultantPhone: '',
      consultantRegion: '',
      consultantExperience: '',
      consultantBio: '',
      email: '',
      password: '',
      passwordConfirm: '',
      name: '',
      department: '',
      phone: '',
      termsService: false as unknown as true,
      termsPrivacy: false as unknown as true,
      termsMarketing: false,
    },
  });

  const companyType = watch('companyType');
  const termsService = watch('termsService');
  const termsPrivacy = watch('termsPrivacy');
  const termsMarketing = watch('termsMarketing');


  async function handleNext() {
    setServerError('');
    if (step === 1) {
      if (!signupType) {
        setServerError('가입 유형을 선택해주세요.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!enterpriseRole) {
        setServerError('유형을 선택해주세요.');
        return;
      }
      if (companyType === 'existing') {
        setStep(3);
        return;
      }
      const valid = await trigger(STEP2_ENTERPRISE_FIELDS);
      if (valid) setStep(3);
    } else if (step === 3) {
      const valid = await trigger(STEP3_FIELDS);
      if (valid) setStep(4);
    }
  }

  async function handleSubmit() {
    const valid = await trigger(STEP4_FIELDS);
    if (!valid) return;

    setSubmitting(true);
    setServerError('');
    const vals = getValues();
    try {
      await signUp({
        email: vals.email,
        password: vals.password,
        name: signupType === 'consultant' ? vals.consultantName : vals.name,
        phone: (signupType === 'consultant' ? vals.consultantPhone : vals.phone) || undefined,
        department: vals.department || undefined,
        signupType: signupType ?? undefined,
        ...(signupType === 'enterprise'
          ? {
              enterpriseRole: enterpriseRole ?? undefined,
              ...(vals.companyType === 'new'
                ? {
                    companyName: vals.companyName || undefined,
                    businessNumber: vals.businessNumber || undefined,
                    representative: vals.representative || undefined,
                    companyPhone: vals.companyPhone || undefined,
                    companyAddress: vals.companyAddress || undefined,
                  }
                : {}),
            }
          : {}),
      });
      setStep(5);
    } catch (err) {
      if (err instanceof AxiosError) {
        const code = err.response?.data?.error?.code;
        if (code === 'U001') {
          setServerError('이미 등록된 이메일입니다.');
          return;
        }
      }
      setServerError('회원가입에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  function firstError(): string | undefined {
    const keys = Object.keys(errors) as (keyof SignupFormData)[];
    return keys.length > 0 ? errors[keys[0]!]?.message : undefined;
  }

  const displayError = serverError || firstError();

  return (
    <div className="animate-[fadeIn_400ms_ease-out]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-white">회원가입</h1>
        <p className="mt-1 text-sm text-slate-400">에너지 플랫폼에 참여하세요</p>
      </div>

      <div className="mb-6">
        <div className="flex justify-between mb-2">
          {stepLabels.map((label, i) => (
            <span
              key={label}
              className={`text-[11px] font-medium ${i + 2 <= step ? 'text-primary' : 'text-slate-500'}`}
            >
              {label}
            </span>
          ))}
        </div>
        <ProgressBar value={progress} />
      </div>

      <div className="rounded-2xl bg-[#0d1520]/80 ring-1 ring-white/[0.08] backdrop-blur-sm p-8 shadow-elevation-4">
        {displayError && (
          <div className="mb-4">
            <Alert variant="error">{displayError}</Alert>
          </div>
        )}

        {step === 2 && signupType === 'enterprise' && (
          <div className="space-y-4 animate-[fadeIn_300ms_ease-out]">
            <h3 className="text-md font-semibold text-white mb-4">기업 정보</h3>

            <Select
              label="유형"
              placeholder="유형을 선택하세요"
              value={enterpriseRole ?? ''}
              onChange={(e) => setEnterpriseRole(e.target.value as EnterpriseRole)}
              options={ENTERPRISE_ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />

            <div className="flex gap-4">
              <Radio
                name="companyType"
                label="신규 기업 등록"
                checked={companyType === 'new'}
                onChange={() => setValue('companyType', 'new')}
              />
              <Radio
                name="companyType"
                label="기존 기업 선택"
                checked={companyType === 'existing'}
                onChange={() => setValue('companyType', 'existing')}
              />
            </div>

            {companyType === 'existing' ? (
              <Select
                label="기업 선택"
                placeholder="소속 기업을 선택하세요"
                options={[
                  { value: '1', label: '(주)그린에너지' },
                  { value: '2', label: '(주)솔라텍' },
                ]}
              />
            ) : (
              <>
                <Input
                  label="기업명"
                  placeholder="(주)그린에너지"
                  error={errors.companyName?.message}
                  {...register('companyName')}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="사업자등록번호"
                    placeholder="000-00-00000"
                    error={errors.businessNumber?.message}
                    {...register('businessNumber')}
                  />
                  <Input
                    label="대표자명"
                    placeholder="홍길동"
                    error={errors.representative?.message}
                    {...register('representative')}
                  />
                </div>
                <Input label="기업 연락처" placeholder="02-0000-0000" {...register('companyPhone')} />
                <Input label="기업 주소" placeholder="서울특별시 강남구" {...register('companyAddress')} />
                {/* 업태·종목 입력 제거 — 서버 미저장 유령 필드. 업종·규모는 가입 후 조직 관리>프로필에서 수집(가입 마찰 최소화). */}
                <div>
                  <p className="text-sm font-medium text-accent mb-1.5">사업자등록증 (선택)</p>
                  <FileUpload accept=".pdf,.jpg,.png" maxSizeMB={10} onChange={() => {}} />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Link href="/login" className="flex-1">
                <Button variant="secondary" className="w-full">
                  돌아가기
                </Button>
              </Link>
              <Button className="flex-1" onClick={handleNext}>
                다음
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-[fadeIn_300ms_ease-out]">
            <h3 className="text-md font-semibold text-white mb-4">계정 생성</h3>
            <Input
              label="아이디 (이메일)"
              type="email"
              placeholder="name@company.com"
              autoComplete="off"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-accent">비밀번호</label>
              <PasswordInput
                placeholder="8자 이상"
                autoComplete="new-password"
                error={errors.password?.message}
                {...register('password')}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-accent">비밀번호 확인</label>
              <PasswordInput
                placeholder="비밀번호를 다시 입력하세요"
                autoComplete="new-password"
                error={errors.passwordConfirm?.message}
                {...register('passwordConfirm')}
              />
            </div>
            {signupType !== 'consultant' && (
              <>
                <Input label="이름" placeholder="홍길동" error={errors.name?.message} {...register('name')} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="부서" placeholder="발전운영팀" {...register('department')} />
                  <Input label="연락처" placeholder="010-0000-0000" {...register('phone')} />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                이전
              </Button>
              <Button className="flex-1" onClick={handleNext}>
                다음
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-[fadeIn_300ms_ease-out]">
            <h3 className="text-md font-semibold text-white mb-4">약관 동의</h3>

            <div className="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <Checkbox
                label="서비스 이용약관 동의 (필수)"
                checked={!!termsService}
                onChange={(e) =>
                  setValue('termsService', e.target.checked as unknown as true, { shouldValidate: true })
                }
              />
              <div className="border-t border-white/[0.06]" />
              <Checkbox
                label="개인정보 처리방침 동의 (필수)"
                checked={!!termsPrivacy}
                onChange={(e) =>
                  setValue('termsPrivacy', e.target.checked as unknown as true, { shouldValidate: true })
                }
              />
              <div className="border-t border-white/[0.06]" />
              <Checkbox
                label="마케팅 정보 수신 동의 (선택)"
                checked={termsMarketing}
                onChange={(e) => setValue('termsMarketing', e.target.checked)}
              />
            </div>

            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              onClick={() => {
                const allChecked = !!termsService && !!termsPrivacy && termsMarketing;
                setValue('termsService', !allChecked as unknown as true);
                setValue('termsPrivacy', !allChecked as unknown as true);
                setValue('termsMarketing', !allChecked);
              }}
            >
              {!!termsService && !!termsPrivacy && termsMarketing ? '전체 해제' : '전체 동의'}
            </button>

            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
                이전
              </Button>
              <Button className="flex-1" loading={submitting} onClick={handleSubmit}>
                가입 신청
              </Button>
            </div>
          </div>
        )}

        {step === 5 && signupType === 'enterprise' && (
          <div className="text-center py-6 animate-[fadeIn_300ms_ease-out]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">가입 신청 완료</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-6">
              <span className="text-white font-medium">{getValues('email')}</span>으로
              <br />
              인증 메일을 발송했습니다.
              <br />
              이메일을 확인하여 인증을 완료해주세요.
              <br />
              <span className="text-slate-500">메일이 오지 않으면 스팸함을 확인해주세요.</span>
            </p>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="w-full">
                로그인으로 돌아가기
              </Button>
            </Link>
          </div>
        )}

      </div>

      <p className="mt-6 text-center text-[11px] text-slate-600">&copy; 2025 에너지 플랫폼. All rights reserved.</p>
    </div>
  );
}
