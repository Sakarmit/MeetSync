//@ts-check

/** @import { TimeSlot } from '../context.js' */

const SLOT_MINUTES = 15; // Each slot represents 15 minutes
const DAY_START_MIN = 9 * 60; // Row 0 is 09:00

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
 * Convert selected slot elements to a map of day to sorted row indices.
 * @param {NodeListOf<HTMLElement>} selectedSlots
 * @returns {Map<number, number[]>} - Map where keys are day indices and values are sorted arrays of row indices.
 */
function selectedSlotsToMap(selectedSlots) {
  /**
   * Gather per day rows
   * @type {Map<number, number[]>}
   */
  const map = new Map();

  selectedSlots.forEach((el) => {
    const day = Number(el.dataset.day);
    const row = Number(el.dataset.row);

    if (!map.has(day)) map.set(day, []);
    map.get(day)?.push(row);
  });

  map.forEach((rows) => rows.sort((a, b) => a - b));

  return map;
}

/**
 * Form contiguous blocks from sorted rows.
 * @param {number[]} rows - Sorted array of row indices.
 * @returns {Array<{ start: number; end: number }>} - Array of contiguous blocks.
 */
function formContiguousBlocks(rows) {
  /** @type {Array<{ start: number; end: number }>} */
  const blocks = [];
  let start = null;
  let prev = null;

  for (const row of rows) {
    if (start === null) {
      start = row;
      prev = row;
    } else if (prev !== null && row === prev + 1) {
      prev = row;
    } else if (prev !== null) {
      blocks.push({ start, end: prev });
      start = row;
      prev = row;
    } else {
      throw new Error("Unreachable state");
    }
  }
  if (start !== null && prev !== null) {
    blocks.push({ start, end: prev });
  } else {
    throw new Error("Unreachable state");
  }

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
      timeSlots.push({ day, startMinute, endMinute });
    }
  }

  // Sort timeSlots by day and startMinute
  return timeSlots.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    return a.startMinute - b.startMinute;
  });
}

/**
 * Decompress TimeSlots into individual slot elements.
 * @param {TimeSlot[]} timeSlots - Array of TimeSlot objects.
 * @returns {Array<{ day: number; row: number }>} - Array of individual slot representations.
 */
function decompressTimeSlots(timeSlots) {
  /** @type {Array<{ day: number; row: number }>} */
  const slots = [];

  for (const { day, startMinute, endMinute } of timeSlots) {
    const startRow = rowFromMinute(startMinute);
    const endRow = rowFromMinute(endMinute);
    for (let r = startRow; r < endRow; r++) {
      slots.push({ day, row: r });
    }
  }

  return slots;
}

export { compressSelectedSlots, decompressTimeSlots };
