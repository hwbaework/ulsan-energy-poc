export interface OnboardingStep {
  id: number;
  stepCode: string;
  stepName: string;
  required: boolean;
  status: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface Onboarding {
  id: number;
  companyId: number;
  businessType: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  steps: OnboardingStep[];
}
