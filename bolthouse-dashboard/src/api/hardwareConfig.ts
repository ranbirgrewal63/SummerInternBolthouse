import { apiGet, apiPut } from "./http";

export type HardwareMode = "simulator" | "openplc" | "direct";
export type SolenoidBackendType = "null" | "gpio" | "usb";

export interface HardwareConfig {
  mode: HardwareMode;
  solenoid_backend: SolenoidBackendType;
  gpio_pin: number;
  gpio_active_high: boolean;
  usb_vendor_id: number;
  usb_product_id: number;
  usb_on_payload: number[];
  usb_off_payload: number[];
  sim_host: string;
  sim_port: number;
  plc_host: string;
  plc_port: number;
}

export async function getHardwareConfig(): Promise<HardwareConfig> {
  return apiGet<HardwareConfig>("/config/hardware");
}

export async function updateHardwareConfig(
  payload: HardwareConfig,
): Promise<HardwareConfig> {
  return apiPut<HardwareConfig>("/config/hardware", payload);
}
