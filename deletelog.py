import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "eventData.db")

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Get all snapshot paths before deleting DB rows
cur.execute("SELECT snapshot FROM events WHERE snapshot IS NOT NULL AND snapshot != ''")
rows = cur.fetchall()

for (snapshot_path,) in rows:
    if snapshot_path and os.path.exists(snapshot_path):
        try:
            os.remove(snapshot_path)
            print(f"Deleted snapshot: {snapshot_path}")
        except Exception as e:
            print(f"Could not delete {snapshot_path}: {e}")

# Clear logged events
cur.execute("DELETE FROM events;")
con.commit()

# Optional: reset autoincrement counter
try:
    cur.execute("DELETE FROM sqlite_sequence WHERE name='events';")
    con.commit()
except Exception:
    pass

con.close()

print("Events and linked snapshots cleared.")
