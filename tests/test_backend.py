# Run all tests:
#     pytest tests/ -v

# Run with coverage report:
#     pytest tests/ -v --cov=backend --cov-report=xml:tests/coverage-backend.xml

import os
import sys
import json
import sqlite3
from datetime import datetime, timedelta

import numpy as np
import cv2
import pytest
from fastapi.testclient import TestClient

# Put the project root on the path so imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.authRouter import hash_password, verify_password
from backend.endpoints import app, DB_PATH

client = TestClient(app)



# Test 1: Basic database initialization
# Verify the events table exists and the health endpoint confirms the database is reachable.

def test_database_table_exists():
    # Check the events table exists directly in the DB file
    con = sqlite3.connect(DB_PATH)
    cursor = con.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='events'")
    result = cursor.fetchone()
    con.close()
    assert result is not None, "events table does not exist in the database"

    # Also confirm via the /health endpoint
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"



# Test 2: seedFakeData.py inserts valid rows
# Insert fake carrot and debris records directly into the database
# and verify they appear with the expected fields.
# (seedFakeData.py writes to backend/eventData.db; this test inserts
# into the same DB that endpoints.py uses so the assertions are reliable.)

def test_seed_fake_data_inserts_records():
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    fake_carrot = {
        "eventId": "carrot-demo-test-001",
        "timestamp": now,
        "cameraId": "CAM-01",
        "snapshot": "carrot-demo-test-001.jpg",
        "model": "demo-model",
        "detections": [
            {"label": "carrot", "confidence": 0.95, "length": 8.2, "diameter": 2.1,
             "boundingBox": {"x1": 50, "y1": 30, "x2": 200, "y2": 150}}
        ]
    }

    fake_debris = {
        "eventId": "debris-demo-test-001",
        "timestamp": now,
        "cameraId": "CAM-01",
        "snapshot": "debris-demo-test-001.jpg",
        "model": "demo-model",
        "type": "debris",
        "debris_type": "plastic",
        "detections": [
            {"label": "plastic", "confidence": 0.88,
             "boundingBox": {"x1": 60, "y1": 40, "x2": 180, "y2": 130}}
        ]
    }

    # Insert both rows directly into the DB (same path endpoints.py uses)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cursor = con.cursor()

    for event in [fake_carrot, fake_debris]:
        cursor.execute(
            "INSERT INTO events (eventId, timestamp, cameraID, snapshot, model, payload) VALUES (?,?,?,?,?,?)",
            (event["eventId"], event["timestamp"], event["cameraId"],
             event["snapshot"], event["model"], json.dumps(event))
        )
    con.commit()

    # Verify both rows exist with valid payloads
    cursor.execute("SELECT payload FROM events WHERE eventId = 'carrot-demo-test-001'")
    carrot_row = cursor.fetchone()

    cursor.execute("SELECT payload FROM events WHERE eventId = 'debris-demo-test-001'")
    debris_row = cursor.fetchone()
    con.close()

    assert carrot_row is not None, "Carrot seed row not found in database"
    assert debris_row is not None, "Debris seed row not found in database"

    carrot_payload = json.loads(carrot_row["payload"])
    assert "eventId" in carrot_payload
    assert "timestamp" in carrot_payload
    assert "detections" in carrot_payload
    assert carrot_payload["detections"][0]["label"] == "carrot"

    debris_payload = json.loads(debris_row["payload"])
    assert debris_payload["type"] == "debris"
    assert debris_payload["debris_type"] == "plastic"



# Test 3: Date range filter logic
# Verify /db/debris/range and /db/carrots/range return only data
# within the requested window and exclude out-of-range records.

