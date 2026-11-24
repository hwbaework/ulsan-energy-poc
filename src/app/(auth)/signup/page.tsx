'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useCompanies } from '@/hooks/platform/useCompanies';

import { LIMIT } from '@/lib/field-limits';
import { AddressInput } from '@/components/ui/AddressInput';
import { Modal } from '@/components/ui/Modal';
import { PRIVACY_POLICY, SIGNUP_TERMS, type TermsDoc } from '@/lib/terms';
type SignupType = 'enterprise' | 'consultant';
type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ['기업 정보', '계정 생성', '약관 동의', '완료'];

const signupSchema = z
  .object({
    companyType: z.enum(['existing', 'new']),
    // 신규 기업 — 사업자등록증에 적힌 값은 빠짐없이 받는다(2026-11-06 사용자). 연락처만 선택
    companyName: z.string().trim().min(1, '기업명을 입력해주세요.'),
    businessNumber: z.string().trim().min(1, '사업자등록번호를 입력해주세요.'),
    representative: z.string().trim().min(1, '대표자명을 입력해주세요.'),
    bizType: z.string().trim().min(1, '업태를 입력해주세요.'),
    bizCategory: z.string().trim().min(1, '종목을 입력해주세요.'),
    companyPhone: z.string(),
    companyAddress: z.string().trim().min(1, '기업 주소를 입력해주세요.'),

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
    // 연락처는 필수 — 가입 검토 · 미팅 일정에 관리자가 전화한다(2026-11-24 사용자). 인증은 없고 형식만(숫자 · 하이픈, 숫자 9~11자리)
    phone: z
      .string()
      .trim()
      .min(1, '연락처를 입력해주세요.')
      .refine((v) => /^[0-9-]+$/.test(v) && /^\d{9,11}$/.test(v.replace(/-/g, '')), '올바른 연락처 형식이 아닙니다.'),

    termsService: z.literal(true, { error: '서비스 이용약관에 동의해주세요.' }),
    termsPrivacy: z.literal(true, { error: '개인정보 수집 · 이용에 동의해주세요.' }),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

type SignupFormData = z.infer<typeof signupSchema>;

const STEP2_ENTERPRISE_FIELDS: (keyof SignupFormData)[] = ['companyName', 'businessNumber', 'representative', 'bizType', 'bizCategory', 'companyAddress'];
const STEP3_FIELDS: (keyof SignupFormData)[] = ['email', 'password', 'passwordConfirm', 'name', 'phone'];
const STEP4_FIELDS: (keyof SignupFormData)[] = ['termsService', 'termsPrivacy'];

export default function SignupPage() {
  const [step, setStep] = useState<Step>(2);
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signupType] = useState<SignupType>('enterprise');
  // 사업자등록증 — 신규 기업은 필수. 관리자가 검토 창에서 그대로 열어 본다
  const [license, setLicense] = useState<{ name: string; url: string } | null>(null);
  // 기존 기업 — 실제 기업 목록에서 고른다
  const [existingCompanyId, setExistingCompanyId] = useState('');
  const { data: companyList } = useCompanies();

  const stepLabels = STEP_LABELS;
  const progress = ((step - 2) / (stepLabels.length - 1)) * 100;

  const {
    register,
    trigger,
    getValues,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyType: 'new',
      companyName: '',
      businessNumber: '',
      representative: '',
      bizType: '',
      bizCategory: '',
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
    },
  });

  const companyType = watch('companyType');

  // Alt + 1 — 지금 단계의 칸을 샘플 값으로 채운다(화면설계서 캡처용, 2026-11-24 사용자). 값은 입력 칸의 안내 글자와 같은 샘플이고 실제 기업이 아니다
  const stepRef = useRef(step);
  stepRef.current = step;
  useEffect(() => {
    const fill = () => {
      const st = stepRef.current;
      if (st === 2) {
        setValue('companyType', 'new');
        setValue('companyName', '(주)그린에너지');
        setValue('businessNumber', '123-45-67890');
        setValue('representative', '홍길동');
        setValue('companyAddress', '울산 남구 중앙로 201 3층');
        setValue('companyPhone', '052-000-0000');
        setValue('bizType', '제조업');
        setValue('bizCategory', '금속 가공');
      } else if (st === 3) {
        setValue('email', 'hong@greenenergy.co.kr');
        setValue('name', '홍길동');
        setValue('password', 'sample1234');
        setValue('passwordConfirm', 'sample1234');
        setValue('department', '발전운영팀');
        setValue('phone', '010-0000-0000');
      } else if (st === 4) {
        setValue('termsService', true);
        setValue('termsPrivacy', true);
      }
      setServerError('');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.code === 'Digit1' || e.code === 'Numpad1')) {
        e.preventDefault();
        fill();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const termsService = watch('termsService');
  const termsPrivacy = watch('termsPrivacy');
  // 약관 보기 팝업 — 어느 약관을 열었는지
  const [termsOpen, setTermsOpen] = useState<TermsDoc | null>(null);

  async function handleNext() {
    setServerError('');
    if (step === 1) {
      if (!signupType) {
        setServerError('가입 유형을 선택해주세요.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (companyType === 'existing') {
        if (!existingCompanyId) {
          setServerError('소속 기업을 선택해주세요.');
          return;
        }
        setStep(3);
        return;
      }
      const valid = await trigger(STEP2_ENTERPRISE_FIELDS);
      if (!valid) return;
      if (!license) {
        setServerError('사업자등록증을 업로드해주세요.');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      const valid = await trigger(STEP3_FIELDS);
      if (!valid) return;
      // 비밀번호 확인 — 스키마의 일치 검사는 약관(아직 체크 전)이 걸려 있으면 돌지 않아 여기서 직접 본다. 안 보면 서로 다른 비밀번호로 넘어간다
      if (getValues('password') !== getValues('passwordConfirm')) {
        setError('passwordConfirm', { type: 'validate', message: '비밀번호가 일치하지 않습니다.' });
        return;
      }
      setStep(4);
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
              ...(vals.companyType === 'existing' ? { existingCompanyId: Number(existingCompanyId) } : {}),
              ...(vals.companyType === 'new'
                ? {
                    licenseFileName: license?.name,
                    licenseFileUrl: license?.url,
                    companyName: vals.companyName || undefined,
                    businessNumber: vals.businessNumber || undefined,
                    representative: vals.representative || undefined,
                    bizType: vals.bizType || undefined,
                    bizCategory: vals.bizCategory || undefined,
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
              className={`text-xs font-medium ${i + 2 <= step ? 'text-primary' : 'text-slate-500'}`}
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

            {/* 칸을 옆으로 놓는다 — 스크롤 없이 한 화면에 들어오게(2026-11-24 사용자) */}
            {/* 유형(전기사용자 / 발전사업자)은 묻지 않는다 — 그냥 가입하고, 새 기업은 전기사용자로 시작(2026-11-24 사용자) */}
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
                value={existingCompanyId}
                onChange={(e) => setExistingCompanyId(e.target.value)}
                options={(((companyList as unknown as { content?: { id: number; name: string; status?: string }[] })?.content) ?? [])
                  .filter((c) => c.status === 'ACTIVE')
                  .map((c) => ({ value: String(c.id), label: c.name }))}
              />
            ) : (
              <>
                <div className="grid grid-cols-4 items-start gap-3">
                  <div className="col-span-2">
                    <Input maxLength={LIMIT.companyName}
                      label="기업명"
                      placeholder="(주)그린에너지"
                      required
                      error={errors.companyName?.message}
                      {...register('companyName')}
                    />
                  </div>
                  <Input maxLength={LIMIT.bizNumber}
                    label="사업자등록번호"
                    placeholder="000-00-00000"
                    required
                    error={errors.businessNumber?.message}
                    {...register('businessNumber')}
                  />
                  <Input maxLength={LIMIT.personName}
                    label="대표자명"
                    placeholder="홍길동"
                    required
                    error={errors.representative?.message}
                    {...register('representative')}
                  />
                </div>
                {/* 설립일(개업연월일) 칸은 뺐다 — 첨부한 사업자등록증 원본에 적혀 있고 쓰는 곳이 없다(2026-11-24 사용자) */}
                <div className="grid grid-cols-4 items-start gap-3">
                  {/* 기업 주소 — 주소 검색으로 고르고 상세 주소를 쓴다. 기업 주소 2칸 · 기업 연락처 2칸(2026-11-24 사용자) */}
                  <div className="col-span-2">
                    <AddressInput
                      required
                      value={watch('companyAddress')}
                      onChange={(v) => setValue('companyAddress', v, { shouldValidate: true })}
                      error={errors.companyAddress?.message}
                      onSearchFail={() => setServerError('주소 검색 창을 열지 못했습니다. 인터넷 연결을 확인해 주세요.')}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input maxLength={LIMIT.phone} label="기업 연락처" placeholder="02-0000-0000" {...register('companyPhone')} />
                  </div>
                </div>
                {/* 업태·종목 — 사업자등록증 '사업의 종류'. 세금계산서에 들어간다 */}
                <div className="grid grid-cols-4 items-start gap-3">
                  <Input maxLength={LIMIT.bizType} label="업태" placeholder="제조업" required error={errors.bizType?.message} {...register('bizType')} />
                  <Input maxLength={LIMIT.bizCategory} label="종목" placeholder="금속 가공" required error={errors.bizCategory?.message} {...register('bizCategory')} />
                <div className="col-span-2">
                  <p className="text-sm font-medium text-accent mb-1.5">
                    사업자등록증<span className="ml-0.5 text-semantic-red">*</span>
                  </p>
                  <FileUpload
                    compact
                    accept=".pdf,.jpg,.jpeg,.png"
                    maxSizeMB={3}
                    onChange={(files) => {
                      const f = files[0];
                      if (!f) {
                        setLicense(null);
                        return;
                      }
                      const r = new FileReader();
                      r.onload = () => typeof r.result === 'string' && setLicense({ name: f.name, url: r.result });
                      r.readAsDataURL(f);
                    }}
                  />
                </div>
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
            <div className="grid grid-cols-2 items-start gap-3">
              <Input maxLength={LIMIT.email}
                label="아이디 (이메일)"
                required
                type="email"
                placeholder="name@company.com"
                autoComplete="off"
                error={errors.email?.message}
                {...register('email')}
              />
              {signupType !== 'consultant' && (
                <Input maxLength={LIMIT.personName} label="이름" required placeholder="홍길동" error={errors.name?.message} {...register('name')} />
              )}
            </div>
            <div className="grid grid-cols-2 items-start gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-accent">
                  비밀번호<span className="ml-0.5 text-semantic-red">*</span>
                </label>
                <PasswordInput
                  maxLength={LIMIT.password}
                  placeholder="8자 이상"
                  autoComplete="new-password"
                  error={errors.password?.message}
                  {...register('password')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-accent">
                  비밀번호 확인<span className="ml-0.5 text-semantic-red">*</span>
                </label>
                <PasswordInput
                  maxLength={LIMIT.password}
                  placeholder="비밀번호를 다시 입력하세요"
                  autoComplete="new-password"
                  error={errors.passwordConfirm?.message}
                  {...register('passwordConfirm')}
                />
              </div>
            </div>
            {signupType !== 'consultant' && (
              <div className="grid grid-cols-2 items-start gap-3">
                <Input maxLength={LIMIT.department} label="부서" placeholder="발전운영팀" {...register('department')} />
                <Input maxLength={LIMIT.phone} label="연락처" required placeholder="010-0000-0000" error={errors.phone?.message} {...register('phone')} />
              </div>
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

            {/* 약관은 둘 — 서비스 이용약관 · 개인정보 수집 · 이용 동의(둘 다 필수). 마케팅 수신 동의는 없다(광고를 보내는 기능이 없다, 2026-11-24 사용자).
                [보기]를 누르면 전문 팝업, 팝업의 [동의]를 누르면 그 줄이 체크된다 */}
            <div className="space-y-3 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              {SIGNUP_TERMS.map((t, idx) => {
                const field = t.key === 'service' ? 'termsService' : 'termsPrivacy';
                const checked = t.key === 'service' ? !!termsService : !!termsPrivacy;
                return (
                  <div key={t.key}>
                    {idx > 0 && <div className="mb-3 border-t border-white/[0.06]" />}
                    <div className="flex items-center justify-between gap-3">
                      <Checkbox
                        label={`${t.name} (필수)`}
                        checked={checked}
                        onChange={(e) => setValue(field, e.target.checked as unknown as true, { shouldValidate: true })}
                      />
                      <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setTermsOpen(t)}>
                        보기
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="text-sm font-medium text-white hover:text-sky-200 transition-colors"
              onClick={() => {
                const allChecked = !!termsService && !!termsPrivacy;
                setValue('termsService', !allChecked as unknown as true);
                setValue('termsPrivacy', !allChecked as unknown as true);
              }}
            >
              {!!termsService && !!termsPrivacy ? '전체 해제' : '전체 동의'}
            </button>

            {/* 개인정보 처리방침 — 동의받는 항목이 아니라 보는 문서. 누르면 전문 팝업([동의] 없음) */}
            <p className="text-sm text-white">
              개인정보를 처리하는 기준은{' '}
              <button type="button" className="font-semibold text-sky-300 underline underline-offset-4 hover:text-sky-200" onClick={() => setTermsOpen(PRIVACY_POLICY)}>
                개인정보 처리방침
              </button>
              에서 볼 수 있습니다.
            </p>

            <Modal
              open={!!termsOpen}
              onClose={() => setTermsOpen(null)}
              title={termsOpen?.name}
              size="lg"
              footer={
                <div className="flex justify-end gap-2">
                  <Button variant="cancel" onClick={() => setTermsOpen(null)}>
                    닫기
                  </Button>
                  {termsOpen?.key !== 'policy' && (
                    <Button
                      onClick={() => {
                        if (termsOpen) setValue(termsOpen.key === 'service' ? 'termsService' : 'termsPrivacy', true, { shouldValidate: true });
                        setTermsOpen(null);
                      }}
                    >
                      동의
                    </Button>
                  )}
                </div>
              }
            >
              <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-2">
                {termsOpen?.sections.map((sec) => (
                  <section key={sec.title}>
                    <h4 className="mb-1.5 text-sm font-semibold text-white">{sec.title}</h4>
                    <div className="space-y-1.5">
                      {sec.body.map((line) => (
                        <p key={line} className="text-sm leading-relaxed text-slate-200">
                          {line}
                        </p>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </Modal>

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
            {/* 가입은 신청이고, 확인 · 승인은 관리자가 한다 — 이메일 인증 단계는 없다. '인증 메일을 보냈다'는 예전 문구는 없는 기능을 말해서 고쳤다(2026-11-24 사용자) */}
            <p className="text-sm text-white leading-relaxed mb-6">
              가입 신청이 접수되었습니다.
              <br />
              관리자가 사업자등록증과 입력한 내용을 확인한 뒤 승인합니다.
              <br />
              승인되면 <span className="font-semibold">{getValues('email')}</span>로 로그인할 수 있습니다.
            </p>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="w-full">
                로그인으로 돌아가기
              </Button>
            </Link>
          </div>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-300">&copy; 2025 에너지 플랫폼. All rights reserved.</p>
    </div>
  );
}
