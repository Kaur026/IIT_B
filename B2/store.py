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
                CREATE TABLE IF NOT EXISTS referrals (
                    referral_id TEXT PRIMARY KEY, beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL, status TEXT NOT NULL,
                    created_at TEXT NOT NULL, payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_referrals_centre ON referrals(centre_id, created_at);
                CREATE TABLE IF NOT EXISTS access_exceptions (
                    exception_id TEXT PRIMARY KEY, beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL, status TEXT NOT NULL,
                    opened_at TEXT NOT NULL, payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_exceptions_centre ON access_exceptions(centre_id, opened_at);
                CREATE TABLE IF NOT EXISTS maternal_followups (
                    followup_id TEXT PRIMARY KEY, beneficiary_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL, status TEXT NOT NULL,
                    created_at TEXT NOT NULL, payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_maternal_centre ON maternal_followups(centre_id, created_at);
                CREATE TABLE IF NOT EXISTS closure_confirmations (
                    confirmation_id TEXT PRIMARY KEY, task_id TEXT NOT NULL,
                    centre_id TEXT NOT NULL, created_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_closure_task ON closure_confirmations(task_id, created_at);
                CREATE TABLE IF NOT EXISTS briefing_snapshots (
                    snapshot_id TEXT PRIMARY KEY, centre_id TEXT NOT NULL,
                    as_of TEXT NOT NULL, created_at TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS ix_snapshots_centre ON briefing_snapshots(centre_id, as_of);
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

    def save_measurement_and_flag(self, measurement, flag):
        """Atomically persist one immutable measurement and its evaluated flag."""
        if not isinstance(measurement, dict) or not isinstance(flag, dict):
            raise StoreError("Measurement and flag records must be dictionaries.")
        measurement_fields = {name: self._required(measurement, name) for name in (
            "measurement_id", "beneficiary_id", "centre_id", "source", "recorded_at"
        )}
        flag_fields = {name: self._required(flag, name) for name in (
            "flag_id", "beneficiary_id", "centre_id", "created_at"
        )}
        if (measurement_fields["beneficiary_id"] != flag_fields["beneficiary_id"]
                or measurement_fields["centre_id"] != flag_fields["centre_id"]
                or flag.get("measurement_id") != measurement_fields["measurement_id"]):
            raise StoreError("Measurement and flag must refer to the same saved record.")
        measurement_payload, flag_payload = deepcopy(measurement), deepcopy(flag)
        with self._lock:
            try:
                with self._db:
                    if measurement_fields["source"] == "initial":
                        existing = self._db.execute(
                            "SELECT 1 FROM measurements WHERE beneficiary_id=? AND source='initial' LIMIT 1",
                            (measurement_fields["beneficiary_id"],),
                        ).fetchone()
                        if existing:
                            raise StoreError("An initial measurement already exists for this beneficiary.")
                    self._db.execute(
                        "INSERT INTO measurements VALUES (?, ?, ?, ?, ?, ?, ?)",
                        (measurement_fields["measurement_id"], measurement_fields["beneficiary_id"],
                         measurement_fields["centre_id"], measurement_fields["source"],
                         measurement_fields["recorded_at"],
                         str(measurement.get("parent_measurement_id") or "").strip(),
                         _json(measurement_payload)),
                    )
                    self._db.execute(
                        "INSERT INTO flags VALUES (?, ?, ?, ?, ?)",
                        (flag_fields["flag_id"], flag_fields["beneficiary_id"],
                         flag_fields["centre_id"], flag_fields["created_at"], _json(flag_payload)),
                    )
            except sqlite3.IntegrityError as exc:
                raise StoreError("Measurement or flag already exists; saved records are immutable.") from exc
        return {"measurement": measurement_payload, "flag": flag_payload}

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

    def _save_mutable_json_record(self, table, record):
        allowed = {
            "referrals": ("referral_id", "beneficiary_id", "centre_id", "status", "created_at"),
            "access_exceptions": ("exception_id", "beneficiary_id", "centre_id", "status", "opened_at"),
            "maternal_followups": ("followup_id", "beneficiary_id", "centre_id", "status", "created_at"),
        }
        if table not in allowed or not isinstance(record, dict):
            raise StoreError("Unsupported JSON record type.")
        fields = allowed[table]
        values = [self._required(record, field) for field in fields]
        id_field = fields[0]
        payload = deepcopy(record)
        with self._lock, self._db:
            self._db.execute(
                f"INSERT INTO {table} VALUES (?, ?, ?, ?, ?, ?) "
                f"ON CONFLICT({id_field}) DO UPDATE SET status=excluded.status, payload_json=excluded.payload_json",
                (*values, _json(payload)),
            )
        return payload

    def save_referral(self, record):
        return self._save_mutable_json_record("referrals", record)

    def get_referral(self, referral_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM referrals WHERE referral_id=?", (referral_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_referrals(self, centre_id=None, beneficiary_id=None):
        sql = "SELECT payload_json FROM referrals WHERE 1=1"; args = []
        if centre_id is not None:
            sql += " AND centre_id=?"; args.append(centre_id)
        if beneficiary_id is not None:
            sql += " AND beneficiary_id=?"; args.append(beneficiary_id)
        sql += " ORDER BY created_at, referral_id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def save_exception(self, record):
        return self._save_mutable_json_record("access_exceptions", record)

    def get_exception(self, exception_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM access_exceptions WHERE exception_id=?", (exception_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_exceptions(self, centre_id=None, beneficiary_id=None):
        sql = "SELECT payload_json FROM access_exceptions WHERE 1=1"; args = []
        if centre_id is not None:
            sql += " AND centre_id=?"; args.append(centre_id)
        if beneficiary_id is not None:
            sql += " AND beneficiary_id=?"; args.append(beneficiary_id)
        sql += " ORDER BY opened_at, exception_id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def save_maternal_followup(self, record):
        return self._save_mutable_json_record("maternal_followups", record)

    def get_maternal_followup(self, followup_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM maternal_followups WHERE followup_id=?", (followup_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_maternal_followups(self, centre_id=None, beneficiary_id=None):
        sql = "SELECT payload_json FROM maternal_followups WHERE 1=1"; args = []
        if centre_id is not None:
            sql += " AND centre_id=?"; args.append(centre_id)
        if beneficiary_id is not None:
            sql += " AND beneficiary_id=?"; args.append(beneficiary_id)
        sql += " ORDER BY created_at, followup_id"
        with self._lock:
            rows = self._db.execute(sql, args).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def append_closure_confirmation(self, record):
        if not isinstance(record, dict):
            raise StoreError("closure confirmation must be a dictionary.")
        fields = {name: self._required(record, name) for name in ("confirmation_id", "task_id", "centre_id", "at")}
        with self._lock:
            try:
                with self._db:
                    self._db.execute("INSERT INTO closure_confirmations VALUES (?, ?, ?, ?, ?)",
                                     (fields["confirmation_id"], fields["task_id"], fields["centre_id"], fields["at"], _json(record)))
            except sqlite3.IntegrityError as exc:
                raise StoreError("Closure confirmation IDs are unique and append-only.") from exc
        return deepcopy(record)

    def list_closure_confirmations(self, task_id):
        with self._lock:
            rows = self._db.execute("SELECT payload_json FROM closure_confirmations WHERE task_id=? ORDER BY created_at, rowid", (task_id,)).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def add_briefing_snapshot(self, snapshot):
        if not isinstance(snapshot, dict):
            raise StoreError("snapshot must be a dictionary.")
        fields = {name: self._required(snapshot, name) for name in ("snapshot_id", "centre_id", "as_of", "generated_at")}
        with self._lock:
            try:
                with self._db:
                    self._db.execute("INSERT INTO briefing_snapshots VALUES (?, ?, ?, ?, ?)",
                                     (fields["snapshot_id"], fields["centre_id"], fields["as_of"], fields["generated_at"], _json(snapshot)))
            except sqlite3.IntegrityError as exc:
                raise StoreError("Snapshot IDs are unique and immutable.") from exc
        return deepcopy(snapshot)

    def get_briefing_snapshot(self, snapshot_id):
        with self._lock:
            row = self._db.execute("SELECT payload_json FROM briefing_snapshots WHERE snapshot_id=?", (snapshot_id,)).fetchone()
        return _obj(row["payload_json"]) if row else None

    def list_briefing_snapshots(self, centre_id):
        with self._lock:
            rows = self._db.execute("SELECT payload_json FROM briefing_snapshots WHERE centre_id=? ORDER BY as_of DESC, generated_at DESC", (centre_id,)).fetchall()
        return [_obj(row["payload_json"]) for row in rows]

    def close(self):
        with self._lock:
            self._db.close()
