import { context, eventBus } from "./context.js";
import {
  compressSelectedSlots,
  decompressTimeSlots,
  paintAvailabilitySlot
} from "./schedule/schedule-util.js";
import { flashMessage } from "./flash.js";
import { popupMessage } from "./popup.js";

/** @import { AvailabilityType, TimeSlot, User } from './context.js' */

let savedSchedule = true;

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
  savedSchedule = true;
}

function initializeSchedule() {
  eventBus.addEventListener("selectedUser:selected", () => {
    if (context.selectedUserId === null) {
      clearSlots();
      return;
    }

    /** @type {User} */
    const user = context.users.find((u) => u.id === context.selectedUserId);
    if (!user) {
      clearSlots();
      flashMessage("Selected user not found. Schedule cleared.", "warning");
      console.warn(
        `selectedUserId (${context.selectedUserId}) does not match any user in context.users.`
      );
      return;
    }

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
    savedSchedule = false;

    // Prevent drag selection
    e.preventDefault();
  });

  slots.addEventListener("mousemove", (e) => {
    if (!isPainting) return;

    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const cell = hit?.closest(".slot");
    if (!cell) return;

    paintAvailabilitySlot(cell, paintColor);
    if (isPainting) savedSchedule = false;
  });

  function endPaint() {
    isPainting = false;
  }

  slots.addEventListener("mouseup", endPaint);
  slots.addEventListener("mouseleave", endPaint);
  window.addEventListener("blur", endPaint); // Stop painting if window loses focus

  const clearButtonSelector = ".availability-schedule .controls button.clear";
  document.querySelector(clearButtonSelector).addEventListener("click", () => {
    clearSlots();
    savedSchedule = false;
  });

  const resetButtonSelector = ".availability-schedule .controls button.reset";
  document.querySelector(resetButtonSelector).addEventListener("click", async () => {
    const res = await popupMessage("Are you sure you want to reset schedule to last save?", [
      { label: "Reset", className: "destructive" }
    ]);
    if (res !== "Reset") return;
    loadScheduleData(context.users.find((u) => u.id === context.selectedUserId)?.timeSlots || []);
  });

  document
    .querySelector(".availability-schedule .controls button.save")
    .addEventListener("click", () => {
      const selectedSlots = slots.querySelectorAll(".slot.selected, .slot.selected-tentative");
      const timeSlots = compressSelectedSlots(selectedSlots);

      flashMessage("Schedule saved successfully.", "success");
      eventBus.updateSelectedUser({ timeSlots });
      savedSchedule = true;
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

  const columnHeaders = document.querySelectorAll(".availability-schedule .column-header");
  columnHeaders.forEach((header, index) => {
    header.addEventListener("click", () => {
      const day = index;
      const daySlots = slots.querySelectorAll(`.slot[data-day='${day}']`);

      daySlots.forEach((slot) => paintAvailabilitySlot(slot, paintColor));
    });
  });

  const rowSelectors = document.querySelectorAll(".availability-schedule .row-selectors > div");
  rowSelectors.forEach((selector, index) => {
    selector.addEventListener("click", () => {
      const row = index;
      const rowSlots = slots.querySelectorAll(`.slot[data-row='${row}']`);

      rowSlots.forEach((slot) => paintAvailabilitySlot(slot, paintColor));
    });
  });
}

async function scheduleSavedStateHandler() {
  if (savedSchedule) return true;
  const buttons = [
    { label: "Save", className: "confirm" },
    { label: "Don't Save", className: "destructive" }
  ];
  const res = await popupMessage(
    "You have unsaved changes to your schedule.\nDo you want to save them?",
    buttons
  );
  if (res === "Cancel") return false;
  if (res === "Save") document.querySelector(".availability-schedule button.save").click();
  savedSchedule = true;
  return true;
}

export { initializeSchedule, scheduleSavedStateHandler };
