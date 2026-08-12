/**
 * physLabo — タッチ端末でも PC 同等レイアウト
 * 初回 viewport は各 HTML の inline script が設定。こちらは向き変更・Hero 遷移のみ担当。
 */
(function () {
  "use strict";

  var DESIGN_W = 1180;
  var DEVICE_VIEWPORT =
    "width=device-width,initial-scale=1.0,viewport-fit=cover";
  var meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;

  document.documentElement.classList.add("physlabo-unified-layout");

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  function normalizeVp(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function isTopChaptersPage() {
    return !!document.querySelector(".page-wrap > nav.card-grid");
  }

  function shouldScaleViewport() {
    var html = document.documentElement;
    if (html.classList.contains("hero-landing")) return false;
    if (html.classList.contains("hero-transition-active")) return false;
    if (html.getAttribute("data-vp") === "device") return false;
    if (isTopChaptersPage()) return false;
    return true;
  }

  function screenWidth() {
    return window.innerWidth || document.documentElement.clientWidth || DESIGN_W;
  }

  function viewportContent(vw) {
    if (!shouldScaleViewport() || vw >= DESIGN_W) {
      return DEVICE_VIEWPORT;
    }
    var scale = Math.min(1, vw / DESIGN_W);
    return (
      "width=" +
      DESIGN_W +
      ",initial-scale=" +
      scale.toFixed(4) +
      ",minimum-scale=" +
      Math.max(0.2, scale * 0.45).toFixed(4) +
      ",maximum-scale=5,user-scalable=yes,viewport-fit=cover"
    );
  }

  function resetPageScroll() {
    var docW = Math.max(
      document.documentElement.scrollWidth,
      document.body ? document.body.scrollWidth : 0
    );
    var viewW = window.innerWidth || document.documentElement.clientWidth;
    var x = 0;
    if (docW > viewW + 2) {
      x = Math.max(0, Math.round((docW - viewW) / 2));
    }
    window.scrollTo(x, window.scrollY || 0);
    document.documentElement.scrollLeft = x;
    if (document.body) document.body.scrollLeft = x;
  }

  function applyViewport() {
    var next = viewportContent(screenWidth());
    if (normalizeVp(meta.getAttribute("content")) === normalizeVp(next)) {
      resetPageScroll();
      return false;
    }
    meta.setAttribute("content", next);
    resetPageScroll();
    return true;
  }

  function notifyResize() {
    window.clearTimeout(notifyResize._t);
    notifyResize._t = window.setTimeout(function () {
      window.dispatchEvent(new Event("resize"));
    }, 120);
  }

  function refreshViewport() {
    if (applyViewport()) notifyResize();
    else resetPageScroll();
  }

  var lastInnerW = screenWidth();
  resetPageScroll();

  window.addEventListener("orientationchange", function () {
    window.setTimeout(function () {
      refreshViewport();
      lastInnerW = screenWidth();
    }, 180);
  });

  window.addEventListener(
    "resize",
    function () {
      if (document.readyState !== "complete") return;
      if (!shouldScaleViewport()) return;
      var w = screenWidth();
      if (Math.abs(w - lastInnerW) < 2) return;
      lastInnerW = w;
      window.clearTimeout(applyViewport._t);
      applyViewport._t = window.setTimeout(refreshViewport, 80);
    },
    { passive: true }
  );

  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      lastInnerW = screenWidth();
      refreshViewport();
    }
  });

  window.addEventListener("physlabo-viewport-refresh", function () {
    lastInnerW = screenWidth();
    refreshViewport();
  });

  window.physlaboApplyViewport = function () {
    lastInnerW = screenWidth();
    refreshViewport();
  };
})();
