import { submitAvailability } from "./api.js";
import { context, eventBus } from "./context.js";
import { initUserSideBar } from "./user_side_bar.js";
import { initializeSchedule } from "./schedule.js";
import { flashMessage } from "./flash.js";

initUserSideBar();
initializeSchedule();

// Keep track of the most recent backend response (for export if needed)
let lastResponse = null;

/**
 * Helper: convert minutes-from-midnight to 12h time string.
 * @param {number} totalMinutes
 * @returns {string}
 */
function minutesToTimeString(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours24 >= 12 ? "PM" : "AM";
  const hours12 = ((hours24 + 11) % 12) + 1;
  const mm = String(minutes).padStart(2, "0");
  return `${hours12}:${mm} ${ampm}`;
}

/**
 * REQUIRED PART:
 * Export meeting suggestions (backend response) as a readable .txt file.
 *
 * This assumes `result` has shape:
 *   { suggestions: [{ day, start_slot_index, slot_minutes, meeting_length_minutes,
 *                    score, coverage, conflicts, fully_available_attendees }] }
 *
 * @param {any} result - Raw response object from the backend.
 * @param {{ dayStartMinutes?: number, filename?: string }} [options]
 */
function exportResults(result, options = {}) {
  if (!result || !Array.isArray(result.suggestions)) {
    console.warn("exportResults: no suggestions found in result", result);
    flashMessage("No meeting suggestions to export.", "error");
    return;
  }

  // Default: 9:00 AM → 9 * 60 minutes; can be changed via options.
  const dayStartMinutes = Number.isFinite(options.dayStartMinutes)
    ? options.dayStartMinutes
    : 9 * 60;

  const filename = options.filename || "meetsync-results.txt";

  const lines = [];
  lines.push("MeetSync — Suggested Meeting Times");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  result.suggestions.forEach((s) => {
    const slotMinutes = s.slot_minutes || 15;
    const meetLen = s.meeting_length_minutes || slotMinutes;
    const startMinutes = dayStartMinutes + s.start_slot_index * slotMinutes;
    const endMinutes = startMinutes + meetLen;

    const startStr = minutesToTimeString(startMinutes);
    const endStr = minutesToTimeString(endMinutes);

    const coveragePct = Math.round((s.coverage || 0) * 100);
    const conflictsText =
      s.conflicts && s.conflicts.length ? s.conflicts.join(", ") : "none";

    lines.push(`${s.day}: ${startStr} – ${endStr}`);
    lines.push(
      `  Score: ${s.score} | Coverage: ${coveragePct}% | Fully available: ${s.fully_available_attendees}`
    );
    lines.push(`  Conflicts: ${conflictsText}`);
    lines.push("");
  });

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * OPTIONAL PART:
 * Exported entire context.users array as JSON and download it.
 * Only serializable fields (no Symbols) are included.
 */
function exportUsersToFile() {
  const usersForExport = context.users.map((u) => ({
    name: u.name,
    priority: u.priority,
    timeSlots: u.timeSlots,
  }));

  const blob = new Blob([JSON.stringify(usersForExport, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meetsync-users.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * OPTIONAL PART:
 * Applied imported users (array of { name, priority, timeSlots }) to context.
 * This does NOT handle reading the file; it's intended to be called
 * after parsing JSON from a file input, etc.
 *
 * @param {{ name: string, priority?: number, timeSlots?: any[] }[]} importedUsers
 */
function importUsersFromArray(importedUsers) {
  if (!Array.isArray(importedUsers)) {
    flashMessage("Import users failed: invalid format.", "error");
    return;
  }

  // If we already have users, confirm clearing them first.
  if (context.users.length > 0) {
    const shouldClear = window.confirm(
      "There are already users in the schedule. Clear them before importing?"
    );
    if (shouldClear) {
      // Clear users array
      context.users.length = 0;
      // Remove UI items (teammate specified .item class)
      document.querySelectorAll(".item").forEach((v) => v.remove());
    }
  }

  // Add imported users
  importedUsers.forEach((u) => {
    const name = (u && u.name ? String(u.name) : "").trim();
    if (!name) return;

    const priority =
      typeof u.priority === "number" && u.priority > 0 ? u.priority : 1;

    const timeSlots = Array.isArray(u.timeSlots) ? u.timeSlots : [];

    const id = Symbol(`User:${name}`);
    eventBus.addUser({ id, name, timeSlots, priority });
  });

  flashMessage("Users imported.", "success");
}

// === EXISTING UI WIRING (unchanged except storing lastResponse) ===

document
  .querySelector(
    "main.main-content .availability-schedule div.controls button.generate"
  )
  .addEventListener("click", async () => {
    const users = context.users;
    const meeting_length_minutes = context.meeting_length_minutes;

    try {
      const response = await submitAvailability(users, meeting_length_minutes);
      lastResponse = response; // store last backend response

      flashMessage("Meeting suggestions generated!", "success");
      console.log("Server response:", response); // hook displying results here
      // HERE call exportResults(lastResponse) from a button
    } catch (error) {
      flashMessage(error.detail, "error", error.status, error.message);
      return;
    }
  });

eventBus.addEventListener("selectedUser:selected", () => {
  document.querySelector(".main-content").classList.remove("no-user-selected");
  const input_name = document.getElementById("user-name");
  const input_priority = document.getElementById("user-priority");
  const selectedUser = context.users.find(
    (u) => u.id === context.selectedUserId
  );

  input_name.value = selectedUser.name;
  input_priority.value = selectedUser.priority;
});

const userControlSelector = ".main-content > header > .user-control";
document
  .querySelector(userControlSelector + " > button.save")
  .addEventListener("click", () => {
    const userNameInput = document.getElementById("user-name");
    const userPriorityInput = document.getElementById("user-priority");
    const newName = userNameInput.value.trim();
    const newPriority = parseInt(userPriorityInput.value.trim(), 10);

    if (!newName) {
      flashMessage("User's name cannot be empty.", "error");
      return;
    }
    if (isNaN(newPriority) || newPriority <= 0) {
      flashMessage("Priority must be a positive integer.", "error");
      return;
    }
    eventBus.updateSelectedUser({ name: newName, priority: newPriority });
    flashMessage("User updated successfully.", "success");
  });

// Export helpers to import & hook them to buttons
export { exportResults, exportUsersToFile, importUsersFromArray };
