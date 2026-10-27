# BE1 evaluation report

_SYNTHETIC DATA / PROPOSED INTEGRATION_

> Synthetic-prototype findings only. These numbers describe how the rules behave on planted synthetic errors, not real-world accuracy.

Rule config 1.0.0 · reporting date 2026-10-24

## Flag quality

- Flags raised: 356 · planted errors: 340
- True positives 340 · missed 0 · false positives 16 (15 documented valid-but-unusual, 1 unexplained)
- Precision 0.9551 · recall 1.0

| Rule | Planted | Found | Missed | False pos. | Precision | Recall |
|---|---|---|---|---|---|---|
| DUPLICATE | 65 | 65 | 0 | 0 | 1.0 | 1.0 |
| FUTURE_DATE | 30 | 30 | 0 | 0 | 1.0 | 1.0 |
| GROWTH_TREND_DATA_CHECK | 25 | 25 | 0 | 1 | 0.9615 | 1.0 |
| IMPLAUSIBLE_VALUE | 40 | 40 | 0 | 0 | 1.0 | 1.0 |
| MISSING_FIELD | 60 | 60 | 0 | 0 | 1.0 | 1.0 |
| UNIT_MISMATCH | 60 | 60 | 0 | 0 | 1.0 | 1.0 |
| UNUSUAL_CHANGE | 60 | 60 | 0 | 15 | 0.8 | 1.0 |

## Review time

- Reviews completed 229 of 246 (pending 17)
- Mean 5.36 days · median 5 days · within 7 days: 0.821

## Follow-up completion

- Tasks due by reporting date: 136 · completion 0.4706
- Referral loop completion 0.2824 · overdue referrals 18
- Access exceptions open 484 of 773

## Audit completeness

- 4 of 152 tasks have an audit gap (completeness 0.9737); planted gaps found 4/4; unexpected gaps 0

## Centre ranking

- Seeded high-error centres found in the top 15 by flag rate: 12

## Fixture check

- Fixture flags match expected: True
