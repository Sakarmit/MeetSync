//@ts-check

/** @import { User } from './context.js' */

/**
 *
 * @param {User[]} users - Array of User availability data.
 * @param {number} meeting_length_minutes - Length of the meeting in minutes.
 * @param {string} dayStart - Start time of the day in "HH:MM" format.
 * @param {string} dayEnd - End time of the day in "HH:MM" format.
 * @returns {Promise<Object>} - The response from the server.
 */
async function submitAvailability(users, meeting_length_minutes, dayStart, dayEnd) {
  const availability = users.map((user) => ({
    name: user.name,
    timeSlots: user.timeSlots,
    priority: user.priority,
  }));
  const constraints = {
    "global_blockers": {
      "hours": {
        "start": dayStart,
        "end": dayEnd === "24:00" ? "23:59" : dayEnd,
      }
    }
  }
  const response = await fetch("/call-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ availability, meeting_length_minutes, constraints }),
  });

  if (!response.ok) {
    const error = new Error(response.statusText);
    // @ts-ignore
    error.detail = (await response.json()).detail;
    // @ts-ignore
    error.status = response.status;
    throw error;
  }
  return await response.json();
}

export { submitAvailability };
