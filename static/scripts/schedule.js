import { context, eventBus } from "./context.js";
import { compressSelectedSlots, decompressTimeSlots } from "./schedule/schedule-util.js";

/** @import { TimeSlot, User } from './context.js' */

/**
 * Load schedule data into the UI.
 * @param {TimeSlot[]} timeSlots - Array of TimeSlot objects to load into the schedule.
 */
function loadScheduleData(timeSlots) {
  const slots = document.querySelector(".availability-schedule .slots");
  slots.querySelectorAll(".slot.selected").forEach((s) => s.classList.remove("selected"));

  const individualSlots = decompressTimeSlots(timeSlots);
  individualSlots.forEach(({ day, row }) => {
    const slotEl = slots.querySelector(`.slot[data-day='${day}'][data-row='${row}']`);
    if (slotEl) {
      slotEl.classList.add("selected");
    } else {
      throw new Error(`Slot element not found for day ${day}, row ${row}`);
    }
  });
}

function initializeSchedule() {
  eventBus.addEventListener("selectedUser:selected", () => {
    /** @type {User} */
    const user = context.users.find((u) => u.id === context.selectedUserId);

    loadScheduleData(user.timeSlots);
  });

  const slots = document.querySelector(".availability-schedule .slots");

  let isPainting = false;
  /** Paint to true = select, false = deselect */
  let paintColor = true;

  // Helper Functions
  const setSel = (el, on) => el.classList.toggle("selected", on);
  const isSel = (el) => el.classList.contains("selected");

  slots.addEventListener("mousedown", (e) => {
    const cell = e.target.closest(".slot");
    if (!cell) return;

    isPainting = true;
    paintColor = !isSel(cell);
    setSel(cell, paintColor);

    // Prevent drag selection
    e.preventDefault();
  });

  slots.addEventListener("mousemove", (e) => {
    if (!isPainting) return;

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit?.closest(".slot");
    if (!cell) return;

    setSel(cell, paintColor);
  });

  function endPaint() {
    isPainting = false;
  }

  slots.addEventListener("mouseup", endPaint);
  slots.addEventListener("mouseleave", endPaint);
  window.addEventListener("blur", endPaint); // Stop painting if window loses focus

  const clearButtonSelector = ".availability-schedule button.clear";
  document.querySelector(clearButtonSelector).addEventListener("click", () => {
    slots.querySelectorAll(".slot.selected").forEach((s) => s.classList.remove("selected"));
  });

  document.querySelector(".availability-schedule button.save").addEventListener("click", () => {
    const selectedSlots = slots.querySelectorAll(".slot.selected");
    const timeSlots = compressSelectedSlots(selectedSlots);

    eventBus.updateSelectedUser({ timeSlots });
  });
}

const SUBMIT_BUTTON_SELECTOR = ".availability-schedule button.submit";

export { initializeSchedule, SUBMIT_BUTTON_SELECTOR };
