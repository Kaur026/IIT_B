"""Small shared I/O helpers. CSV in/out, no third-party dependencies."""
import csv
import hashlib
import json
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent
DATA = BASE / "data"
KEY = BASE / "answer_key"      # kept apart from data; only evaluation.py reads it
REPORTS = BASE / "reports"
FIXTURES = BASE / "fixtures"
CONFIG = BASE / "rule_config.json"


def write_csv(path, fields, rows):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in fields})


def read_csv(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [{k: (v if v != "" else None) for k, v in row.items()} for row in csv.DictReader(f)]


def load_dataset(name, folder=DATA):
    return read_csv(Path(folder) / f"{name}.csv")


def load_all(folder=DATA):
    from .schemas import DATASETS
    return {n: load_dataset(n, folder) for n in DATASETS}


def load_config(path=CONFIG):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def to_float(x):
    try:
        return None if x is None or x == "" else float(x)
    except (TypeError, ValueError):
        return None


def to_date(x):
    try:
        return None if x is None or x == "" else date.fromisoformat(str(x))
    except ValueError:
        return None


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()
