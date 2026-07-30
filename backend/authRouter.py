import base64
import binascii
import hashlib
import hmac
import os
import secrets
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.database import get_connection, initialize_database

try:
    import bcrypt
except ImportError:
    bcrypt = None

Role = Literal["guest", "operator", "administrator"]
Status = Literal["pending", "approved", "disabled"]

VALID_ROLES = {"guest", "operator", "administrator"}
VALID_STATUSES = {"pending", "approved", "disabled"}
BUILTIN_GUEST_USERNAME = "guest"
BUILTIN_GUEST_ROLE = "guest"
BUILTIN_GUEST_STATUS = "approved"

auth_router = APIRouter(prefix="/auth", tags=["auth"])

PBKDF2_ALGORITHM = "pbkdf2_sha256"
PBKDF2_ITERATIONS = 390000


def _hash_password_pbkdf2(password: str) -> str:
    salt = secrets.token_bytes(16)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    salt_b64 = base64.b64encode(salt).decode("ascii")
    hash_b64 = base64.b64encode(derived_key).decode("ascii")
    return f"{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${salt_b64}${hash_b64}"


def _verify_password_pbkdf2(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_b64, expected_hash_b64 = password_hash.split("$", 3)
        if algorithm != PBKDF2_ALGORITHM:
            return False

        salt = base64.b64decode(salt_b64.encode("ascii"))
        expected_hash = base64.b64decode(expected_hash_b64.encode("ascii"))
        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations_text),
        )
        return hmac.compare_digest(derived_key, expected_hash)
    except (ValueError, TypeError, binascii.Error):
        return False


def hash_password(password: str) -> str:
    if bcrypt is None:
        return _hash_password_pbkdf2(password)

    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if password_hash.startswith(f"{PBKDF2_ALGORITHM}$"):
        return _verify_password_pbkdf2(password, password_hash)

    if bcrypt is None:
        return False

    try:
        password_bytes = password.encode("utf-8")
        hash_bytes = password_hash.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False

def validate_password(password: str) -> None:
    common_passwords = {"password", "admin", "operator", "guest", "12345678", "qwerty123"}

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    if password.lower() in common_passwords:
        raise HTTPException(status_code=400, detail="Password is too common.")

def public_account(row) -> dict:
    keys = row.keys()

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "username": row["username"],
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "created_at": row["created_at"] if "created_at" in keys else "N/A",
    }


def seed_default_accounts() -> None:
    initialize_database()
    con = get_connection()
    cur = con.cursor()

    defaults = [
        ("Default Admin", "admin", "admin@bolthouse.local", "admin", "administrator", "approved"),
        ("Default Operator", "operator", "operator@bolthouse.local", "operator", "operator", "approved"),
        ("Worker User", "guest", "guest@bolthouse.local", "guest", "guest", "approved"),
    ]

    for full_name, username, email, password, role, status in defaults:
        existing = cur.execute(
            "SELECT id FROM accounts WHERE username = ?",
            (username,),
        ).fetchone()

        if existing:
            cur.execute(
                """
                UPDATE accounts
                SET full_name = ?, email = ?, password_hash = ?, role = ?, status = ?
                WHERE username = ?
                """,
                (full_name, email, hash_password(password), role, status, username),
            )
        else:
            cur.execute(
                """
                INSERT INTO accounts
                    (full_name, username, email, password_hash, role, status)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (full_name, username, email, hash_password(password), role, status),
            )

    con.commit()
    con.close()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    full_name: str
    username: str
    email: str
    password: str


class AccountUpdateRequest(BaseModel):
    role: Optional[Role] = None
    status: Optional[Status] = None

seed_default_accounts()


@auth_router.post("/login")
async def login(payload: LoginRequest):
    username = payload.username.strip()
    password = payload.password

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required.")

    con = get_connection()
    row = con.execute(
        "SELECT * FROM accounts WHERE username = ?",
        (username,),
    ).fetchone()

    if row is None or not verify_password(password, row["password_hash"]):
        con.close()
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    # Keep the built-in guest account limited even if it was edited earlier.
    if (
        row["username"] == BUILTIN_GUEST_USERNAME
        and (row["role"] != BUILTIN_GUEST_ROLE or row["status"] != BUILTIN_GUEST_STATUS)
    ):
        con.execute(
            """
            UPDATE accounts
            SET role = ?, status = ?
            WHERE id = ?
            """,
            (BUILTIN_GUEST_ROLE, BUILTIN_GUEST_STATUS, row["id"]),
        )
        con.commit()
        row = con.execute(
            "SELECT * FROM accounts WHERE id = ?",
            (row["id"],),
        ).fetchone()

    if row["status"] == "pending":
        con.close()
        raise HTTPException(status_code=403, detail="Your account is still pending approval.")

    if row["status"] == "disabled":
        con.close()
        raise HTTPException(status_code=403, detail="This account has been disabled.")

    con.close()
    return {"message": "Login successful.", "user": public_account(row)}


@auth_router.post("/register")
async def register(payload: RegisterRequest):
    full_name = payload.full_name.strip()
    username = payload.username.strip()
    email = payload.email.strip().lower()
    password = payload.password

    if not full_name or not username or not email or not password:
        raise HTTPException(status_code=400, detail="Full name, username, email, and password are required.")

    if "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    validate_password(password)

    con = get_connection()
    try:
        cur = con.cursor()
        cur.execute(
            """
            INSERT INTO accounts (full_name, username, email, password_hash, role, status)
            VALUES (?, ?, ?, ?, 'operator', 'pending')
            """,
            (full_name, username, email, hash_password(password)),
        )
        con.commit()
    except Exception as e:
        con.close()
        message = str(e)
        if "UNIQUE" in message.upper():
            raise HTTPException(status_code=409, detail="Username or email is already registered.")
        raise HTTPException(status_code=500, detail=message)

    row = con.execute("SELECT * FROM accounts WHERE username = ?", (username,)).fetchone()
    con.close()
    return {"message": "Registration submitted. An admin can approve this account.", "user": public_account(row)}


@auth_router.get("/accounts")
async def list_accounts():
    con = get_connection()
    rows = con.execute(
        "SELECT * FROM accounts ORDER BY created_at DESC, id DESC"
    ).fetchall()
    con.close()
    return [public_account(row) for row in rows]


@auth_router.put("/accounts/{account_id}")
async def update_account(account_id: int, payload: AccountUpdateRequest):
    if payload.role is None and payload.status is None:
        raise HTTPException(status_code=400, detail="Provide role, status, or both.")

    con = get_connection()
    cur = con.cursor()
    existing = con.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()

    if existing is None:
        con.close()
        raise HTTPException(status_code=404, detail="Account not found.")

    if existing["username"] == BUILTIN_GUEST_USERNAME:
        if payload.role is not None and payload.role != BUILTIN_GUEST_ROLE:
            con.close()
            raise HTTPException(status_code=400, detail="The built-in guest account role cannot be changed.")
        if payload.status is not None and payload.status != BUILTIN_GUEST_STATUS:
            con.close()
            raise HTTPException(status_code=400, detail="The built-in guest account must remain approved.")

    updates = []
    values = []

    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            con.close()
            raise HTTPException(status_code=400, detail="Invalid role.")
        updates.append("role = ?")
        values.append(payload.role)

    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            con.close()
            raise HTTPException(status_code=400, detail="Invalid status.")
        updates.append("status = ?")
        values.append(payload.status)

    values.append(account_id)
    cur.execute(f"UPDATE accounts SET {', '.join(updates)} WHERE id = ?", values)
    con.commit()

    row = con.execute("SELECT * FROM accounts WHERE id = ?", (account_id,)).fetchone()
    con.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Account not found.")

    return {"message": "Account updated.", "user": public_account(row)}

@auth_router.delete("/accounts/{account_id}")
async def delete_account(account_id: int):
    con = get_connection()
    cur = con.cursor()

    row = cur.execute(
        "SELECT * FROM accounts WHERE id = ?",
        (account_id,),
    ).fetchone()

    if row is None:
        con.close()
        raise HTTPException(status_code=404, detail="Account not found.")

    if row["username"] == BUILTIN_GUEST_USERNAME:
        con.close()
        raise HTTPException(status_code=400, detail="The built-in guest account cannot be deleted.")

    cur.execute(
        "DELETE FROM accounts WHERE id = ?",
        (account_id,),
    )

    con.commit()
    con.close()

    return {"message": "Account deleted successfully."}
