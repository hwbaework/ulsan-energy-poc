import type { SettlementFees, SpcFees } from './calculator';

export const DEFAULT_FEES: SettlementFees = {
  surchargeRate: 5,
  networkRatePerKwh: 27.3,
  fundRate: 3.7,
  tradeFeePerKwh: 0.1034,
  lossRate: 3.49,
  welfareCostPerKwh: 1.2,
};

export const DEFAULT_SPC_FEES: SpcFees = {
  supplyFeePerKwh: 0.0235,
  manageFeePerKwh: 0.05,
};
