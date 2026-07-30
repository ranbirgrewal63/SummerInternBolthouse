import copy
import json
import logging
import threading
import time
from itertools import count
from pathlib import Path
from typing import Any


LOGGER = logging.getLogger(__name__)

CONFIG_DIR = Path(__file__).resolve().parent
HARDWARE_CONFIG_PATH = CONFIG_DIR / "hardware_config.json"
MODBUS_MAP_PATH = CONFIG_DIR / "modbus_map.json"
TIMING_CONFIG_PATH = CONFIG_DIR / "timing_config.json"

DEFAULT_HARDWARE_CONFIG = {
    "mode": "direct",
    "solenoid_backend": "null",
    "gpio_pin": 17,
    "gpio_active_high": True,
    "usb_vendor_id": 5024,
    "usb_product_id": 1503,
    "usb_on_payload": [0, 1, 2, 3],
    "usb_off_payload": [0, 1, 2, 4],
    "sim_host": "0.0.0.0",
    "sim_port": 1502,
    "plc_host": "127.0.0.1",
    "plc_port": 502,
}

DEFAULT_MODBUS_MAP = {
    "buffer_length": 10,
    "coils": {
        "SOLENOID": 20,
    },
    "discrete_inputs": {
        "DETECTION": 20,
    },
    "holding_registers": {
        "OVERFLOW": 60,
        "WATCH": 50,
        "HEARTBEAT": 70,
    },
    "holding_registers_many": [
        {"name": "LENGTHx10", "address": 310, "length": 10},
        {"name": "BUFFER_FULL", "address": 40, "length": 10},
        {"name": "EVENT_SEQUENCE", "address": 320, "length": 10},
    ],
}

DEFAULT_TIMING_CONFIG = {
    "latency_ms": 150,
    "distance_mm": 100,
    "conveyor_speed_mm_per_s": 962.5,
    "margin_ms": 40,
    "min_pulse_ms": 150,
    "merge_gap_ms": 40,
}

_SEQUENCE = count(1)


