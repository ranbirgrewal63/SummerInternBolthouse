from fastapi.responses import FileResponse
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
#from model.inferenceScripts import pipeline (import was moved to run-inference)
import os
import shutil
import sqlite3
import json
from fastapi.responses import FileResponse, StreamingResponse
from backend.settings import DB_PATH, PROJECT_ROOT, SNAPSHOT_DIR, UPLOAD_DIR, ensure_runtime_dirs, resolve_snapshot_path
from backend.hardware_control import trigger_solenoid_for_event
from backend.hardware_router import hardware_router
import threading
#UPLOAD_DIR = "uploaded_images"
#os.makedirs(UPLOAD_DIR, exist_ok=True)

ensure_runtime_dirs()

print("Using database:", DB_PATH)
#absolute db path^
_db_lock = threading.Lock()
con = sqlite3.connect(DB_PATH, check_same_thread=False)
con.row_factory = sqlite3.Row
def get_cursor():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn, conn.cursor()
c = con.cursor()
c.execute(
    """
    CREATE TABLE IF NOT EXISTS events (
        eventId TEXT PRIMARY KEY,
        timestamp TEXT,
        cameraID TEXT,
        snapshot TEXT,
        model TEXT,
        payload TEXT
    )
    """
)
c.execute(
    """
    CREATE TABLE IF NOT EXISTS system_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """
)
con.commit()
app = FastAPI()
app.include_router(hardware_router)
camera_enabled = True

@app.post("/camera/start")
async def start_camera():
    global camera_enabled
    camera_enabled = True
    return {"status": "Camera started."}
@app.post("/camera/stop")
async def stop_camera():
    global camera_enabled
    camera_enabled = False
    return {"status": "Camera stopped."}
@app.get("/camera/status")
async def camera_status():
    return {"enabled": camera_enabled}
def get_system_enabled() -> bool:
    conn, cur = get_cursor()
    row = cur.execute(
        "SELECT value FROM system_state WHERE key = ?",
        ("power_enabled",),
    ).fetchone()
    if row is None:
        cur.execute(
            "INSERT INTO system_state (key, value) VALUES (?, ?)",
            ("power_enabled", "true"),
        )
        conn.commit()
        conn.close()
        return True
    conn.close()
    return str(row["value"]).lower() == "true"

def set_system_enabled(enabled: bool) -> bool:
    c.execute(
        """
        INSERT INTO system_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
        """,
        ("power_enabled", "true" if enabled else "false"),
    )
    con.commit()
    return enabled


@app.get("/")
async def root():
    return {"message": "Hello World"}

