export interface ConsultingAgency {
  id: number;
  companyId: number;
  companyName: string;
  representative: string;
  phone?: string;
  specializations?: string;
  rating: number;
  reviewCount: number;
  consultantCount: number;
  completedProjects: number;
  activeProjects: number;
  status: string;
  contractedAt?: string;
}
