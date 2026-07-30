"""
Nest Camera WebRTC Test Script
--------------------------------
Connects to a Nest camera (set up via Google Home) using WebRTC through
Google's Device Access (SDM) API, and displays the live video feed.

PREREQUISITES:
1. Camera set up fresh through the Google Home app (not classic Nest app)
2. Device Access project registered, OAuth Client ID/Secret obtained
3. One-time OAuth authorization completed -> you have a REFRESH_TOKEN
4. Your camera's DEVICE_ID (get this via a GET request to the devices
   list endpoint once authenticated)

Install requirements first:
    pip install aiortc aiohttp opencv-python requests av
"""

import asyncio
import requests
import cv2
from aiortc import RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaBlackhole

# ---- FILL THESE IN ----
PROJECT_ID = "YOUR_DEVICE_ACCESS_PROJECT_ID"
CLIENT_ID = "YOUR_OAUTH_CLIENT_ID"
CLIENT_SECRET = "YOUR_OAUTH_CLIENT_SECRET"
REFRESH_TOKEN = "YOUR_REFRESH_TOKEN"
DEVICE_ID = "YOUR_NEST_CAMERA_DEVICE_ID"
# ------------------------

TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token"
SDM_BASE = f"https://smartdevicemanagement.googleapis.com/v1/enterprises/{PROJECT_ID}/devices/{DEVICE_ID}"


def get_access_token():
    resp = requests.post(TOKEN_URL, data={
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "refresh_token": REFRESH_TOKEN,
        "grant_type": "refresh_token",
    })
    resp.raise_for_status()
    return resp.json()["access_token"]


async def run():
    access_token = get_access_token()

    pc = RTCPeerConnection()

    # We only want to receive video, not send anything
    pc.addTransceiver("video", direction="recvonly")
    pc.addTransceiver("audio", direction="recvonly")

    frame_holder = {"frame": None}

    @pc.on("track")
    def on_track(track):
        print(f"Track received: {track.kind}")
        if track.kind == "video":
            asyncio.ensure_future(display_video(track, frame_holder))

    # Create the SDP offer
    offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    # Send the offer to Google's SDM API, get back an answer
    resp = requests.post(
        f"{SDM_BASE}:executeCommand",
        headers={"Authorization": f"Bearer {access_token}"},
        json={
            "command": "sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream",
            "params": {"offerSdp": pc.localDescription.sdp},
        },
    )
    resp.raise_for_status()
    results = resp.json()["results"]
    answer_sdp = results["answerSdp"]
    media_session_id = results["mediaSessionId"]
    print(f"WebRTC session started: {media_session_id}")

    # Apply the answer to complete the connection
    answer = RTCSessionDescription(sdp=answer_sdp, type="answer")
    await pc.setRemoteDescription(answer)

    print("Connected. Press Ctrl+C to stop.")
    try:
        while True:
            await asyncio.sleep(1)
            if frame_holder["frame"] is not None:
                cv2.imshow("Nest Camera (WebRTC)", frame_holder["frame"])
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
    except KeyboardInterrupt:
        pass
    finally:
        await pc.close()
        cv2.destroyAllWindows()


async def display_video(track, frame_holder):
    """Pull frames off the incoming video track and store the latest one
    for the main loop to display via OpenCV."""
    while True:
        try:
            frame = await track.recv()
            img = frame.to_ndarray(format="bgr24")
            frame_holder["frame"] = img
        except Exception as e:
            print(f"Video track ended: {e}")
            break


if __name__ == "__main__":
    asyncio.run(run())