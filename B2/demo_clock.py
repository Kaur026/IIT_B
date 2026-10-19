"""Deterministic demo clock shared by BE2 workflows.

The initial date matches the BE1 prototype's documented reference date. The
clock is deliberately in-memory and suitable only for the synthetic demo;
F9 persistence/sync is a separate implementation step.
"""

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Union


DEFAULT_DEMO_DATE = date(2026, 10, 15)
DateLike = Union[date, datetime, str]


class DemoClockError(ValueError):
    """Raised when a supplied demo date or time shift is invalid."""


def parse_date(value: DateLike) -> date:
    """Parse a date or ISO-8601 date string (YYYY-MM-DD)."""
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        raise DemoClockError("Date must be a date object or YYYY-MM-DD string.")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise DemoClockError("Date must use YYYY-MM-DD format.") from exc


@dataclass
class DemoClock:
    """Small manually advanced clock for predictable prototype scenarios."""

    today: date = DEFAULT_DEMO_DATE

    def __post_init__(self):
        self.today = parse_date(self.today)

    def advance(self, days: int = 1) -> date:
        """Advance the demo date by a non-negative whole number of days."""
        if isinstance(days, bool) or not isinstance(days, int) or days < 0:
            raise DemoClockError("days must be a non-negative integer.")
        self.today += timedelta(days=days)
        return self.today

    def set_date(self, value: DateLike) -> date:
        """Set the demo date explicitly, for a controlled demonstration."""
        self.today = parse_date(value)
        return self.today

    def reset(self) -> date:
        """Return to the shared BE1 reference date."""
        self.today = DEFAULT_DEMO_DATE
        return self.today

    def as_dict(self) -> dict:
        """JSON-friendly clock state for a frontend adapter."""
        return {
            "today": self.today.isoformat(),
            "label": "SYNTHETIC DEMO DATE",
            "is_prototype": True,
        }
