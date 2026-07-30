#This is temporary fake data to be removed later
#connect it using "python seedFakeDebris.py" from the backend folder
import sqlite3
import json
import os
import random
from datetime import datetime, timedelta

# Match endpoints.py database path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "eventData.db")

print("Seeding demo data into:", DB_PATH)

con = sqlite3.connect(DB_PATH)
c = con.cursor()

c.execute("""
CREATE TABLE IF NOT EXISTS events (
    eventId TEXT,
    timestamp TEXT,
    cameraID TEXT,
    snapshot TEXT,
    model TEXT,
    payload TEXT
)
""")

# Remove old seeded rows so reruns stay clean
#c.execute("DELETE FROM events WHERE eventId LIKE 'carrot-demo-%'")
#c.execute("DELETE FROM events WHERE eventId LIKE 'debris-demo-%'")

now = datetime.now().replace(microsecond=0)

# 6 months before and 6 months after current day
window_start = now - timedelta(days=182)
window_end = now + timedelta(days=182)
total_seconds = int((window_end - window_start).total_seconds())

def random_timestamp():
    offset_seconds = random.randint(0, total_seconds)
    ts = window_start + timedelta(seconds=offset_seconds)

    # Optional: keep events during normal daytime hours
    ts = ts.replace(
        hour=random.randint(8, 20),
        minute=random.randint(0, 59),
        second=random.randint(0, 59),
    )
    return ts.strftime("%Y-%m-%d %H:%M:%S")

def random_bbox():
    x1 = random.randint(20, 180)
    y1 = random.randint(20, 120)
    x2 = random.randint(x1 + 20, 400)
    y2 = random.randint(y1 + 20, 260)
    return {
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2
    }

carrot_events = []
debris_events = []

TOTAL_EVENTS = 1000
NUM_CARROT_EVENTS = 500
NUM_DEBRIS_EVENTS = 500

# ---------------------------
# Generate carrot demo events
# ---------------------------
for i in range(1, NUM_CARROT_EVENTS + 1):
    carrot_count = random.randint(4, 18)
    detections = []

    for _ in range(carrot_count):
        detections.append({
            "label": "carrot",
            "confidence": round(random.uniform(0.82, 0.99), 2),
            "length": round(random.uniform(5.5, 11.5), 2),
            "diameter": round(random.uniform(1.4, 3.2), 2),
            "boundingBox": random_bbox()
        })

    event = {
        "eventId": f"carrot-demo-{i:04d}",
        "timestamp": random_timestamp(),
        "cameraId": "CAM-01",
        "snapshot": "",
        "model": "demo-model",
        "detections": detections
    }

    carrot_events.append(event)

# ---------------------------
# Generate debris demo events
# ---------------------------
debris_labels = [
    "foreign_material",
    "plastic",
    "metal",
    "aluminum",
    "root",
    "wire"
]

for i in range(1, NUM_DEBRIS_EVENTS + 1):
    label = random.choice(debris_labels)

    event = {
        "eventId": f"debris-demo-{i:04d}",
        "timestamp": random_timestamp(),
        "cameraId": "CAM-01",
        "snapshot": "",
        "model": "demo-model",
        "type": "debris",
        "debris_type": label,
        "detections": [
            {
                "label": label,
                "confidence": round(random.uniform(0.70, 0.97), 2),
                "boundingBox": random_bbox()
            }
        ]
    }

    debris_events.append(event)

all_events = carrot_events + debris_events
all_events.sort(key=lambda e: e["timestamp"])

insert_sql = """
INSERT INTO events (eventId, timestamp, cameraID, snapshot, model, payload)
VALUES (?, ?, ?, ?, ?, ?)
"""

for event in all_events:
    c.execute(insert_sql, (
        event["eventId"],
        event["timestamp"],
        event["cameraId"],
        event["snapshot"],
        event["model"],
        json.dumps(event)
    ))

con.commit()
con.close()

print(f"Inserted {len(all_events)} demo events from {window_start.date()} to {window_end.date()}.")