def test_date_range_filter_returns_correct_data():
    today = datetime.now()
    start = (today - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
    end   = (today + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

    # Debris range should return results (seed data is from today)
    response = client.get(f"/db/debris/range?start={start}&end={end}")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "data" in data
    assert isinstance(data["data"], list)

    # Carrots range should also return results
    response = client.get(f"/db/carrots/range?start={start}&end={end}")
    assert response.status_code == 200
    data = response.json()
    assert "count" in data
    assert "data" in data

    # A future date range should return zero results
    future_start = (today + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
    future_end   = (today + timedelta(days=31)).strftime("%Y-%m-%d %H:%M:%S")
    response = client.get(f"/db/debris/range?start={future_start}&end={future_end}")
    assert response.status_code == 200
    assert response.json()["count"] == 0, "Future date range should return 0 results"


# Test 4: Model pipeline saves event to database
# POST an event to /events and verify it can be retrieved via
# GET /events/{eventId}. Simulates what the pipeline does after
# detecting foreign material.

def test_model_pipeline_event_stored_in_database():
    test_event = {
        "eventId": "test-pipeline-001",
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "cameraId": "test-camera-1",
        "snapshot": "",
        "model": "yolo26n-seg.pt",
        "detections": [{"label": "rock", "confidence": 0.91}],
        "shouldLog": True
    }

    # Insert the event via the endpoint
    post_response = client.post("/events", json=test_event)
    assert post_response.status_code == 200
    assert post_response.json()["eventId"] == "test-pipeline-001"

    # Retrieve and verify all expected fields are present
    get_response = client.get("/events/test-pipeline-001")
    assert get_response.status_code == 200
    result = get_response.json()
    assert result["eventId"] == "test-pipeline-001"
    assert result["cameraID"] == "test-camera-1"
    assert result["model"] == "yolo26n-seg.pt"

    # A non-existent event should return 404
    missing = client.get("/events/this-id-does-not-exist")
    assert missing.status_code == 404



# Test 5: Snapshot saving and image retrieval
# Insert a detection event with a real snapshot file path and
# verify GET /events/{eventId}/snapshot returns the image.

def test_snapshot_saving_and_retrieval():
    backend_dir   = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
    snapshot_dir  = os.path.join(backend_dir, "snapshots")
    os.makedirs(snapshot_dir, exist_ok=True)
    snapshot_path = os.path.join(snapshot_dir, "foreign_material_test-snap-001.jpg")

    # Write a small dummy image file to disk
    dummy_frame = np.zeros((10, 10, 3), dtype=np.uint8)
    cv2.imwrite(snapshot_path, dummy_frame)

    try:
        # Insert an event that points to the snapshot file
        test_event = {
            "eventId": "test-snap-001",
            "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
            "cameraId": "test-camera-1",
            "snapshot": snapshot_path,
            "model": "yolo26n-seg.pt",
            "detections": [],
            "shouldLog": True
        }
        client.post("/events", json=test_event)

        # The snapshot endpoint should return a 200 with image content
        response = client.get("/events/test-snap-001/snapshot")
        assert response.status_code == 200
        assert "image" in response.headers["content-type"]

        # A missing event ID should return 404
        response = client.get("/events/nonexistent-snap-id/snapshot")
        assert response.status_code == 404

    finally:
        # Clean up the temp image file
        if os.path.exists(snapshot_path):
            os.remove(snapshot_path)


def test_password_hashing_and_verification():
    password = "example-password-123"
    password_hash = hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash) is True
    assert verify_password("wrong-password", password_hash) is False


def test_hardware_config_routes_round_trip():
    hardware_response = client.get("/config/hardware")
    assert hardware_response.status_code == 200
    hardware = hardware_response.json()
    assert hardware["mode"] in {"simulator", "openplc", "direct"}

    updated_hardware = {
        **hardware,
        "mode": "direct",
        "solenoid_backend": "null",
        "gpio_pin": 22,
        "gpio_active_high": False,
    }
    put_hardware = client.put("/config/hardware", json=updated_hardware)
    assert put_hardware.status_code == 200
    assert put_hardware.json()["gpio_pin"] == 22

    timing_response = client.get("/config/timing")
    assert timing_response.status_code == 200
    timing = timing_response.json()
    updated_timing = {**timing, "latency_ms": 175}
    put_timing = client.put("/config/timing", json=updated_timing)
    assert put_timing.status_code == 200
    assert put_timing.json()["latency_ms"] == 175

    modbus_response = client.get("/config/modbus-map")
    assert modbus_response.status_code == 200
    modbus_map = modbus_response.json()
    modbus_payload = {
        "coils": modbus_map["coils"],
        "discrete_inputs": modbus_map["discrete_inputs"],
        "holding_registers": modbus_map["holding_registers"],
        "holding_registers_many": [
            {
                "name": block["name"],
                "address": block["address"],
            }
            for block in modbus_map["holding_registers_many"]
        ],
    }
    put_map = client.put("/config/modbus-map", json=modbus_payload)
    assert put_map.status_code == 200
    assert put_map.json()["buffer_length"] == modbus_map["buffer_length"]
