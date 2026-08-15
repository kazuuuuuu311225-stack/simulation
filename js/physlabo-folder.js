/**
 * physLabo 分野フォルダ — アコーディオン・シミュ数カウント・背景
 */
(function () {
  "use strict";

  function initAccordion() {
    document.querySelectorAll(".chapter-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var chapter = btn.closest(".chapter");
        if (!chapter) return;
        var open = chapter.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
  }

  function setAllChapters(open) {
    var list = document.querySelector(".chapter-list");
    document.querySelectorAll(".chapter").forEach(function (ch) {
      ch.classList.toggle("is-open", open);
      var ct = ch.querySelector(".chapter-toggle");
      if (ct) ct.setAttribute("aria-expanded", open ? "true" : "false");
    });
    if (list) list.classList.toggle("is-all-open", open);
  }

  function updateSimCount() {
    var links = document.querySelectorAll(".page-wrap .menu-link");
    var count = links.length;
    var el = document.querySelector("[data-sim-count]");
    if (el) {
      el.innerHTML = "全 <strong>" + count + "</strong> シミュレーション";
    }
  }

  function openFromHash() {
    var hash = location.hash.slice(1);
    if (!hash) return;
    var target = document.getElementById(hash);
    if (!target) return;
    var chapter = target.closest(".chapter") ||
      (target.classList.contains("chapter") ? target : null);
    if (chapter) {
      chapter.classList.add("is-open");
      var ct = chapter.querySelector(".chapter-toggle");
      if (ct) ct.setAttribute("aria-expanded", "true");
    }
    requestAnimationFrame(function () {
      (chapter || target).scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  var expandBtn = document.getElementById("expandAll");
  var collapseBtn = document.getElementById("collapseAll");
  if (expandBtn) expandBtn.addEventListener("click", function () { setAllChapters(true); });
  if (collapseBtn) collapseBtn.addEventListener("click", function () { setAllChapters(false); });

  initAccordion();
  updateSimCount();
  openFromHash();
  window.addEventListener("hashchange", openFromHash);

  if (window.PhysLaboBg) window.PhysLaboBg.init("bgCanvas");
})();
