//@ts-check

/** @import { User } from './context.js' */

/**
 *
 * @param {User[]} users - Array of User availability data.
 * @returns {Promise<Object>} - The response from the server.
 */
async function submitAvailability(users) {
  const availability = users.map((user) => ({ name: user.name, timeSlots: user.timeSlots }));
  const response = await fetch("/call-model", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ availability }),
  });

  if (!response.ok) throw new Error((await response.json()).detail || response.statusText);
  return await response.json();
}

export { submitAvailability };
