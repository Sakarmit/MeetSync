from typing import Any, Dict, List

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
SLOT_MINUTES = 15
DAY_START_MIN = 0 * 60
DAY_END_MIN = 24 * 60
SLOTS_PER_DAY = int((DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES)

DEFAULT_MEETING_LENGTH_MINUTES = 60
DEFAULT_TOP_K = 5
DEFAULT_AVAIL_SCORES = {"2": 1.0, "1": 0.5, "0": 0.0}
DEFAULT_UNPREFERRED_PENALTY = 0.1
DEFAULT_HARD_BLOCK = False

def _validate_time_slot(ts: Dict[str, Any]) -> None:
    if not all(isinstance(ts[k], int) for k in ("day", "startMinute", "endMinute")):
        raise ValueError("day, startMinute, and endMinute must be integers")
    if "availabilityType" not in ts:
        raise ValueError("availabilityType is required in TimeSlot")

    day = ts["day"]
    start = ts["startMinute"]
    end = ts["endMinute"]

    if not isinstance(day, int) or day < 0 or day > 4:
        raise ValueError("day must be an integer in [0,4] (Mon-Fri)")
    if not all(isinstance(x, int) for x in (start, end)):
        raise ValueError("startMinute/endMinute must be integers")
    if start < DAY_START_MIN or end > DAY_END_MIN or start >= end:
        raise ValueError(f"TimeSlot bounds must be within {DAY_START_MIN}:00-{DAY_END_MIN}:00 and start < end")
    if (start - DAY_START_MIN) % SLOT_MINUTES != 0 or (end - DAY_START_MIN) % SLOT_MINUTES != 0:
        raise ValueError(f"Times must follow increments of {SLOT_MINUTES} minutes")

    if ts["availabilityType"] not in ("busy", "tentative"):
        raise ValueError("availabilityType must be either 'busy' or 'tentative'. 'available' slots should be omitted")

def _validate_frontend_payload(data: Dict[str, Any]) -> None:
    availability = data.get("availability", [])
    if not isinstance(availability, list) or len(availability) == 0:
        raise ValueError("availability must be a non-empty array of users")

    meeting_length = data.get("meeting_length_minutes", DEFAULT_MEETING_LENGTH_MINUTES)
    if not isinstance(meeting_length, int) or meeting_length <= 0:
        raise ValueError("meeting_length_minutes must be a positive integer")
    if meeting_length > (DAY_END_MIN - DAY_START_MIN):
        raise ValueError(f"meeting_length_minutes cannot exceed the length of the day ({DAY_END_MIN - DAY_START_MIN} minutes)")

    top_k = data.get("top_k", DEFAULT_TOP_K)
    if not isinstance(top_k, int) or top_k <= 0:
        raise ValueError("top_k must be a positive integer")
    
    weights = data.get("weights", {})
    if weights:
        if not isinstance(weights, dict):
            raise ValueError("weights must be an object")
        
        avail_scores = weights.get("avail_scores")
        if avail_scores is not None:
            if not isinstance(avail_scores, dict):
                raise ValueError("weights.avail_scores must be an object")
            for k, v in avail_scores.items():
                try:
                    int(k)
                except Exception:
                    raise ValueError("weights.avail_scores keys must be integers or stringified integers")
                if not isinstance(v, (int, float)):
                    raise ValueError("weights.avail_scores values must be numbers")
        
        unpreferred_penalty = weights.get("unpreferred_penalty_per_person")
        if unpreferred_penalty is not None and not isinstance(unpreferred_penalty, (int, float)):
            raise ValueError("weights.unpreferred_penalty_per_person must be a number")
        
        hard_block = weights.get("hard_block_for_high_priority")
        if hard_block is not None and not isinstance(hard_block, bool):
            raise ValueError("weights.hard_block_for_high_priority must be a boolean")

    name_list = set()
    for i, user in enumerate(availability):
        if not isinstance(user, dict):
            raise ValueError(f"availability[{i}] must be an object")
        
        name = user.get("name")
        priority = user.get("priority", 1)
        timeSlots = user.get("timeSlots", [])

        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"availability[{i}].name must be a non-empty string")
        name = name.strip()
        norm_name = name.lower()
        if norm_name in name_list:
            raise ValueError(f"Duplicate user name detected: '{name}'")
        name_list.add(norm_name)
        user["name"] = name
        
        if not isinstance(priority, int) or priority <= 0:
            raise ValueError(f"availability[{i}].priority must be a positive integer")
        
        if not isinstance(timeSlots, list):
            raise ValueError(f"availability[{i}].timeSlots must be an array")
        
        for j, ts in enumerate(timeSlots):
            if not isinstance(ts, dict):
                raise ValueError(f"timeSlots[{j}] must be an object")
            _validate_time_slot(ts)


def is_frontend_payload(data: Dict[str, Any]) -> bool:
    return isinstance(data, dict) and isinstance(data.get("availability"), list)

def transform_frontend_to_model_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    _validate_frontend_payload(data)
    
    availability = data.get("availability", [])
    attendees: List[Dict[str, Any]] = []

    for user in availability:
        matrix = [[2 for _ in range(SLOTS_PER_DAY)] for _ in range(5)]

        for ts in user.get("timeSlots", []):
            day = int(ts["day"])
            start_row = int((int(ts["startMinute"]) - DAY_START_MIN) / SLOT_MINUTES)
            end_row = int((int(ts["endMinute"]) - DAY_START_MIN) / SLOT_MINUTES)
            availability_type = ts["availabilityType"]
            for r in range(start_row, end_row):
                match availability_type:
                    case "busy":
                        availability_type_int = 0
                    case "tentative":
                        availability_type_int = 1
                    case _:
                        availability_type_int = -1  # Should not happen due to validation
                matrix[day][r] = availability_type_int

        attendees.append({
            "name": user.get("name"),
            "priority": user.get("priority", 1),
            "availability_matrix": matrix,
        })

    weights = data.get("weights", {})
    avail_scores = weights.get("avail_scores", DEFAULT_AVAIL_SCORES)
    unpreferred_penalty = weights.get("unpreferred_penalty_per_person", DEFAULT_UNPREFERRED_PENALTY)
    hard_block = weights.get("hard_block_for_high_priority", DEFAULT_HARD_BLOCK)

    transformed = {
        "slot_minutes": SLOT_MINUTES,
        "meeting_length_minutes": int(data.get("meeting_length_minutes", DEFAULT_MEETING_LENGTH_MINUTES)),
        "days": WEEKDAYS.copy(),
        "attendees": attendees,
        "weights": {
            "avail_scores": avail_scores,
            "unpreferred_penalty_per_person": unpreferred_penalty,
            "hard_block_for_high_priority": hard_block,
        },
        "top_k": int(data.get("top_k", DEFAULT_TOP_K)),
        "constraints": data.get("constraints", {}),
    }
    
    return transformed
