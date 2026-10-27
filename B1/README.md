# B1: screening rules and data quality

B1 is a Python prototype for validating synthetic beneficiary records, evaluating child and mother rules, managing threshold changes, and joining linked family records. It does not run a server and is not connected to the frontend or B2 automatically. Data and thresholds are synthetic/proposed; rule values require qualified review before any operational use.

## Modules

- `data_checks.py`: checks missing/out-of-range/improbable values and returns issues; `recheck_child` applies supplied measurement values and reevaluates.
- `rules_engine.py`: `evaluate_child(row, today=None, rules=None)` and `evaluate_mother(row, rules=None)` return dictionaries containing `id`, `who`, `colour`, `reasons`, `confidence`, `confidence_note`, and `issues`. Child colours include `GREY` for untrusted measurements. `evaluate_children_df`, `evaluate_mothers_df`, and `colour_counts` support table-level use.
- `who_growth.py` and `who_lms.json`: local growth reference calculations; the engine does not fetch reference data online.
- `rule_settings.py`: local JSON draft/impact/approval/rejection/override/reset/history workflow. This is a prototype, not authenticated approval.
- `family_link.py`: joins `family_links.csv`, `children.csv`, and `mothers.csv`; produces family summaries and joint-visit task-shaped dictionaries when both members are RED/AMBER. It does not save tasks into B2.
- `build_data.py`: synthetic data generator. Avoid running unless you intend to regenerate/overwrite the CSV files.
- `test_be1.py`: standalone assertions. It copies files into a temporary directory before running, protecting checked-in data.

## Files and configuration

`children.csv`, `mothers.csv`, `family_links.csv`, and `test_children.csv` are synthetic fixtures. `thresholds.json` contains active values; `thresholds_default.json` is the reset baseline. `rule_settings_log.json` is local history data. `rule_drafts.json` is created when drafts are made.

- `THRESHOLDS_PATH`: override the active threshold JSON file.
- `BE1_DATA_DIR`: override the directory for CSV inputs and rule draft/log files.

Set these before importing modules that resolve paths. Rule settings write to the configured active threshold and data paths; use a disposable copy for manual experiments.

## Setup and checks (Windows PowerShell)

```powershell
cd B1
python -m pip install pandas
python .\test_be1.py
```

The test script reports assertion-by-assertion checks and exits with an assertion error on failure. No HTTP endpoints are provided. To use the engine from a Python caller, add the repository's `B1` directory to the import path and call its functions with a mapping-like row; the return dictionaries are the Python interface.

## Limitations

All bundled records are synthetic. Thresholds and some schedules have verification notes in `thresholds.json`; no clinical validation is implied. The settings audit is a local JSON log, and user/approver names are caller-supplied strings rather than authenticated identities. Family task output is not automatically handed to B2.
