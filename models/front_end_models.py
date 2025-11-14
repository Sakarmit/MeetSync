from __future__ import annotations

from collections import Counter
from enum import Enum
from typing import Annotated

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)
from pydantic.alias_generators import to_camel

DAY_START_MIN = 0 * 60
DAY_END_MIN = 24 * 60
SLOT_MINUTES = 15

DEFAULT_MEETING_LENGTH_MINUTES = 60
DEFAULT_TOP_K = 5
DEFAULT_AVAIL_SCORES = {"2": 1.0, "1": 0.5, "0": 0.0}
DEFAULT_UNPREFERRED_PENALTY = 0.1
DEFAULT_HARD_BLOCK = False


class AppModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        validate_by_alias=True,
        validate_by_name=True,
        strict=False,
    )


class AvailabilityType(str, Enum):
    """Types of availability status. Note that 'available' is implied if no entry exists."""

    busy = "busy"
    tentative = "tentative"


class TimeSlot(AppModel):
    day: Annotated[int, Field(ge=0, le=4)]
    """Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4"""

    start_minute: Annotated[int, Field(ge=DAY_START_MIN, le=DAY_END_MIN)]
    end_minute: Annotated[int, Field(ge=DAY_START_MIN, le=DAY_END_MIN)]

    availability_type: AvailabilityType

    @model_validator(mode="after")
    def check_times(self):
        def follows_slot_increment(minute: int) -> bool:
            """Return True if `minute` aligns with `SLOT_MINUTES` from `DAY_START_MIN`."""
            return (minute - DAY_START_MIN) % SLOT_MINUTES == 0

        if self.start_minute >= self.end_minute:
            raise ValueError("start_minute must be less than end_minute")

        start_minute_follows_inc = follows_slot_increment(self.start_minute)
        end_minute_follows_inc = follows_slot_increment(self.end_minute)
        if not (start_minute_follows_inc and end_minute_follows_inc):
            raise ValueError(f"Times must follow increments of {SLOT_MINUTES} minutes")

        return self


class AvailabilityUser(AppModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
    time_slots: Annotated[list[TimeSlot], Field(default_factory=list)]
    priority: Annotated[int, Field(ge=0, default=1)]


class Weights(AppModel):
    avail_scores: Annotated[
        dict[int | str, int | float],
        Field(default_factory=lambda: DEFAULT_AVAIL_SCORES.copy()),
    ]
    unpreferred_penalty_per_person: Annotated[
        int | float, Field(default=DEFAULT_UNPREFERRED_PENALTY)
    ]
    hard_block_for_high_priority: Annotated[bool, Field(default=DEFAULT_HARD_BLOCK)]

    @field_validator("avail_scores")
    @classmethod
    def validate_avail_scores(
        cls, value: dict[int | str, int | float]
    ) -> dict[int | str, int | float]:
        for k in value.keys():
            try:
                int(k)
            except Exception:
                raise ValueError(
                    "avail_scores keys must be integers or stringified integers"
                )

        return value


class FrontEndPayload(AppModel):
    availability: Annotated[list[AvailabilityUser], Field(min_length=1)]
    meeting_length_minutes: Annotated[
        int,
        Field(
            gt=0, le=DAY_END_MIN - DAY_START_MIN, default=DEFAULT_MEETING_LENGTH_MINUTES
        ),
    ]

    top_k: Annotated[int, Field(gt=0, default=DEFAULT_TOP_K)]
    weights: Annotated[Weights, Field(default_factory=Weights)]

    @field_validator("availability")
    @classmethod
    def unique_user_names(cls, val: list[AvailabilityUser]):
        names_counter = Counter(user.name.lower() for user in val)
        duplicates = [name for name, count in names_counter.items() if count > 1]
        if duplicates:
            raise ValueError(f"Duplicate user names detected: {', '.join(duplicates)}")

        return val