# DOUBLE CHECK
@app.get("/health")
async def health():
    try:
        # quick DB sanity check
        c.execute("SELECT 1")
        return {"status":"ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"db_error: {e}")


@app.get("/power/state")
async def power_state():
    return {"enabled": get_system_enabled()}


@app.post("/power/set/{enabled}")
async def set_power_state(enabled: bool):
    return {"enabled": set_system_enabled(enabled)}

@app.post("/events")
async def store_event(event: dict):
    insQuery = """
    INSERT INTO events (eventId, timestamp, cameraID, snapshot, model, payload)
    VALUES (?,?,?,?,?,?)
    """
    data = (
        event["eventId"],
        event["timestamp"],
        event["cameraId"],
        event["snapshot"],
        event["model"],
        json.dumps(event),
    )

    try:
        c.execute(insQuery, data)
        con.commit()
        return {"message": "Successful insert.", "eventId": event["eventId"]}
    except Exception as e:
        return {"error": str(e)}
@app.get("/events")
#retriveing all events from database
async def list_events(startNum = None, amount = None, cameraId = None, startDate = None, endDat = None): 
    rows = c.execute("SELECT * FROM events").fetchall()
    result = []
    for row in rows:
        try:
            payload_obj = json.loads(row["payload"])
        except:
            payload_obj = row["payload"]
        
        result.append({
            "eventId": row["eventId"], 
            "timestamp": row["timestamp"],
            "payload": payload_obj
        })
    return result
        

def _get_event_row(eventId: str):
    row = c.execute("SELECT * FROM events WHERE eventId = ?", (eventId,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return row


def _decode_payload(row):
    payload = row["payload"]
    try:
        return json.loads(payload) if payload else {}
    except Exception:
        return {}


def _delete_snapshot_if_unused(snapshot_path: str | None):
    if not snapshot_path:
        return

    other_ref = c.execute(
        "SELECT 1 FROM events WHERE snapshot = ? LIMIT 1",
        (snapshot_path,),
    ).fetchone()
    if other_ref is not None:
        return

    resolved_path = resolve_snapshot_path(snapshot_path)
    if resolved_path and os.path.exists(resolved_path):
        try:
            os.remove(resolved_path)
        except OSError:
            pass


def _remove_debris_detection(eventId: str, debris_type: str | None):
    row = _get_event_row(eventId)
    payload = _decode_payload(row)
    snapshot_path = row["snapshot"]
    detections = payload.get("detections", [])

    if not isinstance(detections, list):
        detections = []

    kept_detections = []
    removed = False

    for det in detections:
        label = det.get("label")
        matches_selected = debris_type is None or label == debris_type

        if not removed and label != "carrot" and matches_selected:
            removed = True
            continue

        kept_detections.append(det)

    payload["detections"] = kept_detections

    # Older rows may also be tagged as a top-level debris event.
    top_level_is_selected = debris_type is None or payload.get("debris_type") == debris_type
    if payload.get("type") == "debris" and top_level_is_selected:
        payload.pop("type", None)
        payload.pop("debris_type", None)
        removed = True

    if not removed:
        raise HTTPException(status_code=404, detail="Debris detection not found")

    has_remaining_debris = any(det.get("label") != "carrot" for det in kept_detections)

    if kept_detections:
        if not has_remaining_debris:
            payload["snapshot"] = ""
        c.execute(
            "UPDATE events SET snapshot = ?, payload = ? WHERE eventId = ?",
            (
                snapshot_path if has_remaining_debris else "",
                json.dumps(payload),
                eventId,
            ),
        )
    else:
        c.execute("DELETE FROM events WHERE eventId = ?", (eventId,))

    con.commit()
    if not kept_detections or not has_remaining_debris:
        _delete_snapshot_if_unused(snapshot_path)
    return {"message": "Debris detection deleted.", "eventId": eventId}


@app.api_route("/events/{eventId}/debris", methods=["DELETE", "POST"])
async def delete_event_debris(eventId: str, debris_type: str | None = None):
    return _remove_debris_detection(eventId, debris_type)


@app.api_route("/events/{eventId}", methods=["GET", "DELETE", "POST"])
async def event_handler(eventId: str, request: Request):
    if request.method in {"DELETE", "POST"}:
        row = _get_event_row(eventId)
        snapshot_path = row["snapshot"]
        c.execute("DELETE FROM events WHERE eventId = ?", (eventId,))
        con.commit()
        _delete_snapshot_if_unused(snapshot_path)
        return {"message": "Event deleted.", "eventId": eventId}

    row = _get_event_row(eventId)
    payload_obj = _decode_payload(row)
    return {
        "eventId": row["eventId"],
        "timestamp": row["timestamp"],
        "cameraID": row["cameraID"],
        "snapshot": row["snapshot"],
        "model": row["model"],
        "payload": payload_obj,
    }

@app.get("/events/{eventId}/snapshot")
async def get_event_snapshot(eventId: str):
    row = c.execute("SELECT snapshot FROM events WHERE eventId = ?", (eventId,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")

    snapshot_path = row["snapshot"]  #requires con.row_factory = sqlite3.Row
    if not snapshot_path:
        raise HTTPException(status_code=404, detail="No snapshot path stored for this event")

    resolved_path = resolve_snapshot_path(snapshot_path)
    if not resolved_path:
        raise HTTPException(
            status_code=404,
            detail=f"Snapshot file not found: {snapshot_path}",
        )

    return FileResponse(resolved_path)

@app.post("/run-inference")
async def run_inference(
    file: UploadFile = File(...),
    capture_mode: str = "single",
    reset_tracking: bool = False,
):
    #new try import from inside route
    try:
        from model.inferenceScripts import pipeline
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail="Inference pipeline unavailable right now. ultralytics is not installed."
        ) from e
    
    try:
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        event = pipeline.infer_image(
            file_path,
            use_delayed_snapshot=capture_mode == "tracking",
            reset_tracking_state=reset_tracking,
        )
        save_event_if_needed(event, trigger_hardware=False)

        # if event.get("shouldLog"): delete

        #     insQuery = """
        #     INSERT INTO events (eventId, timestamp, cameraID, snapshot, model, payload)
        #     VALUES (?,?,?,?,?,?)
        #     """
        #     data = (
        #         event["eventId"],
        #         event["timestamp"],
        #         event["cameraId"],
        #         event["snapshot"],
        #         event["model"],
        #         json.dumps(event),
        #     )

        #     c.execute(insQuery, data)
        #     con.commit()

        return {
            "message": "Inference complete and event stored.",
            "event": event
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/video-feed")
async def video_feed():
    try:
        from model.inferenceScripts import pipeline

        return StreamingResponse(
            pipeline.continous_feed(
                on_event=lambda event: save_event_if_needed(event, trigger_hardware=True)
            ),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/video-feed-preview")
async def video_feed_preview():
    try:
        from model.inferenceScripts import pipeline

        return StreamingResponse(
            pipeline.preview_feed(),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/video-feed-stats")
async def video_feed_stats():
    try:
        from model.inferenceScripts import pipeline

        return pipeline.get_live_feed_stats(
            on_event=lambda event: save_event_if_needed(event, trigger_hardware=True)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/db/carrots/range") #endpoint to connect carrots to frontend 
async def get_carrots_range(start: str, end: str):
    rows = c.execute(
        "SELECT * FROM events WHERE timestamp >= ? AND timestamp < ?",
        (start, end)
    ).fetchall()

    result = []

    for row in rows:
        try:
            payload = json.loads(row["payload"])
        except Exception:
            continue

        detections = payload.get("detections", [])
        ts = str(payload.get("timestamp", row["timestamp"])).replace("T", " ")

        for det in detections:
            if det.get("label") == "carrot":
                result.append({
                    "id": len(result) + 1,
                    "time_stamp": ts,
                    "length": det.get("length"),
                    "diameter": det.get("diameter"),
                })

    return {
        "count": len(result),
        "data": result
    }
    
#team 405 api expects log in this format
@app.get("/db/debris/range")
async def get_debris_range(start: str, end: str):
    rows = c.execute(
        "SELECT * FROM events WHERE timestamp >= ? AND timestamp < ?",
        (start, end)
    ).fetchall()

    result = []

    for row in rows:
        try:
            payload = json.loads(row["payload"])
        except Exception:
            continue

        if payload.get("type") == "debris":
            ts = str(payload.get("timestamp", row["timestamp"])).replace("T", " ")
            result.append({
                "time_stamp": ts,
                "debris_type": payload.get("debris_type", "unknown"),
                "image_path": payload.get("snapshot"),
                "event_id": row["eventId"]
            })

        detections = payload.get("detections", [])
        for det in detections:
            if det.get("label") != "carrot":
                result.append({
                    "time_stamp": row["timestamp"],
                    "debris_type": det.get("label"),
                    "image_path": row["snapshot"],
                    "event_id": row["eventId"]
                })

    return {
        "count": len(result),
        "data": result
    }

def save_event_if_needed(event: dict, trigger_hardware: bool = False):
    if not event.get("shouldLog"):
        return

    events_to_save = event.get("logEvents")
    if events_to_save is None:
        events_to_save = [event.get("logEvent", event)]

    insQuery = """
    INSERT INTO events (eventId, timestamp, cameraID, snapshot, model, payload)
    VALUES (?,?,?,?,?,?)
    """
    for event_to_save in events_to_save:
        data = (
            event_to_save["eventId"],
            event_to_save["timestamp"],
            event_to_save["cameraId"],
            event_to_save["snapshot"],
            event_to_save["model"],
            json.dumps(event_to_save),
        )
        c.execute(insQuery, data)
    con.commit()

    if not trigger_hardware:
        return

    for event_to_save in events_to_save:
        try:
            trigger_solenoid_for_event(event_to_save)
        except Exception:
            print("Warning: failed to trigger solenoid for event", event_to_save.get("eventId"))


# con.close()
