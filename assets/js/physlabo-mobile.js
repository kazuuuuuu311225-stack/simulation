/**
 * physLabo — スマホ・タブレットでも PC と同じ画面幅・レイアウトで表示
 */
(function () {
  "use strict";

  var DESIGN_W = 1180;
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  document.documentElement.classList.add("physlabo-unified-layout");

  function layoutWidth() {
    if (window.visualViewport && window.visualViewport.width > 0) {
      return window.visualViewport.width;
    }
    return window.innerWidth || document.documentElement.clientWidth || DESIGN_W;
  }

  function applyViewport() {
    var vw = layoutWidth();
    if (vw >= DESIGN_W) {
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1.0, viewport-fit=cover"
      );
      document.documentElement.style.removeProperty("--physlabo-scale");
      return;
    }

    var scale = Math.min(1, vw / DESIGN_W);
    document.documentElement.style.setProperty("--physlabo-scale", scale.toFixed(4));
    meta.setAttribute(
      "content",
      "width=" +
        DESIGN_W +
        ", initial-scale=" +
        scale.toFixed(4) +
        ", minimum-scale=" +
        Math.max(0.2, scale * 0.45).toFixed(4) +
        ", maximum-scale=5, user-scalable=yes, viewport-fit=cover"
    );
  }

  function notifyResize() {
    window.clearTimeout(notifyResize._t);
    notifyResize._t = window.setTimeout(function () {
      window.dispatchEvent(new Event("resize"));
    }, 120);
  }

  applyViewport();
  notifyResize();

  window.addEventListener("orientationchange", function () {
    window.setTimeout(function () {
      applyViewport();
      notifyResize();
    }, 180);
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", function () {
      window.clearTimeout(applyViewport._t);
      applyViewport._t = window.setTimeout(function () {
        applyViewport();
        notifyResize();
      }, 80);
    });
  }

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      applyViewport();
      notifyResize();
    }
  });
})();
