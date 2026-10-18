# who_growth.py - WHO z-scores (helper for BE1 files). SYNTHETIC prototype.
# Uses the WHO Child Growth Standards LMS tables saved in who_lms.json.
import json
import math
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(_HERE, "who_lms.json")) as _f:
    _T = json.load(_f)


def _lms(table, x):
    """Linear interpolation of (L, M, S) at x. Returns None if x is outside the table."""
    if x is None or x < table[0][0] or x > table[-1][0]:
        return None
    lo, hi = 0, len(table) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if table[mid][0] <= x:
            lo = mid
        else:
            hi = mid
    a, b = table[lo], table[hi]
    t = 0 if b[0] == a[0] else (x - a[0]) / (b[0] - a[0])
    return tuple(a[i] + t * (b[i] - a[i]) for i in (1, 2, 3))


def _value_at_z(z, L, M, S):
    return M * math.exp(S * z) if L == 0 else M * (1 + L * S * z) ** (1 / L)


def _zscore(x, L, M, S):
    z = math.log(x / M) / S if L == 0 else ((x / M) ** L - 1) / (L * S)
    # WHO rule: beyond +-3 SD, extend using the distance between 2 SD and 3 SD
    if z > 3:
        sd3 = _value_at_z(3, L, M, S)
        sd2 = _value_at_z(2, L, M, S)
        z = 3 + (x - sd3) / (sd3 - sd2)
    elif z < -3:
        sd3n = _value_at_z(-3, L, M, S)
        sd2n = _value_at_z(-2, L, M, S)
        z = -3 + (x - sd3n) / (sd2n - sd3n)
    return z


def weight_for_height_z(sex, age_months, weight_kg, height_cm):
    """WHO weight-for-length (under 24 months) or weight-for-height (24+). None if not computable."""
    table = _T["wfl"][sex] if age_months < 24 else _T["wfh"][sex]
    lms = _lms(table, height_cm)
    if lms is None or weight_kg is None or weight_kg <= 0:
        return None
    return _zscore(weight_kg, *lms)


def weight_for_age_z(sex, age_months, weight_kg):
    lms = _lms(_T["wfa"][sex], age_months)
    if lms is None or weight_kg is None or weight_kg <= 0:
        return None
    return _zscore(weight_kg, *lms)


def weight_for_height_value(sex, age_months, height_cm, z):
    """Weight (kg) that gives the wanted z-score at this height. Used to make synthetic data."""
    table = _T["wfl"][sex] if age_months < 24 else _T["wfh"][sex]
    lms = _lms(table, height_cm)
    return None if lms is None else _value_at_z(z, *lms)


def height_range(age_months):
    table = _T["wfl"]["M"] if age_months < 24 else _T["wfh"]["M"]
    return table[0][0], table[-1][0]
