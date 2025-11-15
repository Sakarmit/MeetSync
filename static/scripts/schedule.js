import { context, eventBus } from "./context.js";
import {
  compressSelectedSlots,
  decompressTimeSlots,
  paintAvailabilitySlot,
} from "./schedule/schedule-util.js";
import { flashMessage } from "./flash.js";

/** @import { AvailabilityType, TimeSlot, User } from './context.js' */

function clearSlots() {
  document
    .querySelector(".availability-schedule .slots")
    .querySelectorAll(".slot.selected, .slot.selected-tentative")
    .forEach((s) => s.classList.remove("selected", "selected-tentative"));
}

/**
 * Load schedule data into the UI.
 * @param {TimeSlot[]} timeSlots - Array of TimeSlot objects to load into the schedule.
 */
function loadScheduleData(timeSlots) {
  const slots = document.querySelector(".availability-schedule .slots");
  clearSlots();

  const individualSlots = decompressTimeSlots(timeSlots);
  individualSlots.forEach(({ day, row, availabilityType }) => {
    const slotEl = slots.querySelector(`.slot[data-day='${day}'][data-row='${row}']`);
    if (slotEl) {
      paintAvailabilitySlot(slotEl, availabilityType);
    } else {
      throw new Error(`Slot element not found for day ${day}, row ${row}`);
    }
  });
}

function initializeSchedule() {
  eventBus.addEventListener("selectedUser:selected", () => {
    /** @type {User} */
    const user = context.users.find((u) => u.id === context.selectedUserId);
    if (!user) return;
    loadScheduleData(user.timeSlots);
  });

  const slots = document.querySelector(".availability-schedule .slots");

  let isPainting = false;
  /** @type {AvailabilityType} */
  let paintColor = "busy";

  slots.addEventListener("mousedown", (e) => {
    const cell = e.target.closest(".slot");
    if (!cell) return;

    isPainting = true;
    paintAvailabilitySlot(cell, paintColor);

    // Prevent drag selection
    e.preventDefault();
  });

  slots.addEventListener("mousemove", (e) => {
    if (!isPainting) return;

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit?.closest(".slot");
    if (!cell) return;

    paintAvailabilitySlot(cell, paintColor);
  });

  function endPaint() {
    isPainting = false;
  }

  slots.addEventListener("mouseup", endPaint);
  slots.addEventListener("mouseleave", endPaint);
  window.addEventListener("blur", endPaint); // Stop painting if window loses focus

  const clearButtonSelector = ".availability-schedule button.clear";
  document.querySelector(clearButtonSelector).addEventListener("click", clearSlots);

  document.querySelector(".availability-schedule button.save").addEventListener("click", () => {
    const selectedSlots = slots.querySelectorAll(".slot.selected, .slot.selected-tentative");
    const timeSlots = compressSelectedSlots(selectedSlots);

    flashMessage("Schedule saved successfully.", "success");
    eventBus.updateSelectedUser({ timeSlots });
  });

  const availabilitySelectors = document.querySelector(".schedule-container > .selectors");

  availabilitySelectors.addEventListener("click", (ev) => {
    const selectorEl = ev.target.closest(".selector");
    if (!selectorEl || !availabilitySelectors.contains(selectorEl)) return;

    availabilitySelectors
      .querySelectorAll("button.selector.active")
      .forEach((btn) => btn.classList.remove("active"));

    selectorEl.classList.add("active");

    paintColor = selectorEl.dataset.type;
  });
}

export { initializeSchedule };
