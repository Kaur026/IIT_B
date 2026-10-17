# schema.py - single source of truth for the synthetic dataset columns
# ALL DATA IS SYNTHETIC. No real children.

COLUMNS = {
    "child_id": "text, fake ID like C0001",
    "sex": "M or F",
    "age_months": "number, 0-59",
    "measurement_date": "date",
    "weight_kg": "number",
    "height_cm": "number",
    "measurement_valid": "True/False, set by validation rules",
    "nutrition_status": "normal / moderate / severe",
    "service_status": "e.g. ration received yes/no",
    "assigned_worker_id": "text, fake worker ID",
    "flag_date": "date the alert was raised",
    "action_date": "date first action was taken",
    "referral_status": "none / issued / attended / outcome_logged",
    "last_followup_date": "date",
    "task_status": "open / acknowledged / escalated / closed",
}

if __name__ == "__main__":
    print(f"{len(COLUMNS)} columns defined:")
    for name, meaning in COLUMNS.items():
        print(f"- {name}: {meaning}")