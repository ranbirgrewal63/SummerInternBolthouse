"""
sound_router.py  —  NEW FILE, do not modify existing files with this
Place at: backend/sound_router.py

Exposes:  GET /sound/latest-foreign-object
The frontend polls this to know when to play the alert sound.
"""

import json
import sqlite3
from fastapi import APIRouter
from backend.settings import DB_PATH

_con = sqlite3.connect(DB_PATH, check_same_thread=False)
_con.row_factory = sqlite3.Row

sound_router = APIRouter(prefix="/sound", tags=["sound"])

# Only "carrot" is safe — everything else is a foreign object
SAFE_LABELS = {"carrot"}


@sound_router.get("/latest-foreign-object")
async def latest_foreign_object():
    """
    Scans events newest-first and returns the first detection
    whose label is NOT a carrot.

    Returns:
        { "found": true,  "eventId": "...", "timestamp": "...",
          "label": "aluminum", "confidence": 0.78 }
        { "found": false }
    """
    rows = _con.execute(
        "SELECT eventId, timestamp, payload FROM events ORDER BY timestamp DESC"
    ).fetchall()

    for row in rows:
        try:
            payload = json.loads(row["payload"])
        except Exception:
            continue

        for det in payload.get("detections", []):
            label = det.get("label", "")
            if label.lower() not in SAFE_LABELS:
                return {
                    "found":      True,
                    "eventId":    row["eventId"],
                    "timestamp":  row["timestamp"],
                    "label":      label,
                    "confidence": det.get("confidence"),
                }

    return {"found": False}
