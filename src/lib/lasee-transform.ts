import type { LaseePlantData, LaseeInverter } from '@/types/lasee';
import type { InverterStatus, PlantConnectionStatus, PlantStatus } from '@/types/monitoring';

export function transformConnectionStatus(raw: LaseePlantData): PlantConnectionStatus {
  return {
    rtuPower: raw.rtu_power_state === 0 ? 'ON' : 'OFF',
    rtuConnection: raw.rtu_connection_state === 0 ? 'NORMAL' : 'ERROR',
    inverterConnections: raw.inverter.map((inv) => ({
      number: inv.number,
      state: inv.connection_state === 0 ? 'NORMAL' : 'ERROR',
    })),
  };
}

export function transformInverter(raw: LaseeInverter): InverterStatus {
  return {
    number: raw.number,
    capacity: raw.capacity,
    connectionState: raw.connection_state === 0 ? 'NORMAL' : 'ERROR',
    lastDataAt: raw.datetime,
    dc: { voltage: raw.dc_volt, current: raw.dc_current, power: raw.dc_power },
    ac: {
      voltR: raw.ac_volt_r,
      voltS: raw.ac_volt_s,
      voltT: raw.ac_volt_t,
      currentR: raw.ac_current_r,
      currentS: raw.ac_current_s,
      currentT: raw.ac_current_t,
      power: raw.ac_power,
    },
    powerFactor: raw.pf,
    frequency: raw.freq,
    dailyEnergy: raw.daily_energy,
    totalEnergy: raw.total_energy,
    statusMessages: raw.status_msg
      ? raw.status_msg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  };
}

export function deriveAutoStatus(raw: LaseePlantData): PlantStatus {
  if (raw.rtu_power_state === 1) return 'OFFLINE';
  if (raw.rtu_connection_state === 1) return 'WARNING';
  const allDisconnected = raw.inverter.every((inv) => inv.connection_state === 1);
  if (allDisconnected && raw.inverter.length > 0) return 'ANOMALY';
  const hasError = raw.inverter.some(
    (inv) => inv.status_msg && !['', 'Normal', 'Run'].includes(inv.status_msg.trim()),
  );
  if (hasError) return 'WARNING';
  return 'NORMAL';
}

export function formatLaseeDateTime(raw: string): string {
  if (!raw || raw.length < 15) return raw;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const time = raw.slice(9);
  return `${y}-${m}-${d} ${time}`;
}
