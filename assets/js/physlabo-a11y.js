/**
 * physLabo — アクセシビリティ補助（canvas ラベル · 低モーション）
 */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (REDUCED) {
    document.documentElement.classList.add("physlabo-reduced-motion");
  }

  function simLabel() {
    var h2 = document.querySelector(".page-header h2, header h2, .folder-hero h1");
    if (h2 && h2.textContent.trim()) return h2.textContent.trim();
    var t = document.title || "";
    return t.replace(/\s*[—–-].*$/, "").trim() || "物理シミュレーション";
  }

  function labelCanvases() {
    var base = simLabel();
    var canvases = document.querySelectorAll(
      'canvas:not([aria-hidden="true"]):not([aria-label])'
    );
    canvases.forEach(function (canvas, i) {
      if (canvas.id === "bgCanvas") return;
      var label = base;
      if (canvases.length > 1) label += "（表示 " + (i + 1) + "）";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", label);
    });
  }

  function enhanceToggleButtons() {
    document.querySelectorAll(".toggle-btn:not([aria-pressed])").forEach(function (btn) {
      btn.setAttribute("aria-pressed", btn.classList.contains("is-active") ? "true" : "false");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      labelCanvases();
      enhanceToggleButtons();
    });
  } else {
    labelCanvases();
    enhanceToggleButtons();
  }

  window.PhysLaboA11y = { REDUCED: REDUCED };
})();
