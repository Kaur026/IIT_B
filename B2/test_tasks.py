"""Unit tests for the BE2 F4 workflow and demo clock."""

import unittest
from datetime import date

from B2.demo_clock import DemoClock, DemoClockError
from B2.tasks import (
    OUTCOME_OPTIONS,
    TaskActionError,
    acknowledge_task,
    complete_task,
    create_task,
    escalate_task,
    get_escalation_due,
    list_due_escalations,
    reassign_task,
    task_is_overdue,
)


class DemoClockTests(unittest.TestCase):
    def test_default_date_matches_be1_reference(self):
        clock = DemoClock()
        self.assertEqual(clock.today, date(2026, 10, 15))
        self.assertEqual(clock.as_dict()["label"], "SYNTHETIC DEMO DATE")

    def test_advance_and_reset(self):
        clock = DemoClock()
        self.assertEqual(clock.advance(2), date(2026, 10, 17))
        self.assertEqual(clock.reset(), date(2026, 10, 15))

    def test_invalid_advance_is_rejected(self):
        with self.assertRaises(DemoClockError):
            DemoClock().advance(-1)
        with self.assertRaises(DemoClockError):
            DemoClock().advance(True)

    def test_bad_date_string_is_rejected(self):
        with self.assertRaises(DemoClockError):
            DemoClock("15/10/2026")


class TaskWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.child = {
            "child_id": "C0001",
            "assigned_worker_id": "W07",
            "task_status": "new",
        }
        self.red_eval = {
            "colour": "RED",
            "reasons": [{"rule_id": "C2", "text": "Synthetic test reason."}],
        }
        self.task = create_task(
            self.child,
            self.red_eval,
            created_on="2026-10-15",
            task_id="TASK-C0001-1",
        )

    def test_child_a_creates_open_urgent_task_for_assigned_worker(self):
        self.assertEqual(self.task["child_id"], "C0001")
        self.assertEqual(self.task["owner_id"], "W07")
        self.assertEqual(self.task["alert_level"], "urgent")
        self.assertEqual(self.task["status"], "open")
        self.assertEqual(self.task["due_on"], "2026-10-17")
        self.assertIn("PROPOSED", self.task["policy_label"])
        self.assertEqual(self.task["events"][0]["event"], "created")

    def test_green_case_creates_no_task(self):
        self.assertIsNone(create_task(self.child, {"colour": "GREEN"}, "2026-10-15"))

    def test_unknown_colour_rejected(self):
        with self.assertRaises(TaskActionError):
            create_task(self.child, {"colour": "PURPLE"}, "2026-10-15")

    def test_acknowledge_is_copy_on_write(self):
        changed = acknowledge_task(self.task, "W07", "2026-10-15")
        self.assertEqual(changed["status"], "acknowledged")
        self.assertEqual(self.task["status"], "open")
        self.assertEqual(changed["events"][-1]["event"], "acknowledged")

    def test_escalation_schedule_and_target_assignment(self):
        self.assertIsNone(get_escalation_due(self.task, "2026-10-16"))
        due = get_escalation_due(self.task, "2026-10-17")
        self.assertEqual(due["role"], "supervisor")
        self.assertEqual(due["days_overdue"], 0)

        changed = escalate_task(
            self.task,
            actor_id="W07",
            target_owner_id="SUP01",
            on="2026-10-17",
            reason="No acknowledgement by proposed day-two checkpoint.",
        )
        self.assertEqual(changed["status"], "escalated")
        self.assertEqual(changed["owner_id"], "SUP01")
        self.assertEqual(changed["owner_role"], "supervisor")
        self.assertEqual(changed["due_on"], "2026-10-20")
        self.assertEqual(self.task["escalation_level"], 0)

    def test_full_proposed_escalation_ladder_uses_demo_clock(self):
        task = self.task
        cases = [
            ("2026-10-17", "SUP01", "supervisor", "2026-10-20"),
            ("2026-10-20", "ANM01", "anm_block", "2026-10-25"),
            ("2026-10-25", "DIST01", "district", "2026-10-25"),
        ]
        for day, owner, role, expected_due in cases:
            task = escalate_task(task, "ACTOR", owner, day, "Synthetic demo escalation")
            self.assertEqual(task["owner_role"], role)
            self.assertEqual(task["owner_id"], owner)
            self.assertEqual(task["due_on"], expected_due)
        self.assertIsNone(get_escalation_due(task, "2026-11-01"))

    def test_escalation_requires_due_date_and_target(self):
        with self.assertRaises(TaskActionError):
            escalate_task(self.task, "W07", "SUP01", "2026-10-16", "test")
        with self.assertRaises(TaskActionError):
            escalate_task(self.task, "W07", "", "2026-10-17", "test")

    def test_reassignment_requires_reason_and_does_not_change_status(self):
        changed = reassign_task(self.task, "SUP01", "W08", "2026-10-16", "Worker unavailable")
        self.assertEqual(changed["owner_id"], "W08")
        self.assertEqual(changed["status"], "open")
        self.assertEqual(changed["events"][-1]["details"]["reason"], "Worker unavailable")
        with self.assertRaises(TaskActionError):
            reassign_task(self.task, "SUP01", "W08", "2026-10-16", " ")

    def test_close_requires_a_valid_outcome_and_other_requires_notes(self):
        self.assertIn("referred", OUTCOME_OPTIONS)
        with self.assertRaises(TaskActionError):
            complete_task(self.task, "W07", "unknown", "2026-10-16")
        with self.assertRaises(TaskActionError):
            complete_task(self.task, "W07", "other", "2026-10-16")

        closed = complete_task(
            self.task,
            "W07",
            "recheck_required",
            "2026-10-16",
            notes="Synthetic test outcome.",
        )
        self.assertEqual(closed["status"], "closed")
        self.assertEqual(closed["outcome"], "recheck_required")
        self.assertFalse(task_is_overdue(closed, "2026-10-20"))
        with self.assertRaises(TaskActionError):
            complete_task(closed, "W07", "reached", "2026-10-17")

    def test_due_list_and_overdue_use_demo_clock_date(self):
        self.assertFalse(task_is_overdue(self.task, "2026-10-16"))
        self.assertTrue(task_is_overdue(self.task, "2026-10-17"))
        due = list_due_escalations([self.task], "2026-10-17")
        self.assertEqual(due[0]["task_id"], "TASK-C0001-1")
        self.assertEqual(due[0]["role"], "supervisor")

    def test_closed_task_cannot_be_escalated_or_reassigned(self):
        closed = complete_task(self.task, "W07", "reached", "2026-10-16")
        self.assertIsNone(get_escalation_due(closed, "2026-10-20"))
        with self.assertRaises(TaskActionError):
            reassign_task(closed, "SUP01", "W08", "2026-10-17", "test")


if __name__ == "__main__":
    unittest.main()
