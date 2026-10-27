"""BE2 F9 local offline queue and conflict-safe sync primitives.

This module demonstrates local durable queueing and deterministic reconciliation
for synthetic prototype records. It does not connect to a remote server. Real
sync requires authenticated transport, encryption, access control, backup,
conflict review, and a privacy review before any non-synthetic data is used.
"""

import json
import os
import tempfile
from copy import deepcopy
from pathlib import Path
from uuid import uuid4

from B2.demo_clock import DateLike, parse_date


SCHEMA_VERSION = 1
ALLOWED_ENTITY_TYPES = frozenset({"task", "referral", "consent", "fallback", "access_exception", "verification", "maternal_followup"})
ALLOWED_ACTIONS = frozenset({"upsert"})


class SyncError(ValueError):
    """Raised when an offline operation or queue is invalid."""


def _required_text(value, name):
    if not isinstance(value, str) or not value.strip():
        raise SyncError(f"{name} is required.")
    return value.strip()


def _read_queue(path):
    file_path = Path(path)
    if not file_path.exists():
        return {"schema_version": SCHEMA_VERSION, "operations": []}
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SyncError("Offline queue file is unreadable or invalid JSON.") from exc
    if not isinstance(data, dict) or data.get("schema_version") != SCHEMA_VERSION:
        raise SyncError("Offline queue has an unsupported schema version.")
    if not isinstance(data.get("operations"), list):
        raise SyncError("Offline queue operations must be a list.")
    return data


def _write_queue(path, data):
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=str(file_path.parent),
            prefix=file_path.name + ".",
            suffix=".tmp",
            delete=False,
        ) as temp:
            temp_name = temp.name
            json.dump(data, temp, ensure_ascii=False, indent=2, sort_keys=True)
            temp.flush()
            os.fsync(temp.fileno())
        os.replace(temp_name, file_path)
    except OSError as exc:
        if temp_name and os.path.exists(temp_name):
            os.unlink(temp_name)
        raise SyncError("Could not save the offline queue safely.") from exc


def enqueue_operation(
    path,
    entity_type: str,
    entity_id: str,
    payload: dict,
    base_version: int,
    created_at: DateLike,
    action: str = "upsert",
    operation_id: str = "",
):
    """Atomically append a pending, idempotent operation to a local JSON queue."""
    kind = _required_text(entity_type, "entity_type").lower()
    entity = _required_text(entity_id, "entity_id")
    action_value = _required_text(action, "action").lower()
    if kind not in ALLOWED_ENTITY_TYPES:
        raise SyncError("Unsupported entity_type.")
    if action_value not in ALLOWED_ACTIONS:
        raise SyncError("Unsupported operation action.")
    if not isinstance(payload, dict):
        raise SyncError("payload must be a dictionary.")
    if isinstance(base_version, bool) or not isinstance(base_version, int) or base_version < 0:
        raise SyncError("base_version must be a non-negative integer.")
    try:
        json.dumps(payload)
    except (TypeError, ValueError) as exc:
        raise SyncError("payload must contain JSON-serializable values.") from exc

    identifier = operation_id.strip() if isinstance(operation_id, str) else ""
    identifier = identifier or str(uuid4())
    operation = {
        "operation_id": identifier,
        "entity_type": kind,
        "entity_id": entity,
        "action": action_value,
        "base_version": base_version,
        "payload": deepcopy(payload),
        "created_at": parse_date(created_at).isoformat(),
        "sync_status": "pending",
    }
    data = _read_queue(path)
    existing = next(
        (item for item in data["operations"]
         if isinstance(item, dict) and item.get("operation_id") == identifier),
        None,
    )
    if existing is not None:
        comparable = {key: value for key, value in existing.items() if key != "sync_status"}
        expected = {key: value for key, value in operation.items() if key != "sync_status"}
        if comparable != expected:
            raise SyncError("operation_id was already used for different operation data.")
        return deepcopy(existing)
    data["operations"].append(operation)
    _write_queue(path, data)
    return deepcopy(operation)


def load_operations(path, status=None):
    """Load queued operations, optionally filtering by sync status."""
    operations = deepcopy(_read_queue(path)["operations"])
    return [op for op in operations if status is None or op.get("sync_status") == status]


