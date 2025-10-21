from typing import List, Dict, Any
import math

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

def _compute_day_timeline(attendees: List[Dict[str, Any]], day_idx: int, avail_scores: Dict[int, float]) -> List[float]:
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
) -> Dict[str, Any]:
    conflicts = []
    unpreferred_cells = 0
    fully_available_attendees = 0
    total_full_avails = 0

    for att in attendees:
        row = att["availability_matrix"][day_idx][start:start + length]
        has_zero = any(v == 0 for v in row)
        c2 = sum(1 for v in row if v == 2)
        c1 = sum(1 for v in row if v == 1)
        total_full_avails += c2

        if has_zero and float(att["priority"]) == top_priority and hard_block:
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

def model(data: dict) -> dict:
    """
    Input schema (example):
    {
      "slot_minutes": 30,
      "meeting_length_minutes": 60,
      "days": ["2025-10-20", "2025-10-21"],
      "attendees": [
        {
          "name": "Ethan",
          "priority": 2,
          "availability_matrix": [
            [2,2,1,0,2,2,1],
            [2,1,1,2,2,0,0]
          ]
        }
      ],
      "weights": {
        "avail_scores": {"2": 1.0, "1": 0.5, "0": 0.0},
        "unpreferred_penalty_per_person": 0.1,
        "hard_block_for_high_priority": true
      },
      "top_k": 5
    }
    """
    _require_keys(data, ["slot_minutes", "meeting_length_minutes", "days", "attendees"], "root")

    slot_minutes = int(data["slot_minutes"])
    meeting_len_minutes = int(data["meeting_length_minutes"])
    days: List[str] = data["days"]
    attendees: List[Dict[str, Any]] = data["attendees"]

    if slot_minutes <= 0:
        raise ValueError("slot_minutes must be > 0")
    if meeting_len_minutes <= 0:
        raise ValueError("meeting_length_minutes must be > 0")
    if not isinstance(days, list) or not days:
        raise ValueError("days must be a non-empty list")
    if not isinstance(attendees, list) or not attendees:
        raise ValueError("attendees must be a non-empty list")

    # validate attendees
    for i, att in enumerate(attendees):
        _require_keys(att, ["name", "priority", "availability_matrix"], f"attendees[{i}]")
        if not isinstance(att["availability_matrix"], list) or len(att["availability_matrix"]) != len(days):
            raise ValueError(f"attendees[{i}].availability_matrix must have one row per day ({len(days)}).")

    # same #slots across attendees for each day
    day_slot_counts = []
    for d in range(len(days)):
        slots_d = len(attendees[0]["availability_matrix"][d])
        for i, att in enumerate(attendees):
            if len(att["availability_matrix"][d]) != slots_d:
                raise ValueError(f"All attendees must have the same number of slots on day index {d}.")
        day_slot_counts.append(slots_d)

    L = math.ceil(meeting_len_minutes / slot_minutes)
    if L <= 0:
        L = 1
        raise ValueError("meeting_length_minutes must be at least 1 slot (>= slot_minutes).")

    weights = data.get("weights", {})
    avail_scores_cfg = weights.get("avail_scores")
    if isinstance(avail_scores_cfg, dict):
        # accept keys as strings or ints
        avail_scores = {int(k): float(v) for k, v in avail_scores_cfg.items()}
    else:
        avail_scores = DEFAULT_AVAIL_SCORES

    hard_block = bool(weights.get("hard_block_for_high_priority", True))
    unpref_penalty = float(weights.get("unpreferred_penalty_per_person", 0.0))
    top_k = int(data.get("top_k", 5))

    top_priority = max(float(att["priority"]) for att in attendees)

    suggestions: List[Dict[str, Any]] = []

    for d_idx, day in enumerate(days):
        if day_slot_counts[d_idx] < L:
            continue

        timeline = _compute_day_timeline(attendees, d_idx, avail_scores)
        ps = _prefix_sums(timeline)

        for start in range(0, len(timeline) - L + 1):
            raw = float(_window_sum(ps, start, L))
            details = _analyze_window(
                attendees=attendees,
                day_idx=d_idx,
                start=start,
                length=L,
                top_priority=top_priority,
                hard_block=hard_block,
            )
            if details.get("blocked"):
                continue

            score = raw - unpref_penalty * details["unpreferred_cells"]
            total_cells = len(attendees) * L if attendees else 1
            coverage = details["total_full_avails"] / total_cells

            suggestions.append({
                "day": day,
                "start_slot_index": start,
                "slot_minutes": slot_minutes,
                "meeting_length_minutes": meeting_len_minutes,
                "score": round(score, 4),
                "coverage": round(coverage, 4),
                "conflicts": details["conflicts"],
                "fully_available_attendees": details["fully_available_attendees"],
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
