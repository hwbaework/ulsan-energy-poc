/** LASEE S-Energy API 원본 응답 타입 */

export interface LaseeInverter {
  datetime: string;
  number: number;
  capacity: number;
  connection_state: 0 | 1;
  dc_volt: number;
  dc_current: number;
  dc_power: number;
  ac_volt_r: number;
  ac_volt_s: number;
  ac_volt_t: number;
  ac_current_r: number;
  ac_current_s: number;
  ac_current_t: number;
  ac_power: number;
  pf: number;
  freq: number;
  daily_energy: number;
  total_energy: number;
  status_msg: string;
}

export interface LaseePlantData {
  plant_id: number;
  plant_name: string;
  plant_address: string;
  plant_capacity: number;
  rtu_power_state: 0 | 1;
  rtu_connection_state: 0 | 1;
  inverter: LaseeInverter[];
}
