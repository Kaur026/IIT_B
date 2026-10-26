# Validator report

_SYNTHETIC DATA / PROPOSED INTEGRATION_  
Reporting date: 2026-10-24 · rule config 1.0.0

**Structural issues: 0**

| Dataset | Rows | Columns with empty cells |
|---|---|---|
| centres | 122 | - |
| workers | 122 | - |
| beneficiaries | 3025 | guardian_name, possible_duplicate_of |
| measurements | 9715 | weight_value, height_value, supersedes_id |
| verification_records | 773 | resolved_on, resolution_note |
| referrals | 85 | acknowledged_on, attended_on, outcome_on, outcome_note |
| maternal_profiles | 600 | - |
| service_records | 4518 | - |
| home_visits | 1200 | - |
| review_history | 246 | reviewed_on, decision |
| tasks_seed | 152 | closed_on, outcome |
| age_bands_reference | 3 | - |

Planted data-quality errors (missing values, unit mismatches, etc.) are expected and are not structural issues; the rules engine finds them.
