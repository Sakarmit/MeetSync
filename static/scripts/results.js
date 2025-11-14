import { flashMessage } from "./flash.js";

const DAY_START_MINUTES = 0 * 60; // 00:00

window.addEventListener("message", (event) => {
    // Verify the origin of the message
    if (event.origin !== window.location.origin) {
        console.warn("Received message from unknown origin:", event.origin);
        return;
    }
    const data = event.data;
    
    document.querySelector(".meeting-length").textContent = 
      `Meeting Length: ${data.suggestions[0].meeting_length_minutes} minutes`;

    document
        .querySelector(".export")
        .addEventListener("click", () => {
            exportResults(data, { filename: "meetsync-results.txt" });
        });

    const templateSelector = "ul.result-list > template";
    for (let i = 0; i < data.suggestions.length; i++) {
        const result = data.suggestions[i];

        const itemElement = document.querySelector(templateSelector).content.cloneNode(true);
        const titleElement = itemElement.querySelector(".date-time");
        const timeStart = minutesToTimeString(DAY_START_MINUTES + result.start_slot_index * result.slot_minutes);
        const timeEnd = minutesToTimeString(DAY_START_MINUTES + result.start_slot_index * result.slot_minutes + result.meeting_length_minutes);
        titleElement.textContent = `#${i + 1} ${result.day}: ${timeStart} - ${timeEnd}`;
        
        const coverageElement = itemElement.querySelector(".coverage-value");
        coverageElement.textContent = (result.coverage * 100).toFixed(0) + "%";
        if (result.coverage == 1) {
            coverageElement.classList.add("green");
        } else if (result.coverage >= 0.5) {
            coverageElement.classList.add("orange");
        } else {
            coverageElement.classList.add("red");
        }
        itemElement.querySelector(".score-value").textContent = result.score;
        
        for (const conflict of result.conflicts) {
            const li = document.createElement("li");
            li.textContent = conflict;
            itemElement.querySelector(".conflict-values").appendChild(li);
        }
        if (result.conflicts.length === 0) {
            const li = document.createElement("li");
            li.textContent = "None";
            li.classList.add("none");
            itemElement.querySelector(".conflict-values").appendChild(li);
        }

        document.querySelector("ul.result-list").appendChild(itemElement);
    }

});
document
        .querySelector(".export")
        .addEventListener("click", () => {
            exportResults({}, { filename: "meetsync-results.txt" });
        });
/**
 *
 * This assumes `result` has shape:
 *   { suggestions: [{ day, start_slot_index, slot_minutes, meeting_length_minutes,
 *                    score, coverage, conflicts, fully_available_attendees }] }
 *
 * @param {any} result - Raw response object from the backend.
 * @param {{ filename?: string }} [options]
 */
function exportResults(result, options = {}) {
  if (!result || !Array.isArray(result.suggestions)) {
    console.warn("exportResults: no suggestions found in result", result);
    flashMessage("No meeting suggestions to export.", "error");
    return;
  }

  const filename = options.filename || "meetsync-results.txt";

  const lines = [];
  lines.push("MeetSync — Suggested Meeting Times");
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push("");

  result.suggestions.forEach((s) => {
    const slotMinutes = s.slot_minutes || 15;
    const meetLen = s.meeting_length_minutes || slotMinutes;
    const startMinutes = DAY_START_MINUTES + s.start_slot_index * slotMinutes;
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
