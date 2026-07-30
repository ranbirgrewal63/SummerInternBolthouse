import os


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

DB_PATH = os.path.abspath(
    os.getenv("EVENT_DB_PATH", os.path.join(PROJECT_ROOT, "eventData.db"))
)
UPLOAD_DIR = os.path.abspath(
    os.getenv("UPLOAD_DIR", os.path.join(BASE_DIR, "uploaded_images"))
)
SNAPSHOT_DIR = os.path.abspath(
    os.getenv("SNAPSHOT_DIR", os.path.join(BASE_DIR, "snapshots"))
)


def ensure_runtime_dirs() -> None:
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)


def storage_relative_path(path: str) -> str:
    return os.path.relpath(path, PROJECT_ROOT).replace("\\", "/")


def resolve_snapshot_path(snapshot_path: str) -> str | None:
    if not snapshot_path:
        return None

    normalized = snapshot_path.replace("\\", "/")
    candidates: list[str] = []

    if os.path.isabs(snapshot_path):
        candidates.append(os.path.abspath(snapshot_path))
    else:
        candidates.append(os.path.abspath(os.path.join(PROJECT_ROOT, snapshot_path)))

    candidates.append(os.path.join(SNAPSHOT_DIR, os.path.basename(normalized)))

    seen: set[str] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if os.path.exists(candidate):
            return candidate

    return None
