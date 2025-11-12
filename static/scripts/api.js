//@ts-check

/** @import { User } from './context.js' */

/**
 *
 * @param {User[]} users - Array of User availability data.
 * @param {number} meeting_length_minutes - Length of the meeting in minutes.
 * @returns {Promise<Object>} - The response from the server.
 */
async function submitAvailability(users, meeting_length_minutes) {
  const availability = users.map((user) => ({
    name: user.name,
    timeSlots: user.timeSlots,
    priority: user.priority,
  }));
  const response = await fetch("/call-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ availability, meeting_length_minutes }),
  });

  if (!response.ok) {
    console.log(response);
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
