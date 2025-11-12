from typing import List, Dict, Any, Optional
import math
from datetime import datetime, timedelta
import zoneinfo  # stdlib tz support (3.9+)

DEFAULT_AVAIL_SCORES = {0: 0.0, 1: 0.5, 2: 1.0}


def _require_keys(obj: Dict[str, Any], keys: List[str], ctx: str):
    missing = [k for k in keys if k not in obj]
    if missing:
        raise ValueError(f"Missing required field(s) in {ctx}: {', '.join(missing)}")


def _prefix_sums(arr: List[float]) -> List[float]:
    ps = [0.0]
    s = 0.0
    for x in arr:
        s += x
        ps.append(s)
    return ps


def _window_sum(ps: List[float], start: int, length: int) -> float:
    return ps[start + length] - ps[start]


def _coerce_priorities(attendees: List[Dict[str, Any]], default: float = 1.0):
    """Ensure every attendee has a numeric priority; default to 1 if missing."""
    for att in attendees:
        att.setdefault("priority", default)


def _is_iso_date(s: str) -> bool:
    try:
        datetime.fromisoformat(s)  # YYYY-MM-DD
        return True
    except Exception:
        return False


def _compute_day_timeline(
    attendees: List[Dict[str, Any]],
    day_idx: int,
    avail_scores: Dict[int, float]
) -> List[float]:
    num_slots = len(attendees[0]["availability_matrix"][day_idx])
    timeline = [0.0] * num_slots
    for att in attendees:
        w = float(att["priority"])
        row = att["availability_matrix"][day_idx]
        for t, v in enumerate(row):
            timeline[t] += w * float(avail_scores.get(v, 0.0))
    return timeline


def _analyze_window(
    attendees: List[Dict[str, Any]],
    day_idx: int,
    start: int,
    length: int,
    top_priority: float,
    hard_block: bool,
    require_distinct_top: bool
) -> Dict[str, Any]:
    """Collect conflict/availability details and enforce optional hard-block logic."""
    conflicts = []
    unpreferred_cells = 0
    fully_available_attendees = 0
    total_full_avails = 0

    # Only hard-block when there is exactly one person at the true top priority (if enabled)
    distinct_top_ok = True
    if require_distinct_top:
        count_top = sum(1 for a in attendees if float(a["priority"]) == top_priority)
        distinct_top_ok = (count_top == 1)

    for att in attendees:
        row = att["availability_matrix"][day_idx][start:start + length]
        has_zero = any(v == 0 for v in row)
        c2 = sum(1 for v in row if v == 2)
        c1 = sum(1 for v in row if v == 1)
        total_full_avails += c2

        if has_zero and float(att["priority"]) == top_priority and hard_block and distinct_top_ok:
            return {"blocked": True}

        if has_zero:
            conflicts.append(att["name"])
        if c1 > 0:
            unpreferred_cells += c1
        if c1 == 0 and not has_zero:
            fully_available_attendees += 1

    return {
        "blocked": False,
        "conflicts": conflicts,
        "unpreferred_cells": unpreferred_cells,
        "fully_available_attendees": fully_available_attendees,
        "total_full_avails": total_full_avails,
    }


