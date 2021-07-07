import { inspect } from "@xstate/inspect";
if (import.meta.env.DEV || window.location.search.includes("debug")) {
  const container = document.createElement("div");
  container.setAttribute(
    "style",
    "height: 100vh; width: 100vw; position: fixed; top: 0; left: 0;"
  );
  container.hidden = true;

  const button = document.createElement("button");
  button.setAttribute(
    "style",
    "position: absolute; top: 0; right:0; background: white; border: 2px solid blue; color: black; padding: 8px; line-height: 1;"
  );
  button.textContent = "X";

  container.appendChild(button);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-xstate", "");
  iframe.setAttribute("style", "height: 100%; width: 100%");
  container.appendChild(iframe);

  document.body.appendChild(container);

  button.addEventListener("click", () => {
    container.hidden = true;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "k" && e.metaKey) {
      container.hidden = !container.hidden;
      button.focus();
    }
  });
  inspect();
}
export {};
