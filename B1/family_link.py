# family_link.py - F8 family link and joint visit task (BE1). SYNTHETIC prototype.
# One family = one mother + her linked under-five child + the worker who visits them.
# Rule: if BOTH the child and the mother are AMBER or RED, make ONE joint visit task (not two).
import os
import pandas as pd

import rules_engine

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("BE1_DATA_DIR", HERE)
_RANK = {"RED": 3, "AMBER": 2, "GREY": 1, "GREEN": 0}
FLAGGED = ("RED", "AMBER")


def load_links(path=None):
    return pd.read_csv(path or os.path.join(DATA_DIR, "family_links.csv"))


def _tables():
    return (pd.read_csv(os.path.join(DATA_DIR, "children.csv")), pd.read_csv(os.path.join(DATA_DIR, "mothers.csv")))


def joint_visit_needed(child_eval, mother_eval):
    return child_eval["colour"] in FLAGGED and mother_eval["colour"] in FLAGGED


def get_family(child_id=None, mother_id=None, today=None, children=None, mothers=None, links=None):
    """Everything the Family tab needs for one family (give a child_id OR a mother_id).
    Returns None if there is no link."""
    links = load_links() if links is None else links
    if children is None or mothers is None:
        children, mothers = _tables()
    sel = links[links.child_id == child_id] if child_id else links[links.mother_id == mother_id]
    if sel.empty:
        return None
    link = sel.iloc[0]
    crow = children[children.child_id == link.child_id].iloc[0].to_dict()
    mrow = mothers[mothers.mother_id == link.mother_id].iloc[0].to_dict()
    ce, me = rules_engine.evaluate_child(crow, today), rules_engine.evaluate_mother(mrow)
    joint = joint_visit_needed(ce, me)
    worst = max((ce["colour"], me["colour"]), key=_RANK.get)
    return {
        "family_id": link.family_id, "household_id": link.household_id, "worker_id": link.assigned_worker_id,
        "child": {"row": crow, "evaluation": ce}, "mother": {"row": mrow, "evaluation": me},
        "worst_colour": worst, "joint_visit": joint,
        "message": ("Both mother and child need attention: ONE joint visit by " + link.assigned_worker_id + "."
                    if joint else "Only one of them is flagged: normal visit."
                    if (ce["colour"] in FLAGGED or me["colour"] in FLAGGED) else "Neither is flagged."),
    }


def joint_visit_task(family):
    """Task dictionary for BE2's task engine (same fields as a normal task + both sets of reasons)."""
    return {
        "task_type": "JOINT_VISIT", "family_id": family["family_id"],
        "child_id": family["child"]["row"]["child_id"], "mother_id": family["mother"]["row"]["mother_id"],
        "worker_id": family["worker_id"], "colour": family["worst_colour"],
        "title": "Joint home visit: mother and child",
        "child_reasons": family["child"]["evaluation"]["reasons"],
        "mother_reasons": family["mother"]["evaluation"]["reasons"],
    }


def joint_visit_tasks(today=None):
    """All joint visit tasks, RED first. Used by BE2 to create tasks and by FE2 for the Family tab."""
    children, mothers = _tables()
    links = load_links()
    ce = {r.child_id: rules_engine.evaluate_child(r._asdict(), today) for r in children.itertuples(index=False)}
    me = {r.mother_id: rules_engine.evaluate_mother(r._asdict()) for r in mothers.itertuples(index=False)}
    out = []
    for l in links.itertuples(index=False):
        c, m = ce.get(l.child_id), me.get(l.mother_id)
        if c and m and joint_visit_needed(c, m):
            cr = children[children.child_id == l.child_id].iloc[0].to_dict()
            mr = mothers[mothers.mother_id == l.mother_id].iloc[0].to_dict()
            fam = {"family_id": l.family_id, "worker_id": l.assigned_worker_id,
                   "child": {"row": cr, "evaluation": c}, "mother": {"row": mr, "evaluation": m},
                   "worst_colour": max((c["colour"], m["colour"]), key=_RANK.get)}
            out.append(joint_visit_task(fam))
    return sorted(out, key=lambda t: -_RANK[t["colour"]])


def family_counts(today=None):
    """Small summary for the overview: families, flagged families, joint visits."""
    tasks = joint_visit_tasks(today)
    return {"families": int(len(load_links())), "joint_visits": len(tasks),
            "joint_red": sum(t["colour"] == "RED" for t in tasks)}
