import { context, eventBus, exportUsersData, importUsersData } from "./context.js";
import { flashMessage } from "./flash.js";

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
  itemElement
    .querySelector("button.select")
    .addEventListener("click", () => eventBus.selectUser(id));
  itemElement.querySelector("img.delete").addEventListener("click", (e) => {
    e.stopPropagation();
    flashMessage(`User "${name}" deleted.`, "success");
    e.target.parentElement.parentElement.remove();
    if (context.users.length - 1 === 0) {
      document.querySelector(".no-users-message").classList.remove("hidden");
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
    document.querySelector(".no-users-message").classList.add("hidden");
  }

  const id = Symbol(`User:${name}`);
  const listItemHTML = createUserListItem(name, id);
  document.querySelector("ul.user-list").appendChild(listItemHTML);

  input.value = "";
  flashMessage("User created successfully.", "success");

  eventBus.addUser({ id, name, timeSlots: [], priority: 1 });
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
    if (context.selectedUserId === null) {
      document.querySelector(".main-content").classList.add("no-user-selected");
      return;
    }

    const idx = context.users.findIndex((u) => u.id === context.selectedUserId);
    const listItems = document.querySelectorAll("ul.user-list > li:not(.no-users-message)");
    const listItem = listItems[idx];

    listItem.querySelector(".name").textContent = context.users[idx].name;
  });

  const createUserInput = document.querySelector(".create-user-section > button.create");
  createUserInput.addEventListener("click", createUser);

  document.getElementById("meeting-length-input").addEventListener("change", (e) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value) || value <= 0) {
      e.target.value = context.meeting_length_minutes;
      return;
    }
    context.meeting_length_minutes = value;
  });
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

    const msg = document.querySelector(".no-users-message");
    if (msg) msg.classList.remove("hidden");

    eventBus.dispatchEvent(new Event("users:updated"));
  }

  const preparedUsers = importUsersData(rawUsers);

  const list = document.querySelector("ul.user-list");
  const noUsersMsg = document.querySelector(".no-users-message");
  if (noUsersMsg) {
    noUsersMsg.classList.add("hidden");
  }

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
          "Replace existing users with imported users? Click OK to clear current users."
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

export { initUserSideBar, exportUsersToFile, importUsersFromArray, importUsersFromFile };
