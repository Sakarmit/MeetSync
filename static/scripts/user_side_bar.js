import { context, eventBus, exportUsersData, importUsersData } from "./context.js";
import { flashMessage } from "./flash.js";
import { scheduleSavedStateHandler } from "./schedule.js";

/**
 * Handler for the `beforeunload` event to prompt the user about unsaved changes.
 * @param {BeforeUnloadEvent} e - The beforeunload event object.
 */
function beforeUnloadHandler(e) {
  e.preventDefault();
}

/**
 * Create a user list item element from the template.
 * @param {string} name - Name of the user.
 * @param {Symbol} id - ID of the user.
 * @returns {DocumentFragment} - The user list item element.
 */
function createUserListItem(name, id) {
  const templateSelector = "ul.user-list > template";
  const itemElement = document.querySelector(templateSelector).content.cloneNode(true);

  itemElement.querySelector(".name").textContent = name;
  itemElement.querySelector("button.select").addEventListener("click", () => {
    if (!scheduleSavedStateHandler()) return;
    eventBus.selectUser(id);
  });
  itemElement.querySelector("img.delete").addEventListener("click", (e) => {
    e.stopPropagation();

    if (document.getElementById("confirm-deletion").checked) {
      let confirmDelete = window.confirm(
        `Are you sure you want to delete user "${name}"? This action cannot be undone.`
      );
      if (!confirmDelete) {
        return;
      }
    }

    flashMessage(`User "${name}" deleted.`, "success");
    e.target.parentElement.parentElement.remove();
    if (context.users.length - 1 === 0) {
      document.querySelector(".no-users-message")?.classList.remove("hidden");
      document.querySelector("button.generate")?.classList.add("hidden");
    }
    eventBus.deleteUser(id);
  });

  return itemElement;
}

function createUser() {
  const input = document.getElementById("create-user-input");
  const name = input.value.trim();
  if (!name) {
    flashMessage("User's name cannot be empty.", "error");
    return;
  }

  if (context.users.find((u) => u.name === name)) {
    flashMessage("User's name must be unique.", "error");
    return;
  }

  if (context.users.length === 0) {
    document.querySelector(".no-users-message")?.classList.add("hidden");
    document.querySelector("button.generate")?.classList.remove("hidden");
  }

  const id = Symbol(`User:${name}`);
  const listItemHTML = createUserListItem(name, id);
  document.querySelector("ul.user-list").appendChild(listItemHTML);

  input.value = "";
  flashMessage("User created successfully.", "success");

  eventBus.addUser({ id, name, timeSlots: [], priority: 1 });
}

function updateUserListSelection() {
  document
    .querySelectorAll("ul.user-list > li.item.active")
    .forEach((li) => li.classList.remove("active"));
  if (context.selectedUserId === null) return;
  const idx = context.users.findIndex((u) => u.id === context.selectedUserId);
  if (idx !== -1) {
    const listItems = document.querySelectorAll("ul.user-list > li.item");
    const selectedItem = listItems[idx];
    if (selectedItem) selectedItem.classList.add("active");
  }
}

function initUserSideBar() {
  eventBus.addEventListener("users:updated", () => {
    if (context.users.length > 0) {
      window.addEventListener("beforeunload", beforeUnloadHandler);
    } else {
      window.removeEventListener("beforeunload", beforeUnloadHandler);
    }
  });

  eventBus.addEventListener("selectedUser:updated", () => {
    const idx = context.users.findIndex((u) => u.id === context.selectedUserId);
    const listItems = document.querySelectorAll("ul.user-list > li:not(.no-users-message)");
    const listItem = listItems[idx];

    listItem.querySelector(".name").textContent = context.users[idx].name;
    updateUserListSelection();
  });
  eventBus.addEventListener("selectedUser:selected", updateUserListSelection);

  const createUserButton = document.querySelector(
    ".create-user-section > .user-buttons > button.create"
  );
  createUserButton.addEventListener("click", () => {
    if (!scheduleSavedStateHandler()) return;
    createUser();
  });

  const createUserInput = document.getElementById("create-user-input");
  createUserInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") createUser();
  });

  document.getElementById("meeting-length-input").addEventListener("change", (e) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value <= 0) {
      e.target.value = context.meeting_length_minutes;
      return;
    }
    context.meeting_length_minutes = value;
  });

  let times = [];
  for (let i = 0; i < 24 * 60; i += 15) {
    const timeString = minutesToTimeString(i);
    times.push(`<option value="${timeString}">${timeString}</option>`);
  }
  document.querySelector("#restriction-range-start").innerHTML = times.join("");
  times.push(`<option value="24:00">24:00</option>`);
  document.querySelector("#restriction-range-end").innerHTML = times.join("");
  document.querySelector("#restriction-range-end").value = "24:00";
}

/**
 * Helper: convert minutes-from-midnight to 24h time string.
 * @param {number} totalMinutes
 * @returns {string}
 */
function minutesToTimeString(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hh = String(hours24).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Download current users as a JSON file.
 */
function exportUsersToFile(filename = "meetsync-users.json") {
  const data = exportUsersData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
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

document.getElementById("export-users").addEventListener("click", () => {
  exportUsersToFile();
});

/**
 * Import users from a parsed array and optionally clear existing users.
 * @param {{ name: string, priority?: number, timeSlots?: any[] }[]} rawUsers
 * @param {boolean} clearExisting
 */
function importUsersFromArray(rawUsers, clearExisting = false) {
  if (!Array.isArray(rawUsers)) {
    flashMessage("Imported data is not an array of users.", "error");
    return;
  }

  if (clearExisting) {
    // Clear context users & selection
    context.users.length = 0;
    context.selectedUserId = null;

    // Remove all user list items except the "no users" message
    document
      .querySelectorAll("ul.user-list > li:not(.no-users-message)")
      .forEach((v) => v.remove());

    document.querySelector(".no-users-message")?.classList.remove("hidden");
    document.querySelector("button.generate")?.classList.add("hidden");

    eventBus.dispatchEvent(new Event("users:updated"));
  }

  const preparedUsers = importUsersData(rawUsers);

  document.querySelector(".no-users-message")?.classList.add("hidden");
  document.querySelector("button.generate")?.classList.remove("hidden");

  preparedUsers.forEach((user) => {
    const listItemHTML = createUserListItem(user.name, user.id);
    list.appendChild(listItemHTML);
    eventBus.addUser(user);
  });

  flashMessage(`Imported ${preparedUsers.length} user(s).`, "success");
}

/**
 * Import users from a JSON file chosen via <input type="file">.
 * Prompts whether to clear existing users if any are present.
 * @param {File} file
 */
function importUsersFromFile(file) {
  const clearExisting =
    context.users.length > 0
      ? window.confirm(
          "Delete users already in list? \nClick OK to clear all before importing. \nClick Cancel to keep existing users."
        )
      : false;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = String(e.target.result || "");
      const raw = JSON.parse(text);
      importUsersFromArray(raw, clearExisting);
    } catch (err) {
      console.error(err);
      flashMessage("Failed to read imported users file.", "error");
    }
  };
  reader.readAsText(file);
}

document.getElementById("import-users").addEventListener("click", (e) => {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json";
  fileInput.style.display = "none";

  fileInput.addEventListener("change", (event) => {
    const target = event.target;
    if (target.files && target.files.length > 0) {
      importUsersFromFile(target.files[0]);
    }
  });

  document.body.appendChild(fileInput);
  fileInput.click();
  document.body.removeChild(fileInput);
});

export { initUserSideBar };
