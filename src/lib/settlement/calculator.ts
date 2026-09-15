export type PpaKind = 'offsite' | 'onsite' | 'lease';

export interface SettlementFees {
  surchargeRate: number;
  networkRatePerKwh: number;
  fundRate: number;
  tradeFeePerKwh: number;
  lossRate: number;
  welfareCostPerKwh: number;
}

export interface SpcFees {
  supplyFeePerKwh: number;
  manageFeePerKwh: number;
}

export interface SettlementInput {
  kind: PpaKind;
  generationKwh: number;
  unitPrice: number;
  fees: SettlementFees;
  spcFees?: SpcFees;
}

export interface SettlementResult {
  supplyAmount: number;
  surcharge: number;
  networkFee: number;
  transmissionLoss: number;
  welfareCost: number;
  fund: number;
  tradeFee: number;
  supplyFee: number;
  manageFee: number;
  vatBase: number;
  vat: number;
  totalBeforeVat: number;
  totalWithVat: number;
  consumerPayable: number;
  generatorReceivable: number;
}

export function calculateSettlement(input: SettlementInput): SettlementResult {
  const { kind, generationKwh: gen, unitPrice, fees, spcFees } = input;

  const supplyAmount = Math.round(gen * unitPrice);
  const surcharge = Math.round((supplyAmount * fees.surchargeRate) / 100);

  const isNetworkExempt = kind === 'onsite' || kind === 'lease';
  const networkFee = isNetworkExempt ? 0 : Math.round(gen * fees.networkRatePerKwh);
  const transmissionLoss = isNetworkExempt ? 0 : Math.round((supplyAmount * fees.lossRate) / 100);
  const welfareCost = Math.round(gen * fees.welfareCostPerKwh);

  const fund = Math.round(((supplyAmount + surcharge + networkFee) * fees.fundRate) / 100);
  const tradeFee = Math.round(gen * fees.tradeFeePerKwh);

  const supplyFee = spcFees ? Math.round(gen * spcFees.supplyFeePerKwh) : 0;
  const manageFee = spcFees ? Math.round(gen * spcFees.manageFeePerKwh) : 0;

  const vatBase = supplyAmount + surcharge + networkFee + transmissionLoss + welfareCost;
  const vat = Math.round(vatBase * 0.1);

  const totalBeforeVat = vatBase + fund + tradeFee;
  const totalWithVat = totalBeforeVat + vat;

  const consumerPayable = totalWithVat;
  const generatorReceivable = supplyAmount + surcharge - tradeFee - supplyFee - manageFee + vat;

  return {
    supplyAmount,
    surcharge,
    networkFee,
    transmissionLoss,
    welfareCost,
    fund,
    tradeFee,
    supplyFee,
    manageFee,
    vatBase,
    vat,
    totalBeforeVat,
    totalWithVat,
    consumerPayable,
    generatorReceivable,
  };
}
