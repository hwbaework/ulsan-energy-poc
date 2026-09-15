export interface SpcAsset {
  id: number;
  companyId: number;
  assetType: string;
  name: string;
  status: string;
  scaleValue: number;
  scaleUnit: string;
  startDate?: string;
  endDate?: string;
  monthlyRevenue?: number;
  refContractId?: number;
  refPlantId?: number;
}
