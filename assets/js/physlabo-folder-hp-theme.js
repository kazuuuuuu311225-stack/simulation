/**
 * 分野フォルダ — HP テーマ切替（HP と同じ localStorage）
 */
(function () {
  "use strict";

  var STORAGE_KEY = "physlabo-landing-theme";
  var btn = document.getElementById("folderThemeToggle");
  var label = document.querySelector("[data-theme-label]");

  function getTheme() {
    return document.documentElement.getAttribute("data-folder-hp-theme") === "light"
      ? "light"
      : "sim";
  }

  function updateButton() {
    if (!btn) return;
    var theme = getTheme();
    if (theme === "sim") {
      btn.setAttribute("aria-label", "ライト表示（以前のデザイン）に切り替え");
      if (label) label.textContent = "ライト";
    } else {
      btn.setAttribute("aria-label", "シミュレーション風表示に切り替え");
      if (label) label.textContent = "シミュ";
    }
  }

  function setTheme(next) {
    if (next !== "light" && next !== "sim") return;
    document.documentElement.setAttribute("data-folder-hp-theme", next);
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
})();
