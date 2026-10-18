# BE1 handoff - rules and data (SYNTHETIC DATA / PROPOSED INTEGRATION)

## Files (all BE1-owned)
| File | What it is |
|---|---|
| thresholds.json | 16 rules: value, source label, locked flag. The ONLY place numbers live. (thresholds_default.json = starting copy for Reset) |
| children.csv | 1,000 fake children. First 12 columns are the agreed list; 7 extra columns added for the screens (see below). Child A = `C0001` |
| mothers.csv | 598 fake mothers, agreed columns |
| family_links.csv | family_id, child_id, mother_id, household_id, assigned_worker_id (Child A's mother = `M0001`) |
| test_children.csv | 5 children: T0001 RED, T0002 AMBER, T0003 GREEN, T0004 RED, T0005 GREY |
| rules_engine.py | `evaluate_child(row)`, `evaluate_mother(row)` (F2) + `evaluate_children_df`, `evaluate_mothers_df`, `colour_counts` |
| data_checks.py | F3 trust check: `check_child`, `check_mother`, `check_children_df`, `trust_summary`, `recheck_child` |
| rule_settings.py | F1: `create_draft`, `preview_impact`, `request_approval`, `approve`, `reject`, `reset`, `override_with_reason`, `history` |
| family_link.py | F8: `get_family`, `joint_visit_task(s)`, `family_counts` |
| who_growth.py, who_lms.json | WHO z-score helper + tables (helper, BE1) |
| build_data.py, test_be1.py | Makes the data (fixed seed) / runs 33 checks |

## What evaluate_child / evaluate_mother return
`{id, who, colour, reasons[], confidence, confidence_note, issues[]}`
- colour: RED / AMBER / GREEN / **GREY** (GREY = reading not believable, show Recheck)
- reason: `{rule_id, text, flag, source, locked, value_seen, threshold}` - show `text` in 'Why flagged'
- confidence: HIGH / MEDIUM (something missing, e.g. MUAC) / LOW (reading not trusted)
- Optional `today` argument (BE2's demo clock): `evaluate_child(row, today)`. Default today = 2026-10-15.

## Extra child columns (added for the screens)
enrolled, enrolment_date, last_visit_date, referral_date, danger_sign (yes/no), weight_prev1_kg, weight_prev2_kg (weekly weights, enrolled children only).
Days overdue / owner / task status are worked out by BE2 from these + `assigned_worker_id`, `task_status`.

## Messages to send (one per handoff)
- **To BE2, FE1, FE2:** "BE1 done: thresholds.json, children.csv, mothers.csv, family_links.csv, rules_engine.py, data_checks.py, test_children.csv. Use evaluate_child(row)/evaluate_mother(row). Child A = C0001 (RED, joint visit with mother M0001, worker W07)."
- **To FE2 (Step 9):** "rule_settings.py and family_link.py ready - functions listed in README_BE1.md."

## Please verify (flagged verify=true in thresholds.json)
C7, C9 (schedule), M2 (11 / 12 g/dL cut-offs), M3, M5, M6. Data freezes after Step 11 - do not re-run build_data.py after that.
