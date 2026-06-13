import hashlib
import os
import secrets
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "users.db"
AUTH_SALT = os.getenv("AUTH_SALT", "skysync_default_salt")
SESSION_EXPIRY_DAYS = 7


def get_connection():
    connection = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
        """
    )
    connection.commit()
    connection.close()


initialize_database()


def hash_password(password: str) -> str:
    salted = f"{password}{AUTH_SALT}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


def serialize_user(row):
    if row is None:
        return None
    return {
        "id": row["id"],
        "email": row["email"],
        "created_at": row["created_at"],
    }


def create_user(email: str, password: str):
    password_hash = hash_password(password)
    created_at = datetime.utcnow().isoformat()
    connection = get_connection()
    try:
        cursor = connection.cursor()
        cursor.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email.lower().strip(), password_hash, created_at),
        )
        connection.commit()
        user_id = cursor.lastrowid
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return serialize_user(row)
    except sqlite3.IntegrityError:
        return None
    finally:
        connection.close()


def get_user_by_email(email: str):
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
    ).fetchone()
    connection.close()
    return serialize_user(row)


def get_user_by_id(user_id: int):
    connection = get_connection()
    row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    connection.close()
    return serialize_user(row)


def verify_user_password(email: str, password: str):
    connection = get_connection()
    row = connection.execute(
        "SELECT * FROM users WHERE email = ?", (email.lower().strip(),)
    ).fetchone()
    connection.close()
    if row is None:
        return None
    expected_hash = row["password_hash"]
    if hash_password(password) != expected_hash:
        return None
    return serialize_user(row)


def create_session(user_id: int):
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)).isoformat()
    created_at = datetime.utcnow().isoformat()
    connection = get_connection()
    connection.execute(
        "INSERT INTO sessions (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)",
        (user_id, token, expires_at, created_at),
    )
    connection.commit()
    connection.close()
    return token


def get_user_by_token(token: str):
    connection = get_connection()
    row = connection.execute(
        "SELECT u.* FROM users u JOIN sessions s ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?",
        (token, datetime.utcnow().isoformat()),
    ).fetchone()
    connection.close()
    return serialize_user(row)


def invalidate_session(token: str):
    connection = get_connection()
    connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
    connection.commit()
    connection.close()