def _passes_global_blockers(
    day_label: str,
    start_idx: int,
    L: int,
    slot_minutes: int,
    day_start: str,
    tz: str,
    blockers: Dict[str, Any]
) -> bool:
    """
    Enforce optional global blockers:
      blockers = {
        "hours": {"start":"08:00","end":"20:00"},  # inclusive start, exclusive end
        "lunch": {"start":"12:00","end":"13:00"},  # disallow any overlap
        "weekdays_disallowed": [5,6],             # 0=Mon ... 6=Sun (only meaningful if day_label is ISO)
      }
    """
    # If day_label is not ISO, we can still enforce hours/lunch relative to the day_start clock.
    tzinfo = None
    if tz:
        try:
            tzinfo = zoneinfo.ZoneInfo(tz)
        except Exception:
            tzinfo = None

    # Anchor date: if ISO, use that date; else use an arbitrary reference day (1970-01-01).
    if _is_iso_date(day_label):
        base = datetime.fromisoformat(day_label)
    else:
        base = datetime(1970, 1, 1)  # purely for clock math

    if tzinfo:
        base = base.replace(tzinfo=tzinfo)

    dh, dm = map(int, day_start.split(":"))
    window_start = base.replace(hour=dh, minute=dm, second=0, microsecond=0) + timedelta(minutes=start_idx * slot_minutes)
    window_end = window_start + timedelta(minutes=L * slot_minutes)

    # weekday rule only if ISO date available
    if blockers.get("weekdays_disallowed") and _is_iso_date(day_label):
        if window_start.weekday() in blockers["weekdays_disallowed"]:
            return False

    # Hours window
    if blockers.get("hours"):
        hs = blockers["hours"].get("start", "00:00")
        he = blockers["hours"].get("end", "24:00")
        hs_h, hs_m = map(int, hs.split(":"))
        he_h, he_m = map(int, he.split(":"))
        day_open = window_start.replace(hour=hs_h, minute=hs_m)
        day_close = window_start.replace(hour=he_h, minute=he_m)
        if not (window_start >= day_open and window_end <= day_close):
            return False

    # Lunch blackout
    if blockers.get("lunch"):
        ls_h, ls_m = map(int, blockers["lunch"]["start"].split(":"))
        le_h, le_m = map(int, blockers["lunch"]["end"].split(":"))
        lunch_start = window_start.replace(hour=ls_h, minute=ls_m)
        lunch_end = window_start.replace(hour=le_h, minute=le_m)
        if not (window_end <= lunch_start or window_start >= lunch_end):
            return False

    return True


def _slot_to_iso(
    day_label: str,
    start_idx: int,
    L: int,
    slot_minutes: int,
    day_start: str,
    tz: str
) -> Dict[str, Optional[str]]:
    """
    Return start/end ISO strings if we have an ISO date; else return None for both.
    """
    if not _is_iso_date(day_label):
        return {"start_iso": None, "end_iso": None, "timezone": None}

    tzinfo = None
    if tz:
        try:
            tzinfo = zoneinfo.ZoneInfo(tz)
        except Exception:
            tzinfo = None

    base = datetime.fromisoformat(day_label)
    if tzinfo:
        base = base.replace(tzinfo=tzinfo)

    h, m = map(int, day_start.split(":"))
    start_dt = base.replace(hour=h, minute=m, second=0, microsecond=0) + timedelta(minutes=start_idx * slot_minutes)
    end_dt = start_dt + timedelta(minutes=L * slot_minutes)
    return {
        "start_iso": start_dt.isoformat(),
        "end_iso": end_dt.isoformat(),
        "timezone": tz if tzinfo else None
    }


