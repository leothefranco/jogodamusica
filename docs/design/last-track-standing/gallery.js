const params = new URLSearchParams(location.search);
let screen = screens.some((s) => s.id === params.get("screen"))
  ? params.get("screen")
  : "home";
let identity = identities[params.get("identity")]
  ? params.get("identity")
  : "c";
let device = params.get("device") === "mobile" ? "mobile" : "desktop";
let compare = params.get("compare") === "1";
const nav = document.getElementById("screen-nav");
let lastGroup = "";
screens.forEach((s, i) => {
  if (s.group !== lastGroup) {
    nav.insertAdjacentHTML("beforeend", `<p class="nav-group">${s.group}</p>`);
    lastGroup = s.group;
  }
  nav.insertAdjacentHTML(
    "beforeend",
    `<button class="screen-link" data-screen="${s.id}"><span class="screen-number">${String(i + 1).padStart(2, "0")}</span>${s.title}</button>`,
  );
});
function frameUrl(k) {
  return `screen.html?identity=${k}&screen=${screen}`;
}
function render() {
  const info = screens.find((s) => s.id === screen);
  document.getElementById("screen-title").textContent = info.title;
  document.getElementById("screen-route").textContent = info.route;
  document.getElementById("screen-note").textContent = info.note;
  document.getElementById("direct").href = frameUrl(identity);
  document.getElementById("coverage").textContent =
    `${screens.length} telas e estados × 3 identidades · desktop e mobile`;
  document.querySelectorAll("[data-screen]").forEach((e) => {
    e.classList.toggle("active", e.dataset.screen === screen);
    e.setAttribute(
      "aria-current",
      e.dataset.screen === screen ? "page" : "false",
    );
  });
  document.querySelectorAll("[data-identity]").forEach((e) => {
    e.classList.toggle("active", e.dataset.identity === identity);
    e.setAttribute("aria-pressed", String(e.dataset.identity === identity));
  });
  document.querySelectorAll("[data-device]").forEach((e) => {
    e.classList.toggle("active", e.dataset.device === device);
    e.setAttribute("aria-pressed", String(e.dataset.device === device));
  });
  document.getElementById("compare").classList.toggle("active", compare);
  document
    .getElementById("compare")
    .setAttribute("aria-pressed", String(compare));
  const frames = document.getElementById("frames");
  frames.className = `frames ${device} ${compare ? "compare" : ""}`;
  frames.innerHTML = (compare ? ["a", "b", "c"] : [identity])
    .map(
      (k) =>
        `<article class="frame-card"><div class="frame-heading"><span>${k.toUpperCase()} / ${identities[k].name}</span><span><a href="exports/${k}/${device}/${screen}.png" target="_blank" rel="noopener">PNG ↗</a> &nbsp; <a href="${frameUrl(k)}" target="_blank" rel="noopener">Ampliar ↗</a></span></div><div class="scaled-viewport"><iframe title="${info.title} — ${identities[k].name}" src="${frameUrl(k)}"></iframe></div></article>`,
    )
    .join("");
  history.replaceState(
    null,
    "",
    `?screen=${screen}&identity=${identity}&device=${device}&compare=${Number(compare)}`,
  );
  resizeFrames();
}
function resizeFrames() {
  document.querySelectorAll(".scaled-viewport").forEach((w) => {
    const f = w.querySelector("iframe");
    if (compare && device === "desktop") {
      let scale = w.clientWidth / 1280;
      f.style.transform = `scale(${scale})`;
      w.style.height = `${1040 * scale}px`;
    } else {
      f.style.transform = "";
      w.style.height = "";
    }
  });
}
document.addEventListener("click", (e) => {
  const s = e.target.closest("[data-screen]"),
    k = e.target.closest("[data-identity]"),
    d = e.target.closest("[data-device]");
  if (s) {
    screen = s.dataset.screen;
    render();
  }
  if (k) {
    identity = k.dataset.identity;
    render();
  }
  if (d) {
    device = d.dataset.device;
    render();
  }
});
document.getElementById("compare").onclick = () => {
  compare = !compare;
  render();
};
window.addEventListener("resize", resizeFrames);
window.addEventListener("message", (e) => {
  if (e.origin !== location.origin && location.protocol !== "file:") return;
  if (
    ![...document.querySelectorAll("iframe")].some(
      (f) => f.contentWindow === e.source,
    )
  )
    return;
  if (
    e.data?.type === "navigate" &&
    screens.some((s) => s.id === e.data.screen)
  ) {
    screen = e.data.screen;
    render();
  }
});
document.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) ||
    !["ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  e.preventDefault();
  screen =
    screens[
      (screens.findIndex((s) => s.id === screen) +
        (e.key === "ArrowRight" ? 1 : -1) +
        screens.length) %
        screens.length
    ].id;
  render();
});
render();
