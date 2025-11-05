import { context, eventBus } from "./context.js";

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

  return itemElement;
}

function createUser() {
  const input = document.getElementById("create-user-input");
  const feedback = document.getElementById("create-user-feedback");

  const name = input.value.trim();
  if (!name) {
    feedback.textContent = "Please enter a name.";
    return;
  }

  if (context.users.length === 0) {
    document.querySelector(".no-users-message").classList.add("hidden");
  }

  const id = Symbol(`User:${name}`);
  const listItemHTML = createUserListItem(name, id);
  document.querySelector("ul.user-list").appendChild(listItemHTML);

  input.value = "";
  feedback.textContent = "User created successfully.";

  eventBus.addUser({ id, name, timeSlots: [] });
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
  });

  document
    .querySelector(".create-user-section > button.create")
    .addEventListener("click", createUser);

  document
    .getElementById("meeting-length-input")
    .addEventListener("change", (e) => {
      const value = parseInt(e.target.value, 10);
      if (isNaN(value) || value <= 0) {
        e.target.value = context.meeting_length_minutes;
        return;
      }
      context.meeting_length_minutes = value;
    });
}

export { initUserSideBar };
