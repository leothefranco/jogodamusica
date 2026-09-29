const params = new URLSearchParams(location.search);
let selected = iconOptions.some((o) => o.id === params.get("icon"))
  ? params.get("icon")
  : "01";
let mode = ["color", "lime", "white"].includes(params.get("mode"))
  ? params.get("mode")
  : "color";
document.getElementById("original").innerHTML = iconSvg("original");
function update() {
  document.getElementById("options").innerHTML = iconOptions
    .map(
      (o) =>
        `<button class="option ${o.id === selected ? "selected" : ""}" data-icon="${o.id}" aria-pressed="${o.id === selected}"><span class="option-head"><b>${o.id}</b><span>${o.tag}</span></span><div class="icon-stage">${iconSvg(o.id, { mode })}</div><h2>${o.name}</h2><p>${o.description}</p><div class="card-footer"><span class="tiny-icons">${iconSvg(o.id, { size: 16, mode })}${iconSvg(o.id, { size: 24, mode })}${iconSvg(o.id, { size: 32, mode })}</span><span>${o.id === selected ? "EM PRÉVIA ↓" : "Ver aplicação ↗"}</span></div></button>`,
    )
    .join("");
  const option = iconOptions.find((o) => o.id === selected);
  document.getElementById("selected-title").textContent =
    `${option.id} / ${option.name}`;
  document.getElementById("selected-concept").textContent = option.concept;
  document.getElementById("header-icon").innerHTML = iconSvg(selected, {
    size: 48,
    mode,
  });
  document.getElementById("size-row").innerHTML = [16, 32, 64, 128]
    .map(
      (size) =>
        `<div class="size-item">${iconSvg(selected, { size, mode })}<small>${size} px</small></div>`,
    )
    .join("");
  document.getElementById("light-preview").innerHTML = iconSvg(selected, {
    size: 83,
    mode: "ink",
    tile: false,
  });
  document.getElementById("mono-preview").innerHTML = iconSvg(selected, {
    size: 83,
    mode: "white",
    tile: false,
  });
  const suffix = mode === "color" ? "" : `-${mode}`;
  document.getElementById("download-svg").href =
    `svg/icon-${selected}${suffix}.svg`;
  document.getElementById("download-mark").href =
    `svg/mark-${selected}${suffix}.svg`;
  document.getElementById("download-png").href =
    `png/icon-${selected}${suffix}-512.png`;
  document.querySelectorAll("[data-mode]").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
    b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
  });
  history.replaceState(null, "", `?icon=${selected}&mode=${mode}`);
}
document.addEventListener("click", (e) => {
  const icon = e.target.closest("[data-icon]"),
    color = e.target.closest("[data-mode]");
  if (icon) {
    selected = icon.dataset.icon;
    update();
    document
      .getElementById("application")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (color) {
    mode = color.dataset.mode;
    update();
  }
});
update();
