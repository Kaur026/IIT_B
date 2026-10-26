"""Small SQLite repository for the synthetic BE2 prototype.

Original beneficiary and measurement records are append-only from BE2's point
of view. Mutable task snapshots are updated, while every mutation is separately
written to the append-only audit_events table. This is local prototype storage,
not approved for real beneficiary data or production deployment.
"""

import json
import sqlite3
import threading
from copy import deepcopy


class StoreError(ValueError):
    """Raised for malformed or missing synthetic store records."""


def _json(value):
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    except (TypeError, ValueError) as exc:
        raise StoreError("Record must contain JSON-compatible values.") from exc


def _obj(value):
    return json.loads(value) if value else {}


class PrototypeStore:
    """Thread-safe SQLite-backed store with an in-memory default for tests."""

    def __init__(self, path=":memory:"):
        self.path = path
        self._lock = threading.RLock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._initialize()

    def _initialize(self):
        with self._lock, self._db:
            self._db.executescript("""
                CREATE TABLE IF NOT EXISTS beneficiaries (
                    beneficiary_id TEXT PRIMARY KEY,
                    centre_id TEXT NOT NULL,
                    assigned_worker_id TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS measurements (
                    measurement_id TEXT PRIMARY KEY,
                    beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL,
                    source TEXT NOT NULL,
                    recorded_at TEXT NOT NULL,
                    parent_measurement_id TEXT NOT NULL DEFAULT '',
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_measurements_beneficiary
                    ON measurements(beneficiary_id, recorded_at);
                CREATE TABLE IF NOT EXISTS flags (
                    flag_id TEXT PRIMARY KEY,
                    beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_flags_centre ON flags(centre_id, created_at);
                CREATE TABLE IF NOT EXISTS tasks (
                    task_id TEXT PRIMARY KEY,
                    beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_tasks_centre ON tasks(centre_id, status);
                CREATE TABLE IF NOT EXISTS audit_events (
                    event_id TEXT PRIMARY KEY,
                    actor_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    centre_id TEXT NOT NULL,
                    entity_type TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    action TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    details_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_audit_entity ON audit_events(entity_type, entity_id, occurred_at);
                CREATE TABLE IF NOT EXISTS decisions (
                    decision_id TEXT PRIMARY KEY,
                    beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL,
                    flag_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
            """)

    @staticmethod
    def _required(record, field):
        value = record.get(field)
        if not isinstance(value, str) or not value.strip():
            raise StoreError(f"{field} is required.")
        return value.strip()

    def add_beneficiary(self, record):
        if not isinstance(record, dict):
            raise StoreError("beneficiary record must be a dictionary.")
        ident = self._required(record, "beneficiary_id")
        centre = self._required(record, "centre_id")
        worker = str(record.get("assigned_worker_id") or "").strip()
        payload = deepcopy(record)
        with self._lock:
            try:
                with self._db:
                    self._db.execute(
                        "INSERT INTO beneficiaries VALUES (?, ?, ?, ?)",
                        (ident, centre, worker, _json(payload)),
                    )
            except sqlite3.IntegrityError as exc:
                raise StoreError(f"Beneficiary {ident} already exists; source records are not overwritten.") from exc
        return payload

    def get_beneficiary(self, beneficiary_id):
        with self._lock:
            row = self._db.execute(
                "SELECT payload_json FROM beneficiaries WHERE beneficiary_id=?",
                (beneficiary_id,),
            ).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_beneficiaries(self, centre_id):
        with self._lock:
            rows = self._db.execute(
                "SELECT payload_json FROM beneficiaries WHERE centre_id=? ORDER BY beneficiary_id",
                (centre_id,),
            ).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def append_measurement(self, record):
        if not isinstance(record, dict):
            raise StoreError("measurement record must be a dictionary.")
        fields = {name: self._required(record, name) for name in ("measurement_id", "beneficiary_id", "centre_id", "source", "recorded_at")}
        parent = str(record.get("parent_measurement_id") or "").strip()
        payload = deepcopy(record)
        with self._lock:
            try:
                with self._db:
                    self._db.execute(
                        "INSERT INTO measurements VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (fields["measurement_id"], fields["beneficiary_id"], fields["centre_id"], fields["source"], fields["recorded_at"], parent, _json(payload)),
                    )
            except sqlite3.IntegrityError as exc:
                raise StoreError("measurement_id already exists; measurements are append-only.") from exc
        return payload

    def get_measurement(self, measurement_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM measurements WHERE measurement_id=?", (measurement_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_measurements(self, beneficiary_id):
        with self._lock:
            rows = self._db.execute(
                "SELECT payload_json FROM measurements WHERE beneficiary_id=? ORDER BY recorded_at, rowid",
                (beneficiary_id,),
            ).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def add_flag(self, record):
        if not isinstance(record, dict):
            raise StoreError("flag must be a dictionary.")
        fields = {name: self._required(record, name) for name in ("flag_id", "beneficiary_id", "centre_id", "created_at")}
        payload = deepcopy(record)
        with self._lock:
            try:
                with self._db:
                    self._db.execute("INSERT INTO flags VALUES (?, ?, ?, ?, ?)", (fields["flag_id"], fields["beneficiary_id"], fields["centre_id"], fields["created_at"], _json(payload)))
            except sqlite3.IntegrityError as exc:
                raise StoreError("flag_id already exists; flags are immutable snapshots.") from exc
        return payload

    def get_flag(self, flag_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM flags WHERE flag_id=?", (flag_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_flags(self, centre_id=None, beneficiary_id=None):
        sql = "SELECT payload_json FROM flags WHERE 1=1"
        args = []
        if centre_id is not None:
            sql += " AND centre_id=?"; args.append(centre_id)
        if beneficiary_id is not None:
            sql += " AND beneficiary_id=?"; args.append(beneficiary_id)
        sql += " ORDER BY created_at, flag_id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def save_task(self, task):
        if not isinstance(task, dict):
            raise StoreError("task must be a dictionary.")
        fields = {name: self._required(task, name) for name in ("task_id", "beneficiary_id", "centre_id", "created_on", "status")}
        payload = deepcopy(task)
        with self._lock, self._db:
            self._db.execute(
                "INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(task_id) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json",
                (fields["task_id"], fields["beneficiary_id"], fields["centre_id"], fields["created_on"], fields["status"], _json(payload)),
            )
        return payload

    def get_task(self, task_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM tasks WHERE task_id=?", (task_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_tasks(self, centre_id=None, beneficiary_id=None):
        sql = "SELECT payload_json FROM tasks WHERE 1=1"; args = []
        if centre_id is not None:
            sql += " AND centre_id=?"; args.append(centre_id)
        if beneficiary_id is not None:
            sql += " AND beneficiary_id=?"; args.append(beneficiary_id)
        sql += " ORDER BY created_at, task_id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def append_audit(self, event):
        if not isinstance(event, dict):
            raise StoreError("audit event must be a dictionary.")
        fields = {name: self._required(event, name) for name in ("event_id", "actor_id", "role", "centre_id", "entity_type", "entity_id", "action", "occurred_at")}
        details = event.get("details", {})
        with self._lock:
            try:
                with self._db:
                    self._db.execute("INSERT INTO audit_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", (*fields.values(), _json(details)))
            except sqlite3.IntegrityError as exc:
                raise StoreError("Audit event IDs are unique and append-only.") from exc
        return deepcopy(event)

    def list_audit(self, entity_type=None, entity_id=None, centre_id=None):
        sql = "SELECT * FROM audit_events WHERE 1=1"; args = []
        for key, value in (("entity_type", entity_type), ("entity_id", entity_id), ("centre_id", centre_id)):
            if value is not None:
                sql += f" AND {key}=?"; args.append(value)
        sql += " ORDER BY occurred_at, rowid"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [{
            "event_id": row["event_id"], "actor_id": row["actor_id"], "role": row["role"],
            "centre_id": row["centre_id"], "entity_type": row["entity_type"], "entity_id": row["entity_id"],
            "action": row["action"], "occurred_at": row["occurred_at"], "details": _obj(row["details_json"]),
        } for row in rows]

    def add_decision(self, record):
        if not isinstance(record, dict):
            raise StoreError("decision must be a dictionary.")
        fields = {name: self._required(record, name) for name in ("decision_id", "beneficiary_id", "centre_id", "flag_id", "actor_id", "decision", "created_at")}
        payload = deepcopy(record)
        with self._lock:
            try:
                with self._db:
                    self._db.execute("INSERT INTO decisions VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (*fields.values(), _json(payload)))
            except sqlite3.IntegrityError as exc:
                raise StoreError("Decision IDs must be unique.") from exc
        return payload

    def list_decisions(self, beneficiary_id=None):
        sql = "SELECT payload_json FROM decisions WHERE 1=1"; args = []
        if beneficiary_id is not None:
            sql += " AND beneficiary_id=?"; args.append(beneficiary_id)
        sql += " ORDER BY created_at, decision_id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def close(self):
        with self._lock:
            self._db.close()
