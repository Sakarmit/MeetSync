from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from models.front_end_models import (
    DAY_END_MIN,
    DAY_START_MIN,
    SLOT_MINUTES,
    AvailabilityType,
    AvailabilityUser,
    FrontEndPayload,
)
from models.front_end_models import Weights as FrontEndWeights

WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]


@dataclass
class Attendee:
    name: str
    priority: int
    availability_matrix: list[list[int]]


@dataclass
class Weights:
    avail_scores: dict[str, int | float]
    unpreferred_penalty_per_person: int | float
    hard_block_for_high_priority: bool

    @classmethod
    def from_frontend_weights(cls, weights: FrontEndWeights) -> Weights:
        avail_scores = {str(k): v for k, v in weights.avail_scores.items()}
        return cls(
            avail_scores=avail_scores,
            unpreferred_penalty_per_person=weights.unpreferred_penalty_per_person,
            hard_block_for_high_priority=weights.hard_block_for_high_priority,
        )


@dataclass
class ModelData:
    slot_minutes: int
    meeting_length_minutes: int
    days: list[str]
    attendees: list[Attendee]
    weights: Weights
    top_k: int


def _row_from_minute(minute: int) -> int:
    return (minute - DAY_START_MIN) // SLOT_MINUTES


def _availability_type_to_int(availability_type: AvailabilityType) -> int:
    match availability_type:
        case AvailabilityType.busy:
            return 0
        case AvailabilityType.tentative:
            return 1


SLOTS_PER_DAY = _row_from_minute(DAY_END_MIN)


def _user_to_attendee_mapper(user: AvailabilityUser) -> Attendee:
    matrix = [[2 for _ in range(SLOTS_PER_DAY)] for _ in range(len(WEEKDAYS))]

    for ts in user.time_slots:
        start_row = _row_from_minute(ts.start_minute)
        end_row = _row_from_minute(ts.end_minute)
        availability_type_int = _availability_type_to_int(ts.availability_type)
        for row in range(start_row, end_row):
            matrix[ts.day][row] = availability_type_int

    return Attendee(
        name=user.name,
        priority=user.priority,
        availability_matrix=matrix,
    )


def transform_frontend_payload_to_model_data(data: FrontEndPayload) -> dict[str, Any]:
    attendees = list(map(_user_to_attendee_mapper, data.availability))

    model = ModelData(
        slot_minutes=SLOT_MINUTES,
        meeting_length_minutes=data.meeting_length_minutes,
        days=WEEKDAYS,
        attendees=attendees,
        weights=Weights.from_frontend_weights(data.weights),
        top_k=data.top_k,
    )

    return asdict(model)
