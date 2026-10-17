HANDOFF FROM MEMBER 3 - ALL DATA IS SYNTHETIC. NO REAL CHILDREN.

FILES

- children.csv     1,000 fake children: child_id, sex, age_months, assigned_worker_id

- measurements.csv 5,737 generated under-five readings: child_id, age_months,
                   measurement_date, weight_kg, height_cm (some planted errors; blank = missing)
                   Included measurement ages are 0-59 months; follow-up stops at age 60.

- alert_list.csv   flagged children (urgent / watch), worst first, with weight_gain,
                   weight_loss, comparison_days and assigned worker

- tasks.csv        one row per flagged child: flag_date, action_date, acted_by,
                   task_status, referral_status, days_to_action

THRESHOLDS (PROPOSED STARTER VALUES, not verified clinical guidance)
- watch:  weight change of 0 or less between a reading and its second preceding valid reading

- urgent: weight loss of 1 kg or more between a reading and its second preceding valid reading

- alert_list.csv includes comparison_days for the actual interval; it can vary when

  readings are missing or invalid. gain_2m is retained internally as a legacy field name.

TASKS (PLACEHOLDER ASSUMPTIONS)

- Escalation ladder: worker (day 0), supervisor (day 2), ANM/block officer (day 5),
  district officer (day 10). Timings and response chances are placeholders to be
  replaced after field interviews.

- Blank action_date / days_to_action means nobody acted within 30 days.

- task_status: open / acknowledged / escalated / closed

- referral_status: not_needed / none / issued / outcome_logged

Label everything as SYNTHETIC and every integration as PROPOSED in screens and video.
