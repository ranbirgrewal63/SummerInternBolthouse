from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.hardware_control import (
    load_hardware_config,
    load_modbus_map,
    load_timing_config,
    save_hardware_config,
    save_modbus_map,
    save_timing_config,
    trigger_solenoid_for_event,
)


hardware_router = APIRouter(prefix="/config", tags=["hardware"])


class HardwareConfigPayload(BaseModel):
    mode: str = "simulator"
    solenoid_backend: str = "null"
    gpio_pin: int = 17
    gpio_active_high: bool = True
    usb_vendor_id: int = 5024
    usb_product_id: int = 1503
    usb_on_payload: list[int] = Field(default_factory=lambda: [0, 1, 2, 3])
    usb_off_payload: list[int] = Field(default_factory=lambda: [0, 1, 2, 4])
    sim_host: str = "0.0.0.0"
    sim_port: int = 1502
    plc_host: str = "127.0.0.1"
    plc_port: int = 502


class HRManyUpdateItem(BaseModel):
    name: str
    address: int


class ModbusMapPayload(BaseModel):
    coils: dict[str, int]
    discrete_inputs: dict[str, int]
    holding_registers: dict[str, int]
    holding_registers_many: list[HRManyUpdateItem]


class TimingConfigPayload(BaseModel):
    latency_ms: float
    distance_mm: float
    conveyor_speed_mm_per_s: float
    margin_ms: float
    min_pulse_ms: float
    merge_gap_ms: float


@hardware_router.get("/hardware")
async def get_hardware_config():
    return load_hardware_config()


@hardware_router.put("/hardware")
async def put_hardware_config(payload: HardwareConfigPayload):
    return save_hardware_config(payload.model_dump())


@hardware_router.get("/modbus-map")
async def get_modbus_map():
    return load_modbus_map()


@hardware_router.put("/modbus-map")
async def put_modbus_map(payload: ModbusMapPayload):
    current = load_modbus_map()
    buffer_length = int(current.get("buffer_length", 10))
    blocks = []
    for block in payload.holding_registers_many:
        blocks.append({
            "name": block.name,
            "address": block.address,
            "length": buffer_length,
        })

    return save_modbus_map({
        "coils": payload.coils,
        "discrete_inputs": payload.discrete_inputs,
        "holding_registers": payload.holding_registers,
        "holding_registers_many": blocks,
    })


@hardware_router.get("/timing")
async def get_timing_config():
    return load_timing_config()


@hardware_router.put("/timing")
async def put_timing_config(payload: TimingConfigPayload):
    return save_timing_config(payload.model_dump())


@hardware_router.post("/solenoid/test-fire")
async def test_fire_solenoid(length_mm: float | None = None):
    try:
        fired = trigger_solenoid_for_event({
            "detections": [
                {"label": "foreign_material", "length": length_mm}
            ]
        })
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"queued": fired}
