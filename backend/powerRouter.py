from fastapi import APIRouter
from pydantic import BaseModel
from backend.database import get_connection, initialize_database

power_router = APIRouter(prefix="/power", tags=["power"])


class PowerStateRequest(BaseModel):
    enabled: bool


initialize_database()


def read_power_state() -> bool:
    con = get_connection()
    row = con.execute(
        "SELECT value FROM system_state WHERE key = 'power_enabled'"
    ).fetchone()
    con.close()
    return bool(row and row["value"] == "true")


def write_power_state(enabled: bool) -> bool:
    con = get_connection()
    con.execute(
        """
        INSERT INTO system_state (key, value, updated_at)
        VALUES ('power_enabled', ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP
        """,
        ("true" if enabled else "false",),
    )
    con.commit()
    con.close()
    return enabled


@power_router.get("/state")
async def get_power_state():
    return {"enabled": read_power_state()}


@power_router.post("/state")
async def set_power_state(payload: PowerStateRequest):
    return {"enabled": write_power_state(payload.enabled)}


# Backward-compatible route because the current frontend already calls /power/set/true
@power_router.post("/set/{enabled}")
async def set_power_state_legacy(enabled: bool):
    return {"enabled": write_power_state(enabled)}