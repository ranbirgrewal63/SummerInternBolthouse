import os
import sqlite3

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "eventData.db")


def get_connection() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH, check_same_thread=False)
    con.row_factory = sqlite3.Row
    return con


def initialize_database() -> None:
    con = get_connection()
    cur = con.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS events (
            eventId TEXT PRIMARY KEY,
            timestamp TEXT,
            cameraID TEXT,
            snapshot TEXT,
            model TEXT,
            payload TEXT
        )
    """)
    
    try:
        cur.execute("ALTER TABLE accounts ADD COLUMN created_at TEXT")
    except sqlite3.OperationalError:
        pass

    cur.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'operator',
            status TEXT NOT NULL DEFAULT 'pending',
            reset_code TEXT
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS system_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    system_state_columns = {
        row["name"] for row in cur.execute("PRAGMA table_info(system_state)").fetchall()
    }
    if "updated_at" not in system_state_columns:
        # Older local databases were created before this column existed.
        cur.execute("ALTER TABLE system_state ADD COLUMN updated_at TEXT")
        cur.execute(
            """
            UPDATE system_state
            SET updated_at = CURRENT_TIMESTAMP
            WHERE updated_at IS NULL
            """
        )

    cur.execute("""
        INSERT OR IGNORE INTO system_state (key, value)
        VALUES ('power_enabled', 'false')
    """)

    try:
      cur.execute("ALTER TABLE accounts ADD COLUMN reset_code TEXT")
    except sqlite3.OperationalError:
        pass

    con.commit()
    con.close()
    
