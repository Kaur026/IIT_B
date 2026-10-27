"""One command for BE1's pipeline: seed -> validate -> evaluate -> demo outputs.
Run:  python -m be1.run_all
"""
import json
from datetime import date

from . import seed_data, validators, evaluation
from .age_transition import reminder_list
from .dataio import DATA, REPORTS, load_all, load_config
from .error_rates import centre_flag_rates, review_trends


def main():
    summary, planted = seed_data.write_all()
    seed_data.write_fixture()
    print("seeded:", summary)
    vr = validators.validate()
    validators.write_report(vr)
    print("validator structural issues:", vr["structural_issue_count"], vr["issue_counts_by_check"])
    res, flags = evaluation.run_evaluation()
    (REPORTS / "evaluation_report.json").write_text(json.dumps(res, indent=1, default=str))
    (REPORTS / "evaluation_report.md").write_text(evaluation.to_markdown(res))
    cfg = load_config()
    rep = date.fromisoformat(cfg["reporting_date"])
    data = load_all(DATA)
    # artefacts the other three people read
    (REPORTS / "flags.json").write_text(json.dumps(flags, indent=1, default=str))
    (REPORTS / "centre_flag_rates.json").write_text(json.dumps(
        centre_flag_rates(data["measurements"], flags, rep), indent=1))
    (REPORTS / "review_trends.json").write_text(json.dumps(review_trends(data["review_history"], rep), indent=1))
    at = reminder_list(data["beneficiaries"], data["age_bands_reference"], cfg, demo_mode=True)
    (REPORTS / "age_transition_demo.json").write_text(json.dumps(at, indent=1))
    print("flags:", len(flags), "| age-transition demo items:", len(at["items"]))
    print(evaluation.to_markdown(res))


if __name__ == "__main__":
    main()
