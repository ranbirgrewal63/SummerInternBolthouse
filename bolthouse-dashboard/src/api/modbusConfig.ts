import { apiGet, apiPut } from "./http";

export interface HRManyItem {
  name: string;
  address: number;
  length: number;
}

export interface ModbusMap {
  buffer_length: number;
  coils: Record<string, number>;
  discrete_inputs: Record<string, number>;
  holding_registers: Record<string, number>;
  holding_registers_many: HRManyItem[];
}

export interface ModbusMapUpdatePayload {
  coils: Record<string, number>;
  discrete_inputs: Record<string, number>;
  holding_registers: Record<string, number>;
  holding_registers_many: { name: string; address: number }[];
}

export async function getModbusMap(): Promise<ModbusMap> {
  return apiGet<ModbusMap>("/config/modbus-map");
}

export async function updateModbusMap(
  payload: ModbusMapUpdatePayload
): Promise<ModbusMap> {
  return apiPut<ModbusMap>("/config/modbus-map", payload);
}

export interface TimingConfig {
  latency_ms: number;
  distance_mm: number;
  conveyor_speed_mm_per_s: number;
  margin_ms: number;
  min_pulse_ms: number;
  merge_gap_ms: number;
}

export async function getTimingConfig(): Promise<TimingConfig> {
  return apiGet<TimingConfig>("/config/timing");
}

export async function updateTimingConfig(
  payload: TimingConfig
): Promise<TimingConfig> {
  return apiPut<TimingConfig>("/config/timing", payload);
}
