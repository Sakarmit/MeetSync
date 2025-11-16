const popupOverlay = document.querySelector("main.main-content .popup-overlay");

/**
 * Display a popup message and wait for user choice.
 * @param {string} msg
 * @param {Array<{ label: string, className?: "confirm"|"warning"|"destructive" }>} buttons
 * @returns {Promise<any>} resolves with the label of the button pressed
 */
function popupMessage(msg, buttons = [{ label: "Confirm", className: "confirm" }]) {
  popupOverlay.querySelector(".popup-message span").textContent = msg;

  const choices = popupOverlay.querySelector(".choices");
  choices.innerHTML = "";

  let resolveFn;
  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });

  buttons.push({ label: "Cancel", className: "cancel" });
  buttons.forEach(({ label, className }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    if (className) btn.classList.add(className);
    btn.addEventListener("click", () => {
      popupOverlay.classList.add("hidden");
      resolveFn(label);
    });
    choices.appendChild(btn);
  });

  popupOverlay.classList.remove("hidden");

  popupOverlay.addEventListener("click", function onOverlayClick(e) {
    if (e.target === popupOverlay) {
      popupOverlay.classList.add("hidden");
      resolveFn("Cancel");
      popupOverlay.removeEventListener("click", onOverlayClick);
    }
  });

  return promise;
}

export { popupMessage };