def reconcile_operations(operations: list, server_state: dict, applied_operation_ids=None):
    """Apply version-matched operations to an in-memory server snapshot.

    Operations are idempotent by operation_id. A stale base_version becomes a
    conflict and is not overwritten automatically, preserving newer data for
    explicit review instead of silently using last-write-wins.
    """
    if not isinstance(operations, list) or not isinstance(server_state, dict):
        raise SyncError("operations and server_state must be list/dictionary.")
    state = deepcopy(server_state)
    applied = set(applied_operation_ids or [])
    results = []

    for operation in operations:
        if not isinstance(operation, dict):
            raise SyncError("Each operation must be a dictionary.")
        op_id = _required_text(operation.get("operation_id"), "operation_id")
        entity_type = _required_text(operation.get("entity_type"), "entity_type").lower()
        entity_id = _required_text(operation.get("entity_id"), "entity_id")
        if entity_type not in ALLOWED_ENTITY_TYPES:
            raise SyncError("Unsupported entity_type.")
        if operation.get("action") not in ALLOWED_ACTIONS:
            raise SyncError("Unsupported operation action.")
        payload = operation.get("payload")
        base_version = operation.get("base_version")
        if not isinstance(payload, dict):
            raise SyncError("operation payload must be a dictionary.")
        if isinstance(base_version, bool) or not isinstance(base_version, int) or base_version < 0:
            raise SyncError("operation base_version must be a non-negative integer.")

        if op_id in applied:
            results.append({"operation_id": op_id, "status": "duplicate", "entity_id": entity_id})
            continue

        state_key = f"{entity_type}:{entity_id}"
        current = state.get(state_key)
        current_version = current.get("version", 0) if isinstance(current, dict) else 0
        if current_version != base_version:
            results.append({
                "operation_id": op_id,
                "status": "conflict",
                "entity_id": entity_id,
                "expected_base_version": base_version,
                "current_version": current_version,
                "message": "Server record changed since this offline edit; review before retrying.",
            })
            continue

        merged = deepcopy(current) if isinstance(current, dict) else {}
        merged.update(deepcopy(payload))
        merged.update({
            "entity_id": entity_id,
            "entity_type": entity_type,
            "version": current_version + 1,
            "last_operation_id": op_id,
        })
        state[state_key] = merged
        applied.add(op_id)
        results.append({
            "operation_id": op_id,
            "status": "synced",
            "entity_id": entity_id,
            "new_version": merged["version"],
        })

    return {"server_state": state, "results": results, "applied_operation_ids": sorted(applied)}


def apply_sync_results(path, results):
    """Persist sync statuses locally after the caller completes a sync attempt."""
    if not isinstance(results, list):
        raise SyncError("results must be a list.")
    data = _read_queue(path)
    by_id = {result.get("operation_id"): result for result in results if isinstance(result, dict)}
    for operation in data["operations"]:
        result = by_id.get(operation.get("operation_id"))
        if not result:
            continue
        if result.get("status") == "synced" or result.get("status") == "duplicate":
            operation["sync_status"] = "synced"
            operation.pop("sync_error", None)
        elif result.get("status") == "conflict":
            operation["sync_status"] = "conflict"
            operation["sync_error"] = result.get("message", "Conflict requires review.")
        elif result.get("status") == "failed":
            operation["sync_status"] = "failed"
            operation["sync_error"] = result.get("message", "Sync attempt failed; retry is available.")
    _write_queue(path, data)
    return deepcopy(data["operations"])


def retry_failed_operation(path, operation_id: str):
    """Explicitly move one failed operation back to pending for another attempt."""
    identifier = _required_text(operation_id, "operation_id")
    data = _read_queue(path)
    for operation in data["operations"]:
        if operation.get("operation_id") == identifier:
            if operation.get("sync_status") != "failed" or operation.get("resolution") == "discard_pending_change":
                raise SyncError("Only retryable failed operations can be retried; discarded changes require a new operation.")
            operation["sync_status"] = "pending"
            operation["retry_count"] = int(operation.get("retry_count", 0)) + 1
            operation.pop("sync_error", None)
            _write_queue(path, data)
            return deepcopy(operation)
    raise SyncError("Offline operation not found.")


def resolve_conflict(path, operation_id: str, resolution: str, latest_version=None):
    """Record an explicit conflict decision; never silently replace server data."""
    identifier = _required_text(operation_id, "operation_id")
    choice = _required_text(resolution, "resolution").lower()
    data = _read_queue(path)
    for operation in data["operations"]:
        if operation.get("operation_id") != identifier:
            continue
        if operation.get("sync_status") != "conflict":
            raise SyncError("Only a conflicted operation can be resolved.")
        if choice == "retry_with_current_version":
            if isinstance(latest_version, bool) or not isinstance(latest_version, int) or latest_version < 0:
                raise SyncError("latest_version is required for retry_with_current_version.")
            operation["base_version"] = latest_version
            operation["sync_status"] = "pending"
            operation["resolution"] = "retry_with_current_version"
            operation["resolution_count"] = int(operation.get("resolution_count", 0)) + 1
            operation.pop("sync_error", None)
        elif choice == "discard_pending_change":
            operation["sync_status"] = "failed"
            operation["resolution"] = "discard_pending_change"
            operation["resolution_count"] = int(operation.get("resolution_count", 0)) + 1
            operation["sync_error"] = "Pending change was explicitly discarded; source/server record was not changed."
        else:
            raise SyncError("resolution must be retry_with_current_version or discard_pending_change.")
        _write_queue(path, data)
        return deepcopy(operation)
    raise SyncError("Offline operation not found.")
