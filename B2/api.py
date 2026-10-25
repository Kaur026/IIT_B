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
from datetime import date
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from B2 import ai_service, tasks
from B2.demo_clock import DEFAULT_DEMO_DATE, parse_date
from B2.roles import (
    DEMO_ACTORS,
    RolePermissionError,
    Principal,
    require_api_permission,
    require_case_scope,
    require_centre_scope,
    resolve_demo_actor,
)
from B2.store import PrototypeStore, StoreError
from B2.verification import (
    VerificationError,
    build_flag_snapshot,
    remeasure,
)

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
    decision: str = Field(min_length=1)
    edited_action: str | None = None
    reason: str | None = None
    on: str | None = None


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


def create_app(store=None, seed_demo=True):
    database_path = os.environ.get("B2_DB_PATH", str(ROOT / "B2" / ".prototype.sqlite"))
    repository = store or PrototypeStore(database_path)
    if store is None:
        atexit.register(repository.close)
    if seed_demo:
        _seed_synthetic_fixture(repository)

    application = FastAPI(
        title="BE2 Day 1 API — synthetic prototype",
        version="0.1.0-proposed",
        description="Proposed, mock-first API. Not approved for real beneficiary data or production use.",
    )
    application.state.store = repository
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

    for error_type in (StoreError, VerificationError, ai_service.AIServiceError, tasks.TaskActionError):
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

    @application.get("/api/health")
    def health():
        return {"status": "ok", "mode": "synthetic_prototype", "seeded": repository.get_beneficiary("C0001") is not None,
                "label": "SYNTHETIC DATA / PROPOSED INTEGRATION", "production_auth": False}

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
        try:
            result = remeasure(repository, body.beneficiary_id, body.measurement, actor.actor_id, body.recorded_at, body.today or body.recorded_at)
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
            task = tasks.create_task(source_row, measurement.get("evaluation", {}), created_on=body.created_on or DEFAULT_DEMO_DATE)
        except tasks.TaskActionError:
            raise
        if task is None:
            raise HTTPException(status_code=409, detail={"code": "no_action_task", "message": "The saved rule result is GREEN; no task was created.", "retryable": False})
        task.update({"beneficiary_id": beneficiary["beneficiary_id"], "centre_id": beneficiary["centre_id"], "flag_id": body.flag_id})
        repository.save_task(task)
        _audit(repository, actor, beneficiary["centre_id"], "task", task["task_id"], "task_created", body.created_on or DEFAULT_DEMO_DATE,
               {"beneficiary_id": beneficiary["beneficiary_id"], "flag_id": body.flag_id, "initial_status": task["status"]})
        return {"task": task, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/tasks")
    def list_tasks_endpoint(centre_id: str, x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_tasks")
        require_centre_scope(actor, centre_id)
        records = repository.list_tasks(centre_id=centre_id)
        if actor.role == "worker":
            records = [t for t in records if t.get("owner_id") == actor.assigned_worker_id]
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
            raise HTTPException(status_code=409, detail={"code": "two_key_closure_not_implemented", "message": "Day 1 does not expose closure. Two-key closure checks require the approved Day 2 workflow.", "retryable": False})
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
                task, action, actor.actor_id, body.on or DEFAULT_DEMO_DATE,
                owner_id=body.owner_id, reason=body.reason, outcome=body.outcome, notes=body.notes,
                owner_role="worker",
            )
            repository.save_task(updated)
        except (tasks.TaskActionError, StoreError) as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_task_transition", "message": str(exc), "retryable": False}) from exc
        _audit(repository, actor, beneficiary["centre_id"], "task", task_id, action, body.on or DEFAULT_DEMO_DATE,
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
        try:
            decision = ai_service.record_next_action_decision(
                repository, suggestion, actor.actor_id, body.decision, body.on or DEFAULT_DEMO_DATE,
                edited_action=body.edited_action or "", reason=body.reason or "",
            )
        except ai_service.AIServiceError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_decision", "message": str(exc), "retryable": False}) from exc
        _audit(repository, actor, beneficiary["centre_id"], "next_action_decision", decision["decision_id"], "decision_recorded", decision["created_at"],
               {"flag_id": flag_id, "decision": decision["decision"], "action_code": decision["action_code"]})
        return {"decision": decision, "suggestion": suggestion, "label": "SYNTHETIC DATA / PROPOSED INTEGRATION"}

    @application.get("/api/briefing")
    def briefing_endpoint(centre_id: str, as_of: str = Query(DEFAULT_DEMO_DATE.isoformat()), x_demo_actor: str = Header(..., alias="X-Demo-Actor")):
        actor = principal(x_demo_actor)
        require_api_permission(actor, "view_briefing")
        require_centre_scope(actor, centre_id)
        try:
            return ai_service.daily_briefing(repository, centre_id, as_of)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail={"code": "invalid_date", "message": str(exc), "retryable": False}) from exc

    return application


app = create_app()
