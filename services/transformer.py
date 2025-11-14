from typing import Any, Dict, List

from models.front_end_models import FrontEndPayload

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
SLOT_MINUTES = 15
DAY_START_MIN = 0 * 60
DAY_END_MIN = 24 * 60
SLOTS_PER_DAY = int((DAY_END_MIN - DAY_START_MIN) / SLOT_MINUTES)


def transform_frontend_to_model_payload(data: FrontEndPayload) -> Dict[str, Any]:
    attendees: List[Dict[str, Any]] = []

    for user in data.availability:
        matrix = [[2 for _ in range(SLOTS_PER_DAY)] for _ in range(5)]

        for ts in user.time_slots:
            day = ts.day
            start_row = (ts.start_minute - DAY_START_MIN) // SLOT_MINUTES
            end_row = (ts.end_minute - DAY_START_MIN) // SLOT_MINUTES

            avail_value = ts.availability_type.value
            for r in range(start_row, end_row):
                match avail_value:
                    case "busy":
                        availability_type_int = 0
                    case "tentative":
                        availability_type_int = 1
                matrix[day][r] = availability_type_int

        attendees.append({
            "name": user.name,
            "priority": user.priority,
            "availability_matrix": matrix,
        })

    weights_model = data.weights
    avail_scores = weights_model.avail_scores
    unpreferred_penalty = weights_model.unpreferred_penalty_per_person
    hard_block = weights_model.hard_block_for_high_priority

    transformed = {
        "slot_minutes": SLOT_MINUTES,
        "meeting_length_minutes": data.meeting_length_minutes,
        "days": WEEKDAYS.copy(),
        "attendees": attendees,
        "weights": {
            "avail_scores": avail_scores,
            "unpreferred_penalty_per_person": unpreferred_penalty,
            "hard_block_for_high_priority": hard_block,
        },
        "top_k": data.top_k,
    }

    return transformed
