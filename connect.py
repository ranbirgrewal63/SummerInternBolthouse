import asyncio
from open_gopro import WirelessGoPro

async def main():
    async with WirelessGoPro() as gopro:
        print("Connected to GoPro")
        print("Waiting for WiFi connection to establish -- watch for a Windows network prompt now.")
        await asyncio.sleep(30)  # keeps the connection alive so WiFi handoff can complete
        print("Done waiting.")

asyncio.run(main())
