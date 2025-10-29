import { submitAvailability } from "./api.js";
import { context, eventBus } from "./context.js";
import { initUserSideBar } from "./user_side_bar.js";
import { initializeSchedule, SUBMIT_BUTTON_SELECTOR } from "./schedule.js";

initUserSideBar();
initializeSchedule();

document.querySelector(SUBMIT_BUTTON_SELECTOR).addEventListener("click", async () => {
  const users = context.users;

  try {
    const response = await submitAvailability(users);
    console.log("Server response:", response);
  } catch (error) {
    console.error("Error submitting availability:", error);
    return;
  }
});

eventBus.addEventListener("selectedUser:selected", () => {
  const input = document.getElementById("user-name");
  const selectedUser = context.users.find((u) => u.id === context.selectedUserId);

  input.value = selectedUser.name;
});

const userNameControlSelector = ".main-content > header > .user-name-control";
document.querySelector(userNameControlSelector + " > button.save").addEventListener("click", () => {
  const userNameInput = document.getElementById("user-name");
  const newName = userNameInput.value.trim();

  if (newName) {
    eventBus.updateSelectedUser({ name: newName });
  }
});
