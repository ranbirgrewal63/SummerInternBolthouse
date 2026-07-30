# Client Setup

This guide is for installers or operators who want the system running quickly without risking accidental hardware output.

## First Run

1. Start the app with the normal Docker setup.
2. Open the dashboard.
3. Open `Configure Hardware`.
4. If you are not completely sure what hardware is attached, keep the system in safe mode.

Safe mode means:

- `System Mode = Direct`
- `Solenoid Backend = None / test only`

In safe mode, the software runs normally but does not fire a real solenoid.

## When To Change Hardware Settings

Only switch out of safe mode after confirming which control method the client uses:

- Raspberry Pi GPIO
- PLC / OpenPLC
- USB relay

## Recommended Choices

### Raspberry Pi

Use:

- `System Mode = Direct`
- `Solenoid Backend = GPIO`

This is best when the backend is running on the Pi and the reject mechanism is wired to a Pi GPIO pin.

### PLC / OpenPLC

Use:

- `System Mode = OpenPLC`

Then enter the correct PLC host, port, and address map.

### Testing / Demo

Use:

- `System Mode = Direct`
- `Solenoid Backend = None / test only`

This is the safest setup for first-time installation and troubleshooting.

## If Something Was Configured Wrong

1. Open `Configure Hardware`.
2. Click `Reset To Safe Mode`.
3. Click `Save Configuration`.

That puts the system back into a non-firing state without reinstalling anything.

## What To Ask The Client

1. Is the backend running on a Raspberry Pi or another computer?
2. Is the reject device controlled by GPIO, a PLC, or a USB relay?
3. If PLC: what host, port, and coil/register mapping should be used?
4. If GPIO: which pin is wired, and is it active-high or active-low?
5. If USB relay: what exact relay model and driver/library does it require?

## Best Default

If there is any doubt, stay in safe mode first and switch to the real hardware mode only after the wiring and controller type are confirmed.
