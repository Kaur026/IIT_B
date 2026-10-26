"""FastAPI surface for the proposed BE2 Day 1 synthetic prototype.

Run from the repository root with:
    python -m uvicorn B2.api:app --reload
This API uses synthetic demo actor keys, SQLite prototype storage and a
synthetic centre mapping. It is not production authentication or a live
Poshan Tracker integration.
"""

import atexit
import csv
import json
import os
import sys
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from B2 import ai_service, closure, exceptions as access_exceptions, maternal, referrals, summary, sync, tasks
from B2.demo_clock import DEFAULT_DEMO_DATE, DemoClockError, parse_date
from B2.roles import (
    DEMO_ACTORS,
    RolePermissionError,
    Principal,
    require_api_permission,
    require_case_scope,
    require_centre_scope,
    resolve_demo_actor,
)
from B2.security import UnsafePayloadError, safe_note, validate_safe_json
from B2.store import PrototypeStore, StoreError
from B2.verification import VerificationError, build_flag_snapshot, remeasure

ROOT = Path(__file__).resolve().parents[1]
B1_DIR = ROOT / "B1"
if str(B1_DIR) not in sys.path:
    sys.path.insert(0, str(B1_DIR))


class VerificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    beneficiary_id: str = Field(min_length=1)
    measurement: dict
    recorded_at: str = Field(min_length=1)
    today: str | None = None


class CreateTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    flag_id: str = Field(min_length=1)
    created_on: str | None = None


class TaskActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(min_length=1)
    owner_id: str | None = None
    reason: str | None = None
    outcome: str | None = None
    notes: str | None = None
    on: str | None = None


class NextActionDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    suggestion_id: str = Field(min_length=1)
    decision: str = Field(min_length=1)
    edited_action: str | None = None
    reason: str | None = None
    action_data: dict = Field(default_factory=dict)
    on: str | None = None


class FollowupReferralRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    beneficiary_id: str = Field(min_length=1)
    referral_kind: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    reason_code: str = Field(min_length=1)
    task_id: str = ""
    due_on: str | None = None
    on: str | None = None


class FollowupReferralActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    action: str = Field(min_length=1)
    outcome_code: str = ""
    on: str | None = None


class AccessExceptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    beneficiary_id: str = Field(min_length=1)
    exception_type: str = Field(min_length=1)
    task_id: str = ""
    on: str | None = None


class AccessExceptionResolutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resolution_code: str = Field(min_length=1)
    on: str | None = None


class ClosureConfirmationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmation_key: str = Field(min_length=1)
    outcome: str = ""
    notes: str = ""
    on: str | None = None


class MaternalFollowupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    beneficiary_id: str = Field(min_length=1)
    age_years: int
    followup_type: str = Field(min_length=1)
    due_on: str = Field(min_length=1)


class MaternalFollowupActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: str = Field(min_length=1)
    outcome_code: str = ""
    on: str | None = None


class BriefingSnapshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    centre_id: str = Field(min_length=1)
    as_of: str | None = None


class OfflineQueueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    entity_type: str = Field(min_length=1)
    entity_id: str = Field(min_length=1)
    payload: dict
    base_version: int = Field(ge=0)
    created_at: str = Field(min_length=1)
    operation_id: str = ""


class OfflineSyncAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    server_state: dict = Field(default_factory=dict)
    applied_operation_ids: list[str] = Field(default_factory=list)
    simulate_failure: bool = False


class OfflineConflictResolutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    resolution: str = Field(min_length=1)
    latest_version: int | None = Field(default=None, ge=0)


def _audit(store, principal, centre_id, entity_type, entity_id, action, on, details=None):
    return store.append_audit({
        "event_id": str(uuid4()),
        "actor_id": principal.actor_id,
        "role": principal.role,
        "centre_id": centre_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "occurred_at": parse_date(on).isoformat(),
        "details": details or {},
    })


def _seed_synthetic_fixture(store):
    """Import exactly the BE1 C0001 fixture and add an explicitly synthetic centre.

    AWC-001 is a demo-only mapping, not a claim about the source data. The
    imported source row is preserved intact under source_row.
    """
    if store.get_beneficiary("C0001") is not None:
        return
    csv_path = B1_DIR / "children.csv"
    if not csv_path.exists():
        return
    with csv_path.open(newline="", encoding="utf-8") as handle:
        row = next((r for r in csv.DictReader(handle) if r.get("child_id") == "C0001"), None)
    if row is None:
        return

    try:
        import data_checks
        import rules_engine
    except ImportError:
        return

    beneficiary = {
        "beneficiary_id": row["child_id"],
        "child_id": row["child_id"],
        "centre_id": "AWC-001",
        "assigned_worker_id": row.get("assigned_worker_id", ""),
        "source_row": row,
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION — centre mapping is demo-only",
    }
    store.add_beneficiary(beneficiary)
    original = {
        "measurement_id": "MEAS-C0001-BASELINE",
        "beneficiary_id": "C0001",
        "centre_id": "AWC-001",
        "source": "original",
        "parent_measurement_id": "",
        "recorded_at": row.get("measurement_date") or DEFAULT_DEMO_DATE.isoformat(),
        "recorded_by": "BE1 synthetic fixture",
        "label": "SYNTHETIC DATA / PROPOSED INTEGRATION",
        **{key: row.get(key) for key in (
            "measurement_date", "weight_kg", "height_cm", "muac_mm", "oedema", "danger_sign",
            "age_months", "sex", "measurement_valid", "weight_prev1_kg", "weight_prev2_kg",
            "enrolled", "enrolment_date", "last_visit_date", "referral_status", "referral_date",
        )},
    }
    check = data_checks.check_child(row, today=DEFAULT_DEMO_DATE)
    evaluation = rules_engine.evaluate_child(row, today=DEFAULT_DEMO_DATE)
    original["measurement_valid"] = check.get("measurement_valid", True)
    original["data_quality_issues"] = check.get("issues", [])
    original["evaluation"] = evaluation
    store.append_measurement(original)
    if evaluation.get("colour") != "GREEN":
        try:
            version = json.loads((B1_DIR / "thresholds.json").read_text(encoding="utf-8")).get("version", "unknown")
        except (OSError, json.JSONDecodeError):
            version = "unknown"
        flag = build_flag_snapshot(
            beneficiary, original, evaluation, check, version,
            row.get("measurement_date") or DEFAULT_DEMO_DATE.isoformat(),
            flag_id="FLAG-C0001-BASELINE",
        )
        store.add_flag(flag)


