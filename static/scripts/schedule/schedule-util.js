// @ts-check

/** @import { AvailabilityType, TimeSlot } from '../context.js' */

/** @typedef {{ rowIdx: number, availabilityType: AvailabilityType }} TimeSlotRow */
/** @typedef {{ start: number, end: number, availabilityType: AvailabilityType }} ContiguousBlock */

const SLOT_MINUTES = 15; // Each slot represents 15 minutes
const DAY_START_MIN = 0 * 60; // Row 0 represents 00:00

/**
 * Convert a row index to the corresponding minute of the day.
 * @param {number} row - The row index.
 * @returns {number} - The minute of the day corresponding to the row.
 */
function minuteFromRow(row) {
  return row * SLOT_MINUTES + DAY_START_MIN;
}

/**
 * Convert minute of the day to the corresponding row index.
 * @param {number} minute - The minute of the day.
 * @returns {number} - The row index corresponding to the minute.
 */
function rowFromMinute(minute) {
  return (minute - DAY_START_MIN) / SLOT_MINUTES;
}

/**
 * Convert selected slot elements to a map of day to sorted TimeSlotRows.
 * @param {NodeListOf<HTMLElement>} selectedSlots
 * @returns {Map<number, TimeSlotRow[]>} - Map where keys are day indices and values are sorted arrays of TimeSlotRows.
 */
function selectedSlotsToMap(selectedSlots) {
  /** @type {Map<number, TimeSlotRow[]>} */
  const map = new Map();

  for (const el of selectedSlots) {
    if (el.dataset.day === undefined || el.dataset.row === undefined) {
      throw new Error("Selected slot element is missing required data attributes.");
    }

    const day = parseInt(el.dataset.day, 10);
    const rowIdx = parseInt(el.dataset.row, 10);

    /** @type {AvailabilityType} */
    let availabilityType;
    if (el.classList.contains("selected")) {
      availabilityType = "busy";
    } else if (el.classList.contains("selected-tentative")) {
      availabilityType = "tentative";
    } else {
      throw new Error("Selected slot element has no or unknown availability class.");
    }

    if (!map.has(day)) map.set(day, []);
    map.get(day)?.push({ rowIdx, availabilityType });
  }

  map.forEach((rows) => rows.sort((a, b) => a.rowIdx - b.rowIdx));

  return map;
}

/**
 * Form contiguous blocks from sorted TimeSlotRows.
 * @param {TimeSlotRow[]} rows - Sorted array of TimeSlotRows.
 * @returns {ContiguousBlock[]}
 */
function formContiguousBlocks(rows) {
  if (rows.length === 0) return [];

  /** @type {ContiguousBlock[]} */
  const blocks = [];
  /** @type {ContiguousBlock} */
  let current = {
    start: rows[0].rowIdx,
    end: rows[0].rowIdx,
    availabilityType: rows[0].availabilityType,
  };

  for (let i = 1; i < rows.length; i++) {
    const { rowIdx, availabilityType } = rows[i];

    // Extend block if current row continues it. Else close current block and start a new one.
    if (rowIdx === current.end + 1 && availabilityType === current.availabilityType) {
      current.end = rowIdx;
    } else {
      blocks.push(current);
      current = { start: rowIdx, end: rowIdx, availabilityType };
    }
  }

  // Close final block
  blocks.push(current);

  return blocks;
}

/**
 * Compress selected slot elements into TimeSlots.
 * @param {NodeListOf<HTMLElement>} selectedSlots - List of selected slot elements.
 * @returns {TimeSlot[]} - Array of compressed TimeSlot objects.
 */
function compressSelectedSlots(selectedSlots) {
  const daysRowsMap = selectedSlotsToMap(selectedSlots);

  /** @type {TimeSlot[]} */
  const timeSlots = [];

  for (const [day, rows] of daysRowsMap.entries()) {
    const blocks = formContiguousBlocks(rows);
    for (const block of blocks) {
      const startMinute = minuteFromRow(block.start);
      const endMinute = minuteFromRow(block.end + 1);
      const availabilityType = block.availabilityType;
      timeSlots.push({ day, startMinute, endMinute, availabilityType });
    }
  }

  return timeSlots.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.startMinute - b.startMinute;
  });
}

/**
 * Decompress TimeSlots into individual slot elements.
 * @param {TimeSlot[]} timeSlots - Array of TimeSlot objects.
 * @returns {Array<{ day: number, row: number, availabilityType: AvailabilityType }>} - Array of individual slot representations.
 */
function decompressTimeSlots(timeSlots) {
  /** @type {Array<{ day: number, row: number, availabilityType: AvailabilityType }>} */
  const slots = [];

  for (const { day, startMinute, endMinute, availabilityType } of timeSlots) {
    const startRow = rowFromMinute(startMinute);
    const endRow = rowFromMinute(endMinute);
    for (let row = startRow; row < endRow; row++) {
      slots.push({ day, row, availabilityType });
    }
  }

  return slots;
}

/**
 * Set the availability type of the selected slot
 * @param {HTMLElement} slotEl - The slot element to set the availability type for.
 * @param {AvailabilityType} availabilityType - The availability type to set.
 */
function paintAvailabilitySlot(slotEl, availabilityType) {
  switch (availabilityType) {
    case "busy":
      slotEl.classList.add("selected");
      slotEl.classList.remove("selected-tentative");
      break;
    case "tentative":
      slotEl.classList.add("selected-tentative");
      slotEl.classList.remove("selected");
      break;
    case "available":
      slotEl.classList.remove("selected", "selected-tentative");
      break;
    default:
      throw new Error(`Unreachable: Unknown availability type ${availabilityType}`);
  }
}

export { compressSelectedSlots, decompressTimeSlots, paintAvailabilitySlot };