def _deep_merge(defaults: dict[str, Any], loaded: dict[str, Any] | None) -> dict[str, Any]:
    merged = copy.deepcopy(defaults)
    if not isinstance(loaded, dict):
        return merged

    for key, value in loaded.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _read_json(path: Path, defaults: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        _write_json(path, defaults)
        return copy.deepcopy(defaults)

    try:
        return _deep_merge(defaults, json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        LOGGER.exception("Failed reading %s, restoring defaults", path)
        _write_json(path, defaults)
        return copy.deepcopy(defaults)


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def load_hardware_config() -> dict[str, Any]:
    return _read_json(HARDWARE_CONFIG_PATH, DEFAULT_HARDWARE_CONFIG)


def save_hardware_config(payload: dict[str, Any]) -> dict[str, Any]:
    config = _deep_merge(DEFAULT_HARDWARE_CONFIG, payload)
    _write_json(HARDWARE_CONFIG_PATH, config)
    return config


def load_modbus_map() -> dict[str, Any]:
    return _read_json(MODBUS_MAP_PATH, DEFAULT_MODBUS_MAP)


def save_modbus_map(payload: dict[str, Any]) -> dict[str, Any]:
    merged = _deep_merge(DEFAULT_MODBUS_MAP, payload)
    merged["buffer_length"] = int(merged.get("buffer_length") or DEFAULT_MODBUS_MAP["buffer_length"])
    for block in merged.get("holding_registers_many", []):
        block["length"] = int(block.get("length") or merged["buffer_length"])
    _write_json(MODBUS_MAP_PATH, merged)
    return merged


def load_timing_config() -> dict[str, Any]:
    return _read_json(TIMING_CONFIG_PATH, DEFAULT_TIMING_CONFIG)


def save_timing_config(payload: dict[str, Any]) -> dict[str, Any]:
    config = _deep_merge(DEFAULT_TIMING_CONFIG, payload)
    _write_json(TIMING_CONFIG_PATH, config)
    return config


class SolenoidBackend:
    def set_state(self, on: bool) -> None:
        raise NotImplementedError


class NullSolenoidBackend(SolenoidBackend):
    def __init__(self) -> None:
        self.last_state = False

    def set_state(self, on: bool) -> None:
        self.last_state = bool(on)


class GPIOSolenoidBackend(SolenoidBackend):
    def __init__(self, pin: int, active_high: bool = True) -> None:
        self.pin = int(pin)
        self.active_high = bool(active_high)
        self._gpio = None
        self._configured = False

    def _ensure_gpio(self) -> None:
        if self._configured:
            return
        try:
            import RPi.GPIO as GPIO
        except Exception as exc:
            raise RuntimeError("RPi.GPIO is unavailable on this machine.") from exc

        GPIO.setmode(GPIO.BCM)
        GPIO.setup(self.pin, GPIO.OUT)
        self._gpio = GPIO
        self._configured = True

    def set_state(self, on: bool) -> None:
        self._ensure_gpio()
        level = self._gpio.HIGH if (bool(on) == self.active_high) else self._gpio.LOW
        self._gpio.output(self.pin, level)


class USBSolenoidBackend(SolenoidBackend):
    def __init__(
        self,
        vendor_id: int,
        product_id: int,
        on_payload: bytes,
        off_payload: bytes,
    ) -> None:
        self.vendor_id = int(vendor_id)
        self.product_id = int(product_id)
        self.on_payload = bytes(on_payload)
        self.off_payload = bytes(off_payload)
        self._dev = None

    def _ensure_device(self) -> None:
        if self._dev is not None:
            return

        try:
            import hid
        except Exception as exc:
            raise RuntimeError("hid/hidapi is unavailable on this machine.") from exc

        device = hid.device()
        device.open(self.vendor_id, self.product_id)
        self._dev = device

    def set_state(self, on: bool) -> None:
        self._ensure_device()
        payload = self.on_payload if on else self.off_payload
        self._dev.write(payload)


def _make_solenoid_backend(config: dict[str, Any]) -> SolenoidBackend:
    backend_name = str(config.get("solenoid_backend", "null")).lower()
    if backend_name == "gpio":
        return GPIOSolenoidBackend(
            pin=int(config.get("gpio_pin", DEFAULT_HARDWARE_CONFIG["gpio_pin"])),
            active_high=bool(config.get("gpio_active_high", True)),
        )
    if backend_name == "usb":
        return USBSolenoidBackend(
            vendor_id=int(config.get("usb_vendor_id", DEFAULT_HARDWARE_CONFIG["usb_vendor_id"])),
            product_id=int(config.get("usb_product_id", DEFAULT_HARDWARE_CONFIG["usb_product_id"])),
            on_payload=bytes(config.get("usb_on_payload", DEFAULT_HARDWARE_CONFIG["usb_on_payload"])),
            off_payload=bytes(config.get("usb_off_payload", DEFAULT_HARDWARE_CONFIG["usb_off_payload"])),
        )
    return NullSolenoidBackend()


class SolenoidTimingController:
    def __init__(self, timing: dict[str, Any]) -> None:
        self.update_config(timing)
        self._fire_at_s = 0.0
        self._active_until = 0.0

    def update_config(self, timing: dict[str, Any]) -> None:
        self.latency_ms = float(timing.get("latency_ms", DEFAULT_TIMING_CONFIG["latency_ms"]))
        self.distance_mm = float(timing.get("distance_mm", DEFAULT_TIMING_CONFIG["distance_mm"]))
        self.conveyor_speed_mm_per_s = float(
            timing.get(
                "conveyor_speed_mm_per_s",
                DEFAULT_TIMING_CONFIG["conveyor_speed_mm_per_s"],
            )
        )
        self.margin_ms = float(timing.get("margin_ms", DEFAULT_TIMING_CONFIG["margin_ms"]))
        self.min_pulse_ms = float(timing.get("min_pulse_ms", DEFAULT_TIMING_CONFIG["min_pulse_ms"]))
        self.merge_gap_ms = float(timing.get("merge_gap_ms", DEFAULT_TIMING_CONFIG["merge_gap_ms"]))

    def _pulse_ms(self, length_mm: float | None) -> float:
        if length_mm is None or length_mm <= 0 or self.conveyor_speed_mm_per_s <= 0:
            return max(self.min_pulse_ms, self.margin_ms)
        pulse_ms = 1000.0 * float(length_mm) / self.conveyor_speed_mm_per_s + self.margin_ms
        return max(self.min_pulse_ms, pulse_ms)

    def _fire_time(self, now_s: float) -> float:
        if self.conveyor_speed_mm_per_s <= 0:
            travel_s = 0.0
        else:
            travel_s = self.distance_mm / self.conveyor_speed_mm_per_s
        return max(now_s, now_s + travel_s - (self.latency_ms / 1000.0))

    def schedule(self, now_s: float, length_mm: float | None) -> None:
        pulse_s = self._pulse_ms(length_mm) / 1000.0
        new_fire = self._fire_time(now_s)
        new_stop = new_fire + pulse_s

        if now_s < self._active_until or new_fire <= (self._active_until + self.merge_gap_ms / 1000.0):
            if new_stop > self._active_until:
                self._active_until = new_stop
            if new_fire < self._fire_at_s or self._fire_at_s <= now_s:
                self._fire_at_s = min(self._fire_at_s, new_fire) if self._fire_at_s else new_fire
        else:
            self._fire_at_s = new_fire
            self._active_until = new_stop

    def desired_state(self, now_s: float) -> bool:
        return self._fire_at_s <= now_s < self._active_until


class DirectSolenoidScheduler:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._controller = SolenoidTimingController(DEFAULT_TIMING_CONFIG)
        self._backend: SolenoidBackend = NullSolenoidBackend()
        self._last_output_state = False
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

    def reconfigure(self, hardware_config: dict[str, Any], timing_config: dict[str, Any]) -> None:
        with self._lock:
            self._controller.update_config(timing_config)
            self._backend = _make_solenoid_backend(hardware_config)

    def schedule(self, length_mm: float | None) -> None:
        with self._lock:
            self._controller.schedule(time.monotonic(), length_mm)

    def _run_loop(self) -> None:
        while True:
            backend = None
            desired_state = False
            with self._lock:
                backend = self._backend
                desired_state = self._controller.desired_state(time.monotonic())

            if desired_state != self._last_output_state:
                try:
                    backend.set_state(desired_state)
                    self._last_output_state = desired_state
                except Exception:
                    LOGGER.exception("Failed to toggle direct solenoid output")
                    self._last_output_state = desired_state

            time.sleep(0.01)


_DIRECT_SCHEDULER = DirectSolenoidScheduler()


def _lookup_block_address(modbus_map: dict[str, Any], block_name: str) -> int:
    for block in modbus_map.get("holding_registers_many", []):
        if block.get("name") == block_name:
            return int(block["address"])
    raise KeyError(f"Unknown holding register block: {block_name}")


def _send_detection_via_modbus(
    hardware_config: dict[str, Any],
    modbus_map: dict[str, Any],
    mode: str,
    length_mm: float | None,
    sequence: int,
) -> bool:
    try:
        from pyModbusTCP.client import ModbusClient
    except Exception as exc:
        raise RuntimeError("pyModbusTCP is not installed.") from exc

    if mode == "openplc":
        host = hardware_config["plc_host"]
        port = int(hardware_config["plc_port"])
    else:
        host = hardware_config["sim_host"]
        port = int(hardware_config["sim_port"])

    buffer_length = int(modbus_map.get("buffer_length", DEFAULT_MODBUS_MAP["buffer_length"]))
    hr_length = _lookup_block_address(modbus_map, "LENGTHx10")
    hr_sequence = _lookup_block_address(modbus_map, "EVENT_SEQUENCE")
    hr_buffer_full = _lookup_block_address(modbus_map, "BUFFER_FULL")
    hr_overflow = int(modbus_map["holding_registers"]["OVERFLOW"])
    hr_watch = int(modbus_map["holding_registers"]["WATCH"])

    client = ModbusClient(host=host, port=port, auto_open=True, auto_close=False)
    try:
        length_value = 0 if length_mm is None else int(round(max(float(length_mm), 0.0) * 10.0))
        for index in range(buffer_length):
            valid = client.read_holding_registers(hr_buffer_full + index, 1)
            if not valid:
                continue
            if int(valid[0]) != 0:
                continue

            client.write_single_register(hr_length + index, length_value)
            client.write_single_register(hr_sequence + index, int(sequence))
            client.write_single_register(hr_buffer_full + index, 1)
            client.write_single_register(hr_watch, 1)
            return True

        client.write_single_register(hr_overflow, 1)
        return False
    finally:
        client.close()


def _extract_length_mm(detection: dict[str, Any]) -> float | None:
    length = detection.get("length")
    if isinstance(length, (int, float)) and length > 0:
        return float(length)
    return None


def trigger_solenoid_for_event(event: dict[str, Any]) -> bool:
    detections = event.get("detections", [])
    foreign_detections = [
        det for det in detections
        if str(det.get("label", "")).lower() != "carrot"
    ]
    if not foreign_detections:
        return False

    hardware_config = load_hardware_config()
    timing_config = load_timing_config()
    modbus_map = load_modbus_map()
    mode = str(hardware_config.get("mode", "simulator")).lower()

    detection = foreign_detections[0]
    length_mm = _extract_length_mm(detection)
    sequence = next(_SEQUENCE)

    if mode == "direct":
        _DIRECT_SCHEDULER.reconfigure(hardware_config, timing_config)
        _DIRECT_SCHEDULER.schedule(length_mm)
        return True

    if mode in {"simulator", "openplc"}:
        return _send_detection_via_modbus(hardware_config, modbus_map, mode, length_mm, sequence)

    LOGGER.warning("Unknown hardware mode '%s'; skipping solenoid trigger", mode)
    return False
