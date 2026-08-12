(function () {
  var DESIGN_W = 1180;
  var meta = document.querySelector("meta[name=viewport]");
  if (!meta) return;

  var html = document.documentElement;
  html.classList.add("physlabo-unified-layout");

  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  if (
    html.classList.contains("hero-landing") ||
    html.classList.contains("hero-transition-active") ||
    html.getAttribute("data-vp") === "device"
  ) {
    return;
  }

  var vw =
    window.innerWidth || document.documentElement.clientWidth || DESIGN_W;
  if (vw >= DESIGN_W) return;

  var scale = Math.min(1, vw / DESIGN_W);
  meta.setAttribute(
    "content",
    "width=" +
      DESIGN_W +
      ",initial-scale=" +
      scale.toFixed(4) +
      ",minimum-scale=" +
      Math.max(0.2, scale * 0.45).toFixed(4) +
      ",maximum-scale=5,user-scalable=yes,viewport-fit=cover"
  );
})();