def create_app(store=None, seed_demo=True, closure_policies=None,
               maternal_enabled=None, maternal_allowed_roles=("supervisor",),
               offline_queue_dir=None):
    database_path = os.environ.get("B2_DB_PATH", str(ROOT / "B2" / ".prototype.sqlite"))
    repository = store or PrototypeStore(database_path)
    if store is None:
        atexit.register(repository.close)
    if seed_demo:
        _seed_synthetic_fixture(repository)
    if closure_policies is None:
        policy_path = os.environ.get("B2_CLOSURE_POLICY_FILE", "")
        if policy_path and Path(policy_path).is_file():
            try:
                closure_policies = json.loads(Path(policy_path).read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                closure_policies = {}
        else:
            closure_policies = {}
    maternal_enabled = (os.environ.get("B2_MATERNAL_SCOPE_APPROVED", "").lower() == "true") if maternal_enabled is None else bool(maternal_enabled)
    queue_dir = Path(offline_queue_dir or os.environ.get("B2_OFFLINE_QUEUE_DIR", str(ROOT / "B2" / ".offline")))
    try:
        demo_date = parse_date(os.environ.get("B2_DEMO_DATE", DEFAULT_DEMO_DATE.isoformat()))
    except ValueError as exc:
        raise RuntimeError("B2_DEMO_DATE must use YYYY-MM-DD.") from exc

    application = FastAPI(
        title="BE2 Workflow API — synthetic prototype",
        version="0.2.0-proposed",
        description="Proposed, mock-first API. Not approved for real beneficiary data or production use.",
    )
    application.state.store = repository
    application.state.closure_policies = closure_policies
    application.state.maternal_enabled = maternal_enabled
    application.state.maternal_allowed_roles = tuple(maternal_allowed_roles)
    application.state.offline_queue_dir = queue_dir
    application.state.demo_date = demo_date
    origins = [o.strip() for o in os.environ.get("B2_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Demo-Actor"],
    )

    @application.exception_handler(HTTPException)
    async def http_error_handler(request: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "code" in detail:
            payload = detail
        else:
            payload = {"code": "request_error", "message": str(detail), "retryable": False}
        return JSONResponse(status_code=exc.status_code, content={"error": payload})

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"error": {
            "code": "invalid_request", "message": "Request fields are missing or invalid.",
            "retryable": False, "fields": exc.errors(),
        }})

    @application.exception_handler(RolePermissionError)
    async def permission_error_handler(request: Request, exc: RolePermissionError):
        return JSONResponse(status_code=403, content={"error": {"code": "forbidden", "message": str(exc), "retryable": False}})

    async def domain_error_handler(request: Request, exc: Exception):
        return JSONResponse(status_code=400, content={"error": {"code": "invalid_operation", "message": str(exc), "retryable": False}})

    for error_type in (
        StoreError, DemoClockError, VerificationError, ai_service.AIServiceError, tasks.TaskActionError,
        referrals.ReferralError, access_exceptions.AccessExceptionError,
        maternal.MaternalFollowupError, closure.ClosureError, sync.SyncError,
        UnsafePayloadError,
    ):
        application.add_exception_handler(error_type, domain_error_handler)

    def principal(actor_key: str) -> Principal:
        try:
            return resolve_demo_actor(actor_key)
        except RolePermissionError as exc:
            raise HTTPException(status_code=401, detail={"code": "unauthorized", "message": str(exc), "retryable": False}) from exc

    def beneficiary_case(actor, beneficiary_id, permission):
        beneficiary = repository.get_beneficiary(beneficiary_id)
        if beneficiary is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Beneficiary not found.", "retryable": False})
        require_case_scope(actor, beneficiary["centre_id"], permission, beneficiary.get("assigned_worker_id", ""))
        return beneficiary

    def flag_case(actor, flag_id, permission):
        flag = repository.get_flag(flag_id)
        if flag is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Flag not found.", "retryable": False})
        beneficiary = beneficiary_case(actor, flag["beneficiary_id"], permission)
        return beneficiary, flag

    def validate_demo_owner(owner_id, centre_id, expected_role=None):
        """Fail closed unless a synthetic target identity is explicitly allow-listed."""
        matches = [p for p in DEMO_ACTORS.values() if p.actor_id == owner_id and centre_id in p.centre_ids]
        if not matches:
            raise RolePermissionError("Task owner is not an allow-listed demo actor for this centre.")
        if expected_role and matches[0].role != expected_role:
            raise RolePermissionError(f"Task owner must have the synthetic role {expected_role!r}.")
        return matches[0]

    def _queue_path(actor):
        queue_dir.mkdir(parents=True, exist_ok=True)
        safe_actor = "".join(ch for ch in actor.actor_id if ch.isalnum() or ch in "-_")
        return queue_dir / f"{safe_actor}.json"

    def _entity_beneficiary(entity_type, entity_id, actor, permission):
        if entity_type == "task":
            record = repository.get_task(entity_id)
        elif entity_type == "referral":
            record = repository.get_referral(entity_id)
        elif entity_type == "access_exception":
            record = repository.get_exception(entity_id)
        elif entity_type == "verification":
            record = repository.get_measurement(entity_id)
        elif entity_type == "maternal_followup":
            if not maternal_enabled:
                raise HTTPException(status_code=409, detail={"code": "maternal_scope_disabled", "message": "Maternal follow-up is disabled pending scope approval.", "retryable": False})
            require_api_permission(actor, "view_maternal")
            if actor.role not in maternal_allowed_roles:
                raise RolePermissionError("Role is outside the restricted maternal-follow-up allow-list.")
            record = repository.get_maternal_followup(entity_id)
        else:
            raise HTTPException(status_code=400, detail={"code": "unsupported_entity", "message": "Entity type cannot be queued by this API.", "retryable": False})
        if record is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Referenced record not found.", "retryable": False})
        return beneficiary_case(actor, record["beneficiary_id"], permission)

    @application.get("/api/health")
    def health():
        return {"status": "ok", "mode": "synthetic_prototype", "seeded": repository.get_beneficiary("C0001") is not None,
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION", "production_auth": False}

    @application.get("/api/audit")
    def audit_endpoint(centre_id: str, entity_type: str | None = None, entity_id: str | None = None,
                       limit: int = Query(100, ge=1, le=500),
                       x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_audit")
        require_centre_scope(actor, centre_id)
        events = repository.list_audit(centre_id=centre_id)
        if actor.role == "worker":
            owned = [b for b in repository.list_beneficiaries(centre_id)
                     if b.get("assigned_worker_id") == actor.assigned_worker_id]
            allowed_ids = set()
            for beneficiary in owned:
                bid = beneficiary["beneficiary_id"]
                allowed_ids.add(bid)
                allowed_ids.update(m.get("measurement_id") for m in repository.list_measurements(bid))
                allowed_ids.update(f.get("flag_id") for f in repository.list_flags(beneficiary_id=bid))
                allowed_ids.update(t.get("task_id") for t in repository.list_tasks(beneficiary_id=bid))
                allowed_ids.update(r.get("referral_id") for r in repository.list_referrals(beneficiary_id=bid))
                allowed_ids.update(x.get("exception_id") for x in repository.list_exceptions(beneficiary_id=bid))
                allowed_ids.update(d.get("decision_id") for d in repository.list_decisions(beneficiary_id=bid))
            events = [event for event in events if event.get("entity_id") in allowed_ids]
        if entity_type:
            events = [event for event in events if event.get("entity_type") == entity_type]
        if entity_id:
            events = [event for event in events if event.get("entity_id") == entity_id]
        return {"centre_id": centre_id, "events": events[-limit:],
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/cases/{beneficiary_id}/explain")
    def explain_case_endpoint(beneficiary_id: str, flag_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary = beneficiary_case(actor, beneficiary_id, "explain_case")
        result = ai_service.explain_case(repository, beneficiary_id, flag_id)
        result["centre_id"] = beneficiary["centre_id"]
        return result

    @application.get("/api/beneficiaries/{beneficiary_id}/history")
    def history_endpoint(beneficiary_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary = beneficiary_case(actor, beneficiary_id, "history_summary")
        result = ai_service.history_summary(repository, beneficiary_id)
        result["centre_id"] = beneficiary["centre_id"]
        return result

    @application.post("/api/verification")
    def verification_endpoint(body: VerificationRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary = beneficiary_case(actor, body.beneficiary_id, "verify_measurement")
        validate_safe_json(body.measurement)
        try:
            result = remeasure(repository, body.beneficiary_id, body.measurement, actor.actor_id, body.recorded_at, body.today or application.state.demo_date.isoformat())
        except (VerificationError, StoreError) as exc:
            raise HTTPException(status_code=400, detail={"code": "verification_failed", "message": str(exc), "retryable": False}) from exc
        record = result["measurement"]
        _audit(repository, actor, beneficiary["centre_id"], "measurement", record["measurement_id"], "remeasurement_saved", body.recorded_at,
               {"beneficiary_id": body.beneficiary_id, "parent_measurement_id": record["parent_measurement_id"], "flag_id": result["flag"]["flag_id"]})
        return {**result, "history_link": f"/api/beneficiaries/{body.beneficiary_id}/history", "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/tasks")
    def create_task_endpoint(body: CreateTaskRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        try:
            require_api_permission(actor, "create_task")
        except RolePermissionError:
            raise
        beneficiary, flag = flag_case(actor, body.flag_id, "create_task")
        active_existing = [t for t in repository.list_tasks(beneficiary_id=beneficiary["beneficiary_id"])
                           if t.get("flag_id") == body.flag_id and t.get("status") != "closed"]
        if active_existing:
            raise HTTPException(status_code=409, detail={"code": "active_task_exists", "message": "An active task already exists for this saved flag.", "retryable": False})
        measurement = repository.get_measurement(flag["measurement_id"])
        if measurement is None:
            raise HTTPException(status_code=409, detail={"code": "source_missing", "message": "The saved measurement linked to this flag is unavailable.", "retryable": False})
        source_row = dict(beneficiary.get("source_row", {}))
        source_row.update({"child_id": beneficiary["beneficiary_id"], "assigned_worker_id": beneficiary.get("assigned_worker_id", "")})
        try:
            task = tasks.create_task(source_row, measurement.get("evaluation", {}), created_on=body.created_on or application.state.demo_date)
        except tasks.TaskActionError:
            raise
        if task is None:
            raise HTTPException(status_code=409, detail={"code": "no_action_task", "message": "The saved rule result is GREEN; no task was created.", "retryable": False})
        task.update({"beneficiary_id": beneficiary["beneficiary_id"], "centre_id": beneficiary["centre_id"], "flag_id": body.flag_id,
                     "case_type": flag.get("case_type", "default")})
        repository.save_task(task)
        _audit(repository, actor, beneficiary["centre_id"], "task", task["task_id"], "task_created", body.created_on or application.state.demo_date,
               {"beneficiary_id": beneficiary["beneficiary_id"], "flag_id": body.flag_id, "initial_status": task["status"]})
        return {"task": task, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/tasks")
    def list_tasks_endpoint(centre_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_tasks")
        require_centre_scope(actor, centre_id)
        records = repository.list_tasks(centre_id=centre_id)
        if actor.role == "worker":
            records = [t for t in records if t.get("owner_id") == actor.assigned_worker_id
                       and (repository.get_beneficiary(t.get("beneficiary_id")) or {}).get("assigned_worker_id") == actor.assigned_worker_id]
        return {"centre_id": centre_id, "tasks": records, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/tasks/{task_id}/actions")
    def task_action_endpoint(task_id: str, body: TaskActionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        task = repository.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Task not found.", "retryable": False})
        beneficiary = beneficiary_case(actor, task["beneficiary_id"], "task_action")
        action = body.action.strip().lower()
        if action == "close":
            raise HTTPException(status_code=409, detail={"code": "two_key_confirmation_required", "message": "Single-key closure is disabled. Use the closure-confirmations route with an approved case-type policy.", "retryable": False})
        if action in {"assign", "reassign", "escalate"} and actor.role == "worker":
            raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Workers cannot assign, reassign, or escalate tasks.", "retryable": False})
        if actor.role == "worker" and task.get("owner_id") != actor.assigned_worker_id:
            raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Worker may only act on a task assigned to them.", "retryable": False})
        if action == "assign":
            validate_demo_owner(body.owner_id or "", beneficiary["centre_id"], "worker")
        elif action == "reassign":
            validate_demo_owner(body.owner_id or "", beneficiary["centre_id"], task.get("owner_role", "worker"))
        elif action == "escalate":
            next_level = int(task.get("escalation_level", 0)) + 1
            if next_level >= len(tasks.ESCALATION_LADDER):
                raise HTTPException(status_code=409, detail={"code": "no_escalation_target", "message": "No later escalation target is configured.", "retryable": False})
            expected_role = tasks.ESCALATION_LADDER[next_level]["role"]
            validate_demo_owner(body.owner_id or "", beneficiary["centre_id"], expected_role)
        try:
            updated = tasks.apply_task_action(
                task, action, actor.actor_id, body.on or application.state.demo_date,
                owner_id=body.owner_id, reason=safe_note(body.reason, "reason"), outcome=body.outcome,
                notes=safe_note(body.notes, "notes"),
                owner_role="worker",
            )
            repository.save_task(updated)
        except (tasks.TaskActionError, StoreError) as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_task_transition", "message": str(exc), "retryable": False}) from exc
        _audit(repository, actor, beneficiary["centre_id"], "task", task_id, action, body.on or application.state.demo_date,
               {"previous_status": task["status"], "status": updated["status"], "owner_id": updated.get("owner_id")})
        return {"task": updated, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/next-actions/{flag_id}")
    def next_action_endpoint(flag_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary, flag = flag_case(actor, flag_id, "suggest_action")
        result = ai_service.suggest_next_action(repository, beneficiary["beneficiary_id"], flag_id)
        result["centre_id"] = beneficiary["centre_id"]
        return result

    @application.post("/api/next-actions/{flag_id}/decision")
    def next_action_decision_endpoint(flag_id: str, body: NextActionDecisionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary, flag = flag_case(actor, flag_id, "decide_action")
        suggestion = ai_service.suggest_next_action(repository, beneficiary["beneficiary_id"], flag_id)
        suggestion["centre_id"] = beneficiary["centre_id"]
        if body.suggestion_id != suggestion["suggestion_id"]:
            raise HTTPException(status_code=409, detail={"code": "stale_suggestion", "message": "Workflow state changed after this suggestion was shown; fetch a fresh suggestion.", "retryable": True})
        decision_value = body.decision.strip().lower()
        decision_reason = safe_note(body.reason, "reason")
        if decision_value not in {"accept", "edit", "reject"}:
            raise HTTPException(status_code=400, detail={"code": "invalid_decision", "message": "decision must be accept, edit, or reject.", "retryable": False})
        if decision_value == "edit" and not safe_note(body.edited_action, "edited_action"):
            raise HTTPException(status_code=400, detail={"code": "invalid_decision", "message": "edited_action is required when decision is edit.", "retryable": False})
        if decision_value == "reject" and not decision_reason:
            raise HTTPException(status_code=400, detail={"code": "invalid_decision", "message": "reason is required when a suggestion is rejected.", "retryable": False})
        action_code = suggestion["action_code"]
        if decision_value == "edit":
            action_code = str(body.action_data.get("action_code", "")).strip().lower()
        dispatched_result = None
        if decision_value in {"accept", "edit"}:
            validate_safe_json(body.action_data)
            if action_code == "create_task":
                dispatched_result = create_task_endpoint(CreateTaskRequest(flag_id=flag_id, created_on=body.on), x_demo_actor)
            elif action_code == "verify_measurement":
                measurement = body.action_data.get("measurement")
                if not isinstance(measurement, dict):
                    raise HTTPException(status_code=422, detail={"code": "action_data_required", "message": "Accepting verification requires action_data.measurement.", "retryable": False})
                dispatched_result = verification_endpoint(VerificationRequest(
                    beneficiary_id=beneficiary["beneficiary_id"], measurement=measurement,
                    recorded_at=body.action_data.get("recorded_at", body.on or application.state.demo_date.isoformat()),
                    today=body.action_data.get("today", body.on or application.state.demo_date.isoformat()),
                ), x_demo_actor)
            elif action_code in {"assign", "acknowledge", "start", "record_progress"}:
                task_ids = suggestion.get("based_on", {}).get("active_task_ids", [])
                if not task_ids:
                    raise HTTPException(status_code=409, detail={"code": "task_required", "message": "No active task is available for this suggestion.", "retryable": False})
                action_payload = dict(body.action_data)
                action_payload.pop("action_code", None)
                action_payload["action"] = action_code
                action_payload.setdefault("on", body.on or application.state.demo_date.isoformat())
                dispatched_result = task_action_endpoint(task_ids[0], TaskActionRequest(**action_payload), x_demo_actor)
            else:
                raise HTTPException(status_code=422, detail={"code": "unsupported_suggested_action", "message": "This suggestion cannot be dispatched through an approved workflow action.", "retryable": False})
        try:
            decision = ai_service.record_next_action_decision(
                repository, suggestion, actor.actor_id, body.decision, body.on or application.state.demo_date,
                edited_action=safe_note(body.edited_action, "edited_action"), reason=decision_reason,
                action_code_override=action_code,
            )
        except ai_service.AIServiceError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_decision", "message": str(exc), "retryable": False}) from exc
        _audit(repository, actor, beneficiary["centre_id"], "next_action_decision", decision["decision_id"], "decision_recorded", decision["created_at"],
               {"flag_id": flag_id, "decision": decision["decision"], "action_code": decision["action_code"]})
        return {"decision": decision, "suggestion": suggestion, "dispatched_result": dispatched_result,
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/briefing")
    def briefing_endpoint(centre_id: str, as_of: str | None = None, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_briefing")
        require_centre_scope(actor, centre_id)
        as_of = as_of or application.state.demo_date.isoformat()
        try:
            return ai_service.daily_briefing(repository, centre_id, as_of)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_date", "message": str(exc), "retryable": False}) from exc

    @application.post("/api/referrals")
    def create_referral_endpoint(body: FollowupReferralRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary = beneficiary_case(actor, body.beneficiary_id, "create_referral")
        if body.task_id:
            task = repository.get_task(body.task_id)
            if task is None or task.get("beneficiary_id") != body.beneficiary_id or task.get("centre_id") != beneficiary["centre_id"]:
                raise HTTPException(status_code=404, detail={"code": "task_not_found", "message": "Task does not belong to this beneficiary and centre.", "retryable": False})
        destination = safe_note(body.destination, "destination")
        record = referrals.create_followup_referral(
            body.beneficiary_id, beneficiary["centre_id"], body.referral_kind,
            destination, body.reason_code, actor.actor_id,
            body.on or application.state.demo_date, body.due_on, body.task_id,
        )
        repository.save_referral(record)
        _audit(repository, actor, beneficiary["centre_id"], "referral", record["referral_id"], "referral_sent", record["created_at"],
               {"beneficiary_id": body.beneficiary_id, "kind": record["referral_kind"], "reason_code": record["reason_code"], "task_id": body.task_id})
        return {"referral": record, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/referrals")
    def list_referrals_endpoint(centre_id: str, as_of: str | None = None, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_referrals")
        require_centre_scope(actor, centre_id)
        as_of = as_of or application.state.demo_date.isoformat()
        try:
            records = repository.list_referrals(centre_id=centre_id)
            if actor.role == "worker":
                records = [r for r in records if (repository.get_beneficiary(r.get("beneficiary_id")) or {}).get("assigned_worker_id") == actor.assigned_worker_id]
            for record in records:
                record["overdue"] = referrals.followup_is_overdue(record, as_of)
            return {"centre_id": centre_id, "as_of": parse_date(as_of).isoformat(), "referrals": records,
                    "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_date", "message": str(exc), "retryable": False}) from exc

    @application.get("/api/referrals/{referral_id}")
    def get_referral_endpoint(referral_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        record = repository.get_referral(referral_id)
        if record is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Referral not found.", "retryable": False})
        beneficiary_case(actor, record["beneficiary_id"], "view_referrals")
        return {"referral": record, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/referrals/{referral_id}/actions")
    def referral_action_endpoint(referral_id: str, body: FollowupReferralActionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        record = repository.get_referral(referral_id)
        if record is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Referral not found.", "retryable": False})
        beneficiary = beneficiary_case(actor, record["beneficiary_id"], "update_referral")
        updated = referrals.update_followup_referral(record, actor.actor_id, body.action, body.on or application.state.demo_date, body.outcome_code)
        repository.save_referral(updated)
        _audit(repository, actor, beneficiary["centre_id"], "referral", referral_id, body.action, body.on or application.state.demo_date,
               {"previous_status": record["status"], "status": updated["status"], "outcome_code": updated.get("outcome_code")})
        return {"referral": updated, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/access-exceptions")
    def create_access_exception_endpoint(body: AccessExceptionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        beneficiary = beneficiary_case(actor, body.beneficiary_id, "create_exception")
        if body.task_id:
            task = repository.get_task(body.task_id)
            if (task is None or task.get("beneficiary_id") != body.beneficiary_id
                    or task.get("centre_id") != beneficiary["centre_id"]):
                raise HTTPException(status_code=404, detail={"code": "task_not_found", "message": "Task does not belong to this beneficiary and centre.", "retryable": False})
        record = access_exceptions.create_exception(
            body.beneficiary_id, beneficiary["centre_id"], body.exception_type,
            actor.actor_id, body.on or application.state.demo_date, body.task_id,
        )
        repository.save_exception(record)
        _audit(repository, actor, beneficiary["centre_id"], "access_exception", record["exception_id"], "exception_opened", record["opened_at"],
               {"beneficiary_id": body.beneficiary_id, "exception_type": record["exception_type"], "task_id": body.task_id})
        return {"exception": record, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/access-exceptions")
    def list_access_exceptions_endpoint(centre_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_exceptions")
        require_centre_scope(actor, centre_id)
        records = repository.list_exceptions(centre_id=centre_id)
        if actor.role == "worker":
            records = [r for r in records if (repository.get_beneficiary(r.get("beneficiary_id")) or {}).get("assigned_worker_id") == actor.assigned_worker_id]
        return {"centre_id": centre_id, "exceptions": records,
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/access-exceptions/{exception_id}")
    def get_access_exception_endpoint(exception_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        record = repository.get_exception(exception_id)
        if record is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Access exception not found.", "retryable": False})
        beneficiary_case(actor, record["beneficiary_id"], "view_exceptions")
        return {"exception": record, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/access-exceptions/{exception_id}/resolve")
    def resolve_access_exception_endpoint(exception_id: str, body: AccessExceptionResolutionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        record = repository.get_exception(exception_id)
        if record is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Access exception not found.", "retryable": False})
        beneficiary = beneficiary_case(actor, record["beneficiary_id"], "resolve_exception")
        updated = access_exceptions.resolve_exception(record, actor.actor_id, body.resolution_code, body.on or application.state.demo_date)
        repository.save_exception(updated)
        _audit(repository, actor, beneficiary["centre_id"], "access_exception", exception_id, "exception_resolved", updated["resolved_at"],
               {"resolution_code": updated["resolution_code"]})
        return {"exception": updated, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/tasks/{task_id}/closure-confirmations")
    def closure_confirmation_endpoint(task_id: str, body: ClosureConfirmationRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        task = repository.get_task(task_id)
        if task is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Task not found.", "retryable": False})
        beneficiary = beneficiary_case(actor, task["beneficiary_id"], "closure_confirm")
        policy = closure.policy_for(application.state.closure_policies, task.get("case_type", "default"))
        if policy is None:
            raise HTTPException(status_code=409, detail={"code": "closure_policy_not_approved", "message": "No approved closure policy is configured for this case type; closure fails closed.", "retryable": False})
        if task.get("status") != "in_progress":
            raise HTTPException(status_code=409, detail={"code": "task_not_in_progress", "message": "Only an in-progress task can enter two-key closure review.", "retryable": False})
        required_step = next((item for item in policy["confirmations"] if item["key"] == body.confirmation_key), None)
        if required_step and required_step["role"] == "worker" and task.get("owner_id") != actor.assigned_worker_id:
            raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "Only the currently assigned worker can provide the worker completion key.", "retryable": False})
        note = safe_note(body.notes, "notes")
        current = repository.list_closure_confirmations(task_id)
        current_readiness = closure.closure_readiness(current, policy)
        remaining_keys = [item["key"] for item in policy["confirmations"]
                          if not any(c.get("confirmation_key") == item["key"] for c in current)]
        if (body.confirmation_key in remaining_keys and len(remaining_keys) == 1
                and not current_readiness.get("outcome") and not body.outcome):
            raise HTTPException(status_code=422, detail={"code": "outcome_required", "message": "The final required confirmation must include a valid task outcome.", "retryable": False})
        updated = closure.record_confirmation(
            current, policy, body.confirmation_key, actor.actor_id, actor.role,
            body.on or application.state.demo_date, body.outcome, note,
        )
        confirmation = {**updated[-1], "task_id": task_id, "centre_id": beneficiary["centre_id"]}
        repository.append_closure_confirmation(confirmation)
        _audit(repository, actor, beneficiary["centre_id"], "task_closure", task_id, "closure_confirmation_recorded", confirmation["at"],
               {"confirmation_key": confirmation["confirmation_key"], "policy_version": confirmation["policy_version"]})
        readiness = closure.closure_readiness(updated, policy)
        if readiness["ready"]:
            outcome_record = next(item for item in updated if item.get("outcome"))
            closed_task = tasks.apply_task_action(
                task, "close", actor.actor_id, body.on or application.state.demo_date,
                outcome=readiness["outcome"], notes=outcome_record.get("notes", ""),
                closure_verified=True,
            )
            repository.save_task(closed_task)
            _audit(repository, actor, beneficiary["centre_id"], "task", task_id, "task_closed_two_key", body.on or application.state.demo_date,
                   {"outcome": readiness["outcome"], "confirmation_ids": [item["confirmation_id"] for item in updated], "policy_version": policy["policy_version"]})
            return {"closed": True, "readiness": readiness, "task": closed_task,
                    "confirmations": updated, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}
        return {"closed": False, "readiness": readiness, "confirmations": updated,
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/maternal-followups")
    def create_maternal_followup_endpoint(body: MaternalFollowupRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        if not maternal_enabled:
            raise HTTPException(status_code=409, detail={"code": "maternal_scope_disabled", "message": "Maternal follow-up remains disabled until scope, roles, and safety boundaries are approved.", "retryable": False})
        beneficiary = beneficiary_case(actor, body.beneficiary_id, "create_maternal")
        result = maternal.create_followup(
            body.beneficiary_id, beneficiary["centre_id"], body.age_years,
            body.followup_type, body.due_on, actor.actor_id,
            maternal_enabled, maternal_allowed_roles, actor.role,
        )
        if result["deferred"]:
            _audit(repository, actor, beneficiary["centre_id"], "maternal_followup", body.beneficiary_id, "maternal_followup_deferred_under_18", body.due_on,
                   {"reason_code": result["reason_code"]})
            return JSONResponse(status_code=202, content=result)
        record = result["record"]
        repository.save_maternal_followup(record)
        _audit(repository, actor, beneficiary["centre_id"], "maternal_followup", record["followup_id"], "maternal_followup_created", record["created_at"],
               {"beneficiary_id": body.beneficiary_id, "followup_type": record["followup_type"]})
        return {"followup": record, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION — RESTRICTED"}

    @application.get("/api/maternal-followups")
    def list_maternal_followups_endpoint(centre_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        if not maternal_enabled:
            raise HTTPException(status_code=409, detail={"code": "maternal_scope_disabled", "message": "Maternal follow-up remains disabled until scope, roles, and safety boundaries are approved.", "retryable": False})
        require_api_permission(actor, "view_maternal")
        if actor.role not in maternal_allowed_roles:
            raise RolePermissionError("Role is outside the restricted maternal-follow-up allow-list.")
        require_centre_scope(actor, centre_id)
        return {"centre_id": centre_id, "followups": repository.list_maternal_followups(centre_id=centre_id),
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION — RESTRICTED"}

    @application.post("/api/maternal-followups/{followup_id}/actions")
    def maternal_followup_action_endpoint(followup_id: str, body: MaternalFollowupActionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        if not maternal_enabled:
            raise HTTPException(status_code=409, detail={"code": "maternal_scope_disabled", "message": "Maternal follow-up remains disabled until scope, roles, and safety boundaries are approved.", "retryable": False})
        if actor.role not in maternal_allowed_roles:
            raise RolePermissionError("Role is outside the restricted maternal-follow-up allow-list.")
        record = repository.get_maternal_followup(followup_id)
        if record is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Maternal follow-up not found.", "retryable": False})
        beneficiary = beneficiary_case(actor, record["beneficiary_id"], "update_maternal")
        updated = maternal.update_followup(record, actor.actor_id, body.status, body.on or application.state.demo_date, body.outcome_code)
        repository.save_maternal_followup(updated)
        _audit(repository, actor, beneficiary["centre_id"], "maternal_followup", followup_id, "maternal_followup_updated", updated["updated_at"],
               {"status": updated["status"], "outcome_code": updated.get("outcome_code")})
        return {"followup": updated, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION — RESTRICTED"}

    @application.post("/api/briefing/snapshots")
    def create_briefing_snapshot_endpoint(body: BriefingSnapshotRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "create_snapshot")
        require_centre_scope(actor, body.centre_id)
        try:
            snapshot = summary.build_centre_summary(repository, body.centre_id, body.as_of or application.state.demo_date)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_summary_date", "message": str(exc), "retryable": False}) from exc
        repository.add_briefing_snapshot(snapshot)
        _audit(repository, actor, body.centre_id, "briefing_snapshot", snapshot["snapshot_id"], "briefing_snapshot_created", snapshot["as_of"],
               {"as_of": snapshot["as_of"], "counts_source": "deterministic backend records"})
        return {"snapshot": snapshot, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/briefing/snapshots")
    def list_briefing_snapshots_endpoint(centre_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_snapshots")
        require_centre_scope(actor, centre_id)
        return {"centre_id": centre_id, "snapshots": repository.list_briefing_snapshots(centre_id),
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/briefing/snapshots/{snapshot_id}")
    def get_briefing_snapshot_endpoint(snapshot_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_snapshots")
        snapshot = repository.get_briefing_snapshot(snapshot_id)
        if snapshot is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Snapshot not found.", "retryable": False})
        require_centre_scope(actor, snapshot["centre_id"])
        return {"snapshot": snapshot, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.post("/api/offline/queue")
    def enqueue_offline_endpoint(body: OfflineQueueRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "offline_enqueue")
        validate_safe_json(body.payload)
        beneficiary = _entity_beneficiary(body.entity_type, body.entity_id, actor, "offline_enqueue")
        operation = sync.enqueue_operation(
            _queue_path(actor), body.entity_type, body.entity_id, body.payload,
            body.base_version, body.created_at, operation_id=body.operation_id,
        )
        audit_action = "offline_operation_queued" if operation.get("sync_status") == "pending" else "offline_operation_duplicate"
        _audit(repository, actor, beneficiary["centre_id"], "offline_operation", operation["operation_id"], audit_action, body.created_at,
               {"entity_type": body.entity_type, "entity_id": body.entity_id, "base_version": body.base_version,
                "queue_status": operation.get("sync_status")})
        return {"operation": operation, "queue_status": operation.get("sync_status"), "label": "SYNTHETIC DATA / LOCAL QUEUE ONLY"}

    @application.get("/api/offline/queue")
    def list_offline_queue_endpoint(status: str | None = None, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_offline_queue")
        operations = sync.load_operations(_queue_path(actor), status)
        visible = []
        for operation in operations:
            _entity_beneficiary(operation["entity_type"], operation["entity_id"], actor, "view_offline_queue")
            visible.append(operation)
        return {"operations": visible, "remote_sync_enabled": False,
                "label": "SYNTHETIC DATA / LOCAL QUEUE ONLY"}

    @application.post("/api/offline/sync/attempt")
    def offline_sync_attempt_endpoint(body: OfflineSyncAttemptRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "offline_sync")
        validate_safe_json(body.server_state)
        queue_file = _queue_path(actor)
        operations = sync.load_operations(queue_file, "pending")
        scoped_cases = {item["operation_id"]: _entity_beneficiary(item["entity_type"], item["entity_id"], actor, "offline_sync") for item in operations}
        if body.simulate_failure:
            result = {"server_state": body.server_state, "applied_operation_ids": body.applied_operation_ids,
                      "results": [{"operation_id": item["operation_id"], "entity_id": item["entity_id"],
                                   "status": "failed", "message": "Synthetic sync failure; operation remains available for retry."} for item in operations]}
        else:
            result = sync.reconcile_operations(operations, body.server_state, body.applied_operation_ids)
        sync.apply_sync_results(queue_file, result["results"])
        for item in operations:
            record_case = scoped_cases[item["operation_id"]]
            outcome = next((r for r in result["results"] if r.get("operation_id") == item["operation_id"]), {"status": "unknown"})
            _audit(repository, actor, record_case["centre_id"], "offline_operation", item["operation_id"], "offline_sync_result", item["created_at"],
                   {"entity_type": item["entity_type"], "status": outcome.get("status"), "resolution": "none"})
        return {**result, "remote_sync_enabled": False,
                "note": "This is an in-memory synthetic reconciliation demonstration, not a remote server sync.",
                "label": "SYNTHETIC DATA / LOCAL QUEUE ONLY"}

    @application.post("/api/offline/queue/{operation_id}/retry")
    def retry_offline_operation_endpoint(operation_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "offline_enqueue")
        queue_file = _queue_path(actor)
        operation_before = next((item for item in sync.load_operations(queue_file) if item.get("operation_id") == operation_id), None)
        if operation_before is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Offline operation not found.", "retryable": False})
        beneficiary = _entity_beneficiary(operation_before["entity_type"], operation_before["entity_id"], actor, "offline_enqueue")
        operation = sync.retry_failed_operation(queue_file, operation_id)
        _audit(repository, actor, beneficiary["centre_id"], "offline_operation", operation_id, "offline_retry_requested", application.state.demo_date,
               {"retry_count": operation.get("retry_count", 0)})
        return {"operation": operation, "label": "SYNTHETIC DATA / LOCAL QUEUE ONLY"}

    @application.post("/api/offline/queue/{operation_id}/resolve-conflict")
    def resolve_offline_conflict_endpoint(operation_id: str, body: OfflineConflictResolutionRequest, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "offline_enqueue")
        queue_file = _queue_path(actor)
        operation_before = next((item for item in sync.load_operations(queue_file) if item.get("operation_id") == operation_id), None)
        if operation_before is None:
            raise HTTPException(status_code=404, detail={"code": "not_found", "message": "Offline operation not found.", "retryable": False})
        beneficiary = _entity_beneficiary(operation_before["entity_type"], operation_before["entity_id"], actor, "offline_enqueue")
        operation = sync.resolve_conflict(queue_file, operation_id, body.resolution, body.latest_version)
        _audit(repository, actor, beneficiary["centre_id"], "offline_operation", operation_id, "offline_conflict_resolved", application.state.demo_date,
               {"resolution": body.resolution, "new_status": operation["sync_status"], "base_version": operation.get("base_version")})
        return {"operation": operation, "label": "SYNTHETIC DATA / LOCAL QUEUE ONLY"}

    return application


app = create_app()
