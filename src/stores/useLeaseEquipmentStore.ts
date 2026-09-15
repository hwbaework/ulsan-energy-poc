import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface LeaseEquipment {
  id: string;
  kind: string;
  model: string;
  note: string;
  sharePct: number;
  negotiable: boolean;
  includesInstallation: boolean;
  includesVat: boolean;
  installPeriod: string;
  photos: string[];
  photoCount: number;
  registeredAt: string;
}

interface LeaseEquipmentState {
  equipments: LeaseEquipment[];
  addEquipment: (eq: LeaseEquipment) => void;
  removeEquipment: (id: string) => void;
}

export const useLeaseEquipmentStore = create<LeaseEquipmentState>()(
  persist(
    (set) => ({
      equipments: [],
      addEquipment: (eq) => set((s) => ({ equipments: [eq, ...s.equipments] })),
      removeEquipment: (id) =>
        set((s) => ({ equipments: s.equipments.filter((e) => e.id !== id) })),
    }),
    { name: 'lease-equipments' },
  ),
);
