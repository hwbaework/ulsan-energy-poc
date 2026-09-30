import type { MonitoringPlant, PlantContractKind } from '@/types/monitoring';
import { CONTRACT_KIND, contractSplitOf } from './design';

/**
 * 계약 하나를 발전소 하나처럼 다루는 항목.
 * 혼합 계약 발전소(한일튜브)는 "한일튜브(자가소비)" · "한일튜브(onsite)" 두 개로 갈라지고,
 * 용량·출력·발전량은 계약 용량 비율(share)로 나눈다. 계약이 하나뿐인 발전소는 이름 그대로.
 * 목록·관제 홈·대시보드·보고서·이상감지가 전부 이 단위로 본다.
 */
export type ContractPlant<T extends MonitoringPlant = MonitoringPlant> = T & {
  /** `${plantId}-${kind}` — 화면 키 */
  key: string;
  contractKind?: PlantContractKind;
  /** 설비 전체 대비 이 계약의 몫 (0~1) */
  share: number;
  baseName: string;
  displayName: string;
};

export function contractDisplayName(name: string, kind: PlantContractKind | undefined, mixed: boolean): string {
  return kind && mixed ? `${name}(${CONTRACT_KIND[kind].label})` : name;
}

export function expandByContract<T extends MonitoringPlant>(plants: T[]): ContractPlant<T>[] {
  return plants.flatMap((p): ContractPlant<T>[] => {
    const split = contractSplitOf(p);
    if (split.length === 0) return [{ ...p, key: String(p.plantId), share: 1, baseName: p.name, displayName: p.name }];
    const total = split.reduce((s, c) => s + c.capacityKw, 0) || 1;
    const mixed = split.length > 1;
    return split.map((c) => {
      const share = c.capacityKw / total;
      const scale = (v: number | undefined) => (v == null ? v : Math.round(v * share));
      return {
        ...p,
        key: `${p.plantId}-${c.kind}`,
        contractKind: c.kind,
        share,
        baseName: p.name,
        displayName: contractDisplayName(p.name, c.kind, mixed),
        capacity: c.capacityKw,
        currentOutput: Math.round(p.currentOutput * share),
        dailyEnergy: scale(p.dailyEnergy),
        totalEnergy: scale(p.totalEnergy),
        monthlyEnergy: scale(p.monthlyEnergy),
        dailyCo2Reduction: p.dailyCo2Reduction == null ? p.dailyCo2Reduction : Math.round(p.dailyCo2Reduction * share * 1000) / 1000,
      };
    });
  });
}

/** 발전소 ID + 계약으로 항목 하나 찾기 — 계약이 없거나 안 맞으면 발전소 첫 항목 */
export function findContractPlant<T extends MonitoringPlant>(
  plants: T[],
  plantId: number,
  kind?: PlantContractKind | null,
): ContractPlant<T> | undefined {
  const items = expandByContract(plants).filter((c) => c.plantId === plantId);
  return items.find((c) => c.contractKind === kind) ?? items[0];
}

/** 계약 링크 — 계약이 있으면 ?contract= 을 붙인다 */
export function contractHref(base: string, kind?: PlantContractKind): string {
  return kind ? `${base}?contract=${kind}` : base;
}
