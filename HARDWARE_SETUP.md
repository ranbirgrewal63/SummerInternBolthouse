# Hardware Setup

This project now supports three solenoid-control modes:

- `simulator`: send detections over Modbus to a Python simulator
- `openplc`: send detections over Modbus to a PLC/OpenPLC target
- `direct`: fire the solenoid directly from the backend machine

The runtime configuration is stored in:

- [backend/hardware_config.json](backend/hardware_config.json)
- [backend/modbus_map.json](backend/modbus_map.json)
- [backend/timing_config.json](backend/timing_config.json)

You can also manage these settings from the dashboard hardware modal.

## Recommended Default

For now and for client handoff, keep the default safe configuration:

- `mode`: `direct`
- `solenoid_backend`: `null`
- no live hardware output until the client confirms wiring and controller type

This avoids accidental actuation during demos, testing, or video-upload inference.

## Dependencies

Base install:

- `requirements.txt`
- includes `pyModbusTCP` because both `simulator` and `openplc` modes need it

Raspberry Pi install:

- `requirements-pi.txt`
- use this only when the backend runs on a Pi and the solenoid is driven from GPIO

USB relay install:

- `requirements-usb.txt`
- fill in the exact relay library after the client confirms the hardware model

## What The Previous Team Had

The earlier simulator project supported multiple backends:

- GPIO on Raspberry Pi
- USB relay
- PLC coil output
- null/test backend

That means Raspberry Pi support was part of the design, but not the only path.

## Best Client Questions

Ask the client these before final deployment:

1. Will the backend run on a Raspberry Pi, a Windows/Linux PC, or directly on a PLC-connected machine?
2. Is the reject mechanism controlled by GPIO, USB relay, or PLC/OpenPLC?
3. If PLC: what host, port, and coil/register mapping should be used?
4. If Raspberry Pi: which GPIO pin is wired, and is the relay active-high or active-low?
5. If USB relay: what exact relay model and driver/library are required?
6. Should the system start in safe/no-fire mode until an operator explicitly enables hardware output?

## Suggested Deployment Paths

### Option 1: Raspberry Pi

Best when:

- the camera/backend machine is the Pi
- direct local GPIO control is acceptable

Use:

- `mode = "direct"`
- `solenoid_backend = "gpio"`
- install `requirements-pi.txt`

### Option 2: PLC / OpenPLC

Best when:

- the client already has industrial control hardware
- they want conveyor/reject timing integrated into PLC logic

Use:

- `mode = "openplc"`
- install `requirements.txt`

### Option 3: Python Simulator

Best when:

- testing software before real hardware arrives
- validating the timing and Modbus mapping

Use:

- `mode = "simulator"`
- install `requirements.txt`

## Safest Near-Term Plan

Until the client confirms hardware:

1. Keep the current shared dependency set with `pyModbusTCP`.
2. Leave Raspberry Pi support optional through `requirements-pi.txt`.
3. Leave USB relay support optional until the exact device is known.
4. Keep hardware configuration explicit and mode-driven through the dashboard/backend config files.

That gives you a stable default now without locking the project into the wrong hardware later.

## Resetting After A Mistake

If a client picks the wrong hardware option:

1. Open the hardware configuration modal.
2. Click `Reset To Safe Mode`.
3. Save the configuration.

Safe mode uses:

- `mode = "direct"`
- `solenoid_backend = "null"`

This leaves the app usable while preventing real hardware output until the correct settings are known.
