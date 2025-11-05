import { submitAvailability } from "./api.js";
import { context, eventBus } from "./context.js";
import { initUserSideBar } from "./user_side_bar.js";
import { initializeSchedule, SUBMIT_BUTTON_SELECTOR } from "./schedule.js";

initUserSideBar();
initializeSchedule();

document.querySelector(SUBMIT_BUTTON_SELECTOR).addEventListener("click", async () => {
  const users = context.users;
  const meeting_length_minutes = context.meeting_length_minutes;

  try {
    const response = await submitAvailability(users, meeting_length_minutes);
    console.log("Server response:", response);
  } catch (error) {
    console.error("Error submitting availability:", error);
    return;
  }
});

eventBus.addEventListener("selectedUser:selected", () => {
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

  if (newName) {
    eventBus.updateSelectedUser({ name: newName, priority: newPriority });
  }
});
