import { submitAvailability } from "./api.js";
import { context, eventBus } from "./context.js";
import { initUserSideBar } from "./user_side_bar.js";
import { initializeSchedule } from "./schedule.js";
import { flashMessage } from "./flash.js";

initUserSideBar();
initializeSchedule();

document
  .querySelector("main.main-content header div.header-bar button.generate")
  .addEventListener("click", async () => {
    const users = context.users;
    const meeting_length_minutes = context.meeting_length_minutes;

    if (users.length === 0) {
      flashMessage("No users to generate meeting for.", "error");
      return;
    }

    try {
      const response = await submitAvailability(users, meeting_length_minutes);

      flashMessage("Meeting suggestions generated!", "success");

      const resultsWindow = window.open("/results", "_blank");
      if (resultsWindow) {
        resultsWindow.onload = function () {
          resultsWindow.postMessage(response, window.location.origin);
        };
      }
    } catch (error) {
      flashMessage(error.detail, "error", error.status, error.message);
      return;
    }
  });

eventBus.addEventListener("selectedUser:selected", () => {
  const selectionState = context.selectedUserId === null;
  document.querySelector(".main-content").classList.toggle("no-user-selected", selectionState);
  if (selectionState) return;
  const input_name = document.getElementById("user-name");
  const input_priority = document.getElementById("user-priority");
  const selectedUser = context.users.find((u) => u.id === context.selectedUserId);

  input_name.value = selectedUser.name;
  input_priority.value = selectedUser.priority;
});

const userControlSelector = ".main-content > header > .user-control";
document.querySelector(userControlSelector + " > button.save").addEventListener("click", () => {
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
