/**
 * physLabo HP — ライト / シミュ風テーマ切替
 */
(function () {
  "use strict";

  var STORAGE_KEY = "physlabo-landing-theme";
  var btn = document.getElementById("themeToggle");
  var label = document.querySelector("[data-theme-label]");

  function getTheme() {
    return document.documentElement.getAttribute("data-landing-theme") === "light"
      ? "light"
      : "sim";
  }

  function updateButton() {
    if (!btn) return;
    var theme = getTheme();
    if (theme === "sim") {
      btn.setAttribute("aria-pressed", "true");
      btn.setAttribute("aria-label", "ライト表示（以前のデザイン）に切り替え");
      if (label) label.textContent = "ライト";
    } else {
      btn.setAttribute("aria-pressed", "false");
      btn.setAttribute("aria-label", "シミュレーション風表示に切り替え");
      if (label) label.textContent = "シミュ";
    }
  }

  function setTheme(next) {
    if (next !== "light" && next !== "sim") return;
    document.documentElement.setAttribute("data-landing-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {}
    updateButton();
  }

  if (btn) {
    btn.addEventListener("click", function () {
      setTheme(getTheme() === "sim" ? "light" : "sim");
    });
    updateButton();
  }

  window.physLaboLandingTheme = {
    get: getTheme,
    set: setTheme
  };
})();
