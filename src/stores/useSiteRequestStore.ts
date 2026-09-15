import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SiteRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SiteRequest {
  id: string;
  companyId: number;
  companyName: string;
  siteName: string;
  siteType: string;
  address: string;
  contractPowerKw: number;
  memo: string;
  status: SiteRequestStatus;
  createdAt: string;
  spcReviewNote?: string;
}

interface SiteRequestState {
  requests: SiteRequest[];
  addRequest: (req: Omit<SiteRequest, 'id' | 'createdAt' | 'status'>) => void;
  updateStatus: (id: string, status: SiteRequestStatus, note?: string) => void;
}

let counter = 0;

export const useSiteRequestStore = create<SiteRequestState>()(
  persist(
    (set) => ({
      requests: [],
      addRequest: (req) => {
        const id = `sr-${Date.now()}-${++counter}`;
        const createdAt = new Date().toISOString().slice(0, 10);
        set((s) => ({
          requests: [
            { ...req, id, createdAt, status: 'approved' as SiteRequestStatus },
            ...s.requests,
          ],
        }));
      },
      updateStatus: (id, status, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, status, spcReviewNote: note ?? r.spcReviewNote } : r,
          ),
        })),
    }),
    { name: 'site-requests' },
  ),
);
