/**
 * Display a flash message.
 * @param {string} msg
 * @param {'success'|'error'} type
 * @param {number} status
 * @param {string} errType
 */
function flashMessage(msg = "No details", type = "success", status = "", errType = "") {
  const container = document.getElementById(`flash-messages`);
  container.querySelector(".alert")?.remove();

  const template = container.querySelector("template");
  const alert = template.content.cloneNode(true).querySelector(".alert");

  alert.className = `alert alert-${type}`;
  alert.querySelector(".alert-icon").src = `/static/styles/images/${type}.png`;
  alert.querySelector("strong").textContent = `${type.toUpperCase()} ${status} ${errType}`;
  alert.querySelector("span").textContent = msg;
  alert.querySelector(".alert-close").addEventListener("click", () => {
    alert.style.opacity = "0";
    alert.addEventListener(
      "transitionend",
      (event) => {
        if (event.propertyName === "opacity") {
          alert.remove();
        }
      },
      { once: true }
    );
  });

  container.appendChild(alert);

  if (type == "success") {
    setTimeout(() => {
      alert.style.opacity = "0";
      alert.addEventListener(
        "transitionend",
        (event) => {
          if (event.propertyName === "opacity") {
            alert.remove();
          }
        },
        { once: true }
      );
    }, 3000);
  }
}

export { flashMessage };