def model(data: dict) -> dict:
    """
    Backend scheduler/heuristic.

    Required:
      - slot_minutes: int
      - meeting_length_minutes: int
      - attendees: [{ name, priority?, availability_matrix: List[List[int]] }]

    Optional:
      - days: List[str]           # if omitted, inferred as ["day-1", ..., "day-N"]
      - active_attendees: List[str]
      - schedule: { day_start: "09:00", timezone: "America/New_York" }
      - constraints: { global_blockers: { hours, lunch, weekdays_disallowed, min_attendees } }
      - weights: {
          avail_scores: {0|1|2 or "0"|"1"|"2": float},
          unpreferred_penalty_per_person: float,
          hard_block_for_high_priority: bool,
          distinct_top_priority_only: bool
        }
      - top_k: int
    """
    _require_keys(data, ["slot_minutes", "meeting_length_minutes", "attendees"], "root")

    slot_minutes = int(data["slot_minutes"])
    meeting_len_minutes = int(data["meeting_length_minutes"])
    attendees: List[Dict[str, Any]] = data["attendees"]

    if slot_minutes <= 0:
        raise ValueError("slot_minutes must be > 0")
    if meeting_len_minutes <= 0:
        raise ValueError("meeting_length_minutes must be > 0")
    if not isinstance(attendees, list) or not attendees:
        raise ValueError("attendees must be a non-empty list")

    # Optional: filter to active attendees
    active = set(data.get("active_attendees", []))
    if active:
        attendees = [a for a in attendees if a.get("name") in active]
        if not attendees:
            return {"suggestions": []}

    # Validate attendees
    for i, att in enumerate(attendees):
        _require_keys(att, ["name", "availability_matrix"], f"attendees[{i}]")
        if not isinstance(att["availability_matrix"], list) or not att["availability_matrix"]:
            raise ValueError(f"attendees[{i}].availability_matrix must be a non-empty list of days")

    # Derive/infer days
    if "days" in data and isinstance(data["days"], list) and data["days"]:
        days: List[str] = data["days"]
    else:
        # infer number of days from the first attendee
        dcount = len(attendees[0]["availability_matrix"])
        days = [f"day-{i+1}" for i in range(dcount)]

    # Ensure each attendee has the same number of day rows
    for i, att in enumerate(attendees):
        if len(att["availability_matrix"]) != len(days):
            raise ValueError(f"attendees[{i}].availability_matrix must have {len(days)} rows (one per day)")

    # Default priorities if omitted
    _coerce_priorities(attendees, default=1.0)

    # Consistent slot counts per day
    day_slot_counts = []
    for d in range(len(days)):
        slots_d = len(attendees[0]["availability_matrix"][d])
        for i, att in enumerate(attendees):
            if len(att["availability_matrix"][d]) != slots_d:
                raise ValueError(f"All attendees must have the same number of slots on day index {d}.")
        day_slot_counts.append(slots_d)

    # Round meeting length up to slots; never error after coercion
    L = math.ceil(meeting_len_minutes / slot_minutes)
    if L <= 0:
        L = 1

    # Config blocks
    schedule_cfg = data.get("schedule", {})
    day_start = schedule_cfg.get("day_start", "09:00")
    timezone = schedule_cfg.get("timezone", "America/New_York")

    constraints = data.get("constraints", {})
    blockers = constraints.get("global_blockers", {})

    weights = data.get("weights", {})
    avail_scores_cfg = weights.get("avail_scores")
    if isinstance(avail_scores_cfg, dict):
        avail_scores = {int(k): float(v) for k, v in avail_scores_cfg.items()}
    else:
        avail_scores = DEFAULT_AVAIL_SCORES

    hard_block = bool(weights.get("hard_block_for_high_priority", True))
    require_distinct_top = bool(weights.get("distinct_top_priority_only", True))  # default True per your task
    unpref_penalty = float(weights.get("unpreferred_penalty_per_person", 0.0))
    top_k = int(data.get("top_k", 5))

    top_priority = max(float(att["priority"]) for att in attendees)

    suggestions: List[Dict[str, Any]] = []

    for d_idx, day_label in enumerate(days):
        if day_slot_counts[d_idx] < L:
            continue

        timeline = _compute_day_timeline(attendees, d_idx, avail_scores)
        ps = _prefix_sums(timeline)

        for start in range(0, len(timeline) - L + 1):
            # Global blockers (time-window filters)
            if not _passes_global_blockers(day_label, start, L, slot_minutes, day_start, timezone, blockers):
                continue

            raw = float(_window_sum(ps, start, L))
            details = _analyze_window(
                attendees=attendees,
                day_idx=d_idx,
                start=start,
                length=L,
                top_priority=top_priority,
                hard_block=hard_block,
                require_distinct_top=require_distinct_top
            )
            if details.get("blocked"):
                continue

            # Optional min fully-available attendees
            min_att = blockers.get("min_attendees")
            if isinstance(min_att, int) and details["fully_available_attendees"] < min_att:
                continue

            score = raw - unpref_penalty * details["unpreferred_cells"]
            total_cells = len(attendees) * L if attendees else 1
            coverage = details["total_full_avails"] / total_cells if total_cells else 0.0

            iso = _slot_to_iso(day_label, start, L, slot_minutes, day_start, timezone)

            suggestions.append({
                "day": day_label,
                "start_slot_index": start,
                "slot_minutes": slot_minutes,
                "meeting_length_minutes": meeting_len_minutes,
                "score": round(score, 4),
                "coverage": round(coverage, 4),
                "conflicts": details["conflicts"],
                "fully_available_attendees": details["fully_available_attendees"],
                "start_iso": iso["start_iso"],
                "end_iso": iso["end_iso"],
                "timezone": iso["timezone"]
            })

    def sort_key(r):
        return (
            -r["score"],
            len(r["conflicts"]),
            -r["fully_available_attendees"],
            -r["coverage"],
            r["start_slot_index"],
        )

    suggestions.sort(key=sort_key)
    return {"suggestions": suggestions[:top_k]}
