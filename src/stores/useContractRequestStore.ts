import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChangeItemType = 'price' | 'capacity' | 'period';
export type RequestType = 'change' | 'terminate';
export type RequestStatus = 'pending' | 'accepted' | 'rejected';
export type ContractKind = 'offsite' | 'onsite' | 'lease';

export interface ContractChangeRequest {
  id: string;
  type: RequestType;
  contractNumber: string;
  plantName: string;
  plantId: string;
  generatorName: string;
  contractKind: ContractKind;
  createdAt: string;
  status: RequestStatus;
  spcReviewNote?: string;
  // 변경 신청 전용
  changeItem?: ChangeItemType;
  changeLabel?: string;
  currentValue?: string;
  targetValue?: string;
  reason?: string;
  // 해지 신청 전용
  terminateReason?: string;
  capacityKw?: number;
  estimatedPenalty?: number;
}

interface ContractRequestState {
  requests: ContractChangeRequest[];
  addRequest: (req: Omit<ContractChangeRequest, 'id' | 'createdAt' | 'status'>) => void;
  updateStatus: (id: string, status: RequestStatus, note?: string) => void;
}

let counter = 0;

export const useContractRequestStore = create<ContractRequestState>()(
  persist(
    (set) => ({
      requests: [],
      addRequest: (req) => {
        const id = `cr-${Date.now()}-${++counter}`;
        const createdAt = new Date().toISOString().slice(0, 10);
        set((s) => ({
          requests: [{ ...req, id, createdAt, status: 'pending' as RequestStatus }, ...s.requests],
        }));
      },
      updateStatus: (id, status, note) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, status, spcReviewNote: note ?? r.spcReviewNote } : r,
          ),
        })),
    }),
    { name: 'contract-requests' },
  ),
);
