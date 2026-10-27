# BE1: Rules and Data (Poshan Action Layer prototype)

SYNTHETIC DATA / PROPOSED INTEGRATION. Not connected to the government Poshan Tracker.

## Run
```
python -m be1.run_all          # seed -> validate -> evaluate -> demo outputs (reports/)
python -m be1.seed_data        # data + fixture only
python -m be1.validators       # validator report only
python -m be1.evaluation       # evaluation report only
python -m be1.evaluation --freeze   # Step 13 only: write data/FROZEN.json (sha256 of every CSV)
```
No third-party packages. Python 3.10+.

## Files (BE1 owns all of these)
| File | Purpose |
|---|---|
| schemas.py | Agreed field lists for the 12 datasets (Step 1 handoff) |
| rule_config.json | Versioned rules, each `approved` or `draft`; the reporting date; all thresholds |
| seed_data.py | Generator: 122 centres, 3,025 beneficiaries, 9,715 readings, planted errors; writes the 5-beneficiary fixture |
| dataio.py | CSV/JSON helpers and folder paths |
| validators.py | Structure, ID, date, enum and referential checks, plus a check that no Aadhaar-like numbers exist |
| rules_engine.py | Missing field, unit mismatch, future date, duplicate, implausible value |
| trend_checks.py | Unusual-change and growth-trend data checks (Feature 1) |
| age_transition.py | Due-date logic and reminders; disabled unless `demo_mode=True` (Feature 6) |
| error_rates.py | Centre flag rates and review trends, with denominators and sample sizes |
| evaluation.py | The only module that reads `answer_key/`; precision, missed errors, false positives by rule, review time, follow-up completion, audit completeness |

Folders: `data/` (12 CSVs), `answer_key/` (kept separate), `fixtures/fixture_5.json`, `reports/`.

## Handoff notes for BE2, FE1, FE2
- Flag shape: `flag_id, dataset, record_id, beneficiary_id, centre_id, rule_id, rule_version, rule_status, reason, source_values, needs_human_verification, is_diagnosis=false`. `flag_id` = `FLG-<record_id>-<rule_id>`.
- Thresholds live only in `rule_config.json`. Do not copy them into screens.
- A remeasurement is a new `measurements` row with `supersedes_id`; flags on the original carry `superseded_by`.
- Hard-flagged readings (missing, unit, future, implausible, duplicate) are left out of trend comparisons.
- `tasks_seed.audit_entries` expected counts: assigned 1, acknowledged 2, in_progress 3, closed 4.
- Seeded special cases: REF-9001..9005 (one per referral state; REF-9005 is overdue), TSK-9001/9002 (one flag, two tasks over time), 5 under-18 maternal profiles (`deferred_under_18`).

## Verified assumptions to confirm
- The "dataset blueprint" was not in the handover PDF, so the 12 dataset names and field lists in `schemas.py` are my proposal. Agree them in Step 0 and rename if the blueprint differs.
- Rules marked `approved` are approved for synthetic data-quality flagging only, pending supervisor sign-off. Age bands, SCM meaning, ration dates and the 40% disability threshold stay draft/disabled.

## Known limitations (reported honestly)
- UNUSUAL_CHANGE: 15 false positives are seeded valid catch-up gains; this is by design and shows the rule needs human verification.
- GROWTH_TREND_DATA_CHECK: 1 natural false positive (BEN-1127: weight rounded to 15.2 kg four times). Consider a tolerance if this recurs.
- Evaluation numbers are synthetic-prototype findings, not real-world accuracy.
