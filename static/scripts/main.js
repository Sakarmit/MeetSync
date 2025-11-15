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

    const dayStart = document.getElementById("restriction-range-start").value;
    const dayEnd = document.getElementById("restriction-range-end").value;
    if (parseInt(dayStart.replace(":", "")) >= parseInt(dayEnd.replace(":", ""))) {
      document.getElementById("work-hours-restriction").classList.add("error");
      flashMessage("Invalid time range selected.", "error");
      return;
    } else if (parseInt(dayEnd.replace(":", "")) - parseInt(dayStart.replace(":", "")) < meeting_length_minutes) {
      document.getElementById("work-hours-restriction").classList.add("error");
      flashMessage(
        "The selected time range is too small for the meeting length.",
        "error"
      );
      return;
    } else {
      document.getElementById("work-hours-restriction").classList.remove("error");
    }

    try {
      const response = await submitAvailability(users, meeting_length_minutes, dayStart, dayEnd);

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

const userNameInput = document.getElementById("user-name");
userNameInput.addEventListener("change", () => {
  const newName = userNameInput.value.trim();
  if (!newName) {
    flashMessage("User's name cannot be empty.", "error");
    return;
  }

  eventBus.updateSelectedUser({ name: newName });
  flashMessage("User's name updated successfully.", "success");
});

const userPriorityInput = document.getElementById("user-priority");
userPriorityInput.addEventListener("change", () => {
  const newPriority = parseInt(userPriorityInput.value.trim(), 10);
  if (isNaN(newPriority) || newPriority <= 0) {
    flashMessage("Priority must be a positive integer.", "error");
    return;
  }

  eventBus.updateSelectedUser({ priority: newPriority });
  flashMessage("User's priority updated successfully.", "success");
});
