//@ts-check

/** @typedef {"busy" | "tentative" | "available"} AvailabilityType */

/**
 * A time slot representing a busy period within a single day.
 * @typedef {Object} TimeSlot
 * @property {number} day - Day of the week. Integer from 0 (Monday) to 4 (Friday).
 * @property {number} startMinute - Integer representing minutes since 00:00.
 * @property {number} endMinute - Integer representing minutes since 00:00; should be greater than `startMinute`.
 * @property {AvailabilityType} availabilityType - Type of availability for the time slot.
 */

/** @typedef {{ id: Symbol, name: string, timeSlots: TimeSlot[], priority: number }} User */

const context = {
  /** @type {User[]} */
  users: [],
  /** @type {Symbol|null} */
  selectedUserId: null,
  /** @type {number} */
  meeting_length_minutes: 15,
};

class EventBus extends EventTarget {
  /**
   * Update the currently selected user's data with the provided fields.
   * @param {Partial<User>} userData - Fields to update on the selected user.
   * @throws Will throw an error if no user is currently selected.
   */
  updateSelectedUser(userData) {
    const id = context.selectedUserId;

    if (id === null) throw new Error("No user is currently selected.");

    const idx = context.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("Selected user not found in context.");

    const currentUserData = context.users[idx];
    context.users[idx] = { ...currentUserData, ...userData };

    this.dispatchEvent(new Event("selectedUser:updated"));
  }

  /**
   * Add a new user to the context and select them.
   * @param {User} user - The user to add.
   */
  addUser(user) {
    context.users.push(user);
    this.dispatchEvent(new Event("users:updated"));
    this.selectUser(user.id);
  }

  /**
   * Update `content.selectedUserId` to select a different user.
   * @param {Symbol} id - ID of the user to select.
   * @throws Will throw an error if the index is out of bounds.
   */
  selectUser(id) {
    const user = context.users.find((u) => u.id === id);
    if (!user) throw new Error("User ID not found in context.");

    context.selectedUserId = id;

    this.dispatchEvent(new Event("selectedUser:selected"));
  }

  /**
   * Delete a user from the context.
   * @param {Symbol} id - ID of the user to delete.
   */
  deleteUser(id) {
    const idx = context.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new Error("User ID not found in context.");

    context.users.splice(idx, 1);

    if (context.selectedUserId === id) {
      context.selectedUserId = null;
      this.dispatchEvent(new Event("selectedUser:updated"));
    }

    this.dispatchEvent(new Event("users:updated"));
  }
}

const eventBus = new EventBus();

/**
 * Return a JSON-safe snapshot of all users.
 * @returns {{ name: string, priority: number, timeSlots: TimeSlot[] }[]}
 */
function exportUsersData() {
  return context.users.map((u) => ({
    name: u.name,
    priority: u.priority,
    timeSlots: Array.isArray(u.timeSlots) ? u.timeSlots : [],
  }));
}

/**
 * Convert JSON-safe user data back into full User objects with new Symbol IDs.
 * @param {{ name: string, priority?: number, timeSlots?: TimeSlot[] }[]} data
 * @returns {User[]}
 */
function importUsersData(data) {
  if (!Array.isArray(data)) {
    throw new Error("importUsersData expected an array");
  }
  return data.map((u) => ({
    id: Symbol(`User:${u.name}`),
    name: String(u.name ?? "").trim() || "Unnamed",
    priority: typeof u.priority === "number" && u.priority > 0 ? u.priority : 1,
    timeSlots: Array.isArray(u.timeSlots) ? u.timeSlots : [],
  }));
}

export { context, eventBus, exportUsersData, importUsersData };
