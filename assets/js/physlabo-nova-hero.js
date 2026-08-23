/**
 * physLabo — NOVA CREATIVE 風オープニング（ローダー → ヒーロー表示）
 */
(function () {
  "use strict";

  var LOADER_MS = 1800;
  var loader = document.getElementById("novaLoader");
  var hero = document.getElementById("hero");

  if (!loader) {
    if (hero) hero.classList.add("is-ready");
    return;
  }

  document.body.classList.add("is-nova-loading");

  window.setTimeout(function () {
    loader.classList.add("is-hidden");
    loader.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-nova-loading");
    document.documentElement.classList.add("is-hero-ready");
    if (hero) hero.classList.add("is-ready");
  }, LOADER_MS);
})();
