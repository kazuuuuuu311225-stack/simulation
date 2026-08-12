/**
 * physLabo ランディング — NOVA CREATIVE 型（ローダー · メニュー · スクロール）
 */
(function () {
  "use strict";

  var loader = document.getElementById("loader");
  var header = document.getElementById("header");
  var menuBtn = document.getElementById("menuBtn");
  var navOverlay = document.getElementById("navOverlay");
  var hero = document.getElementById("hero");
  var messageSection = document.querySelector("[data-parallax]");
  var navLinks = document.querySelectorAll("[data-nav]");

  var LOADER_DURATION = 1800;
  var SCROLL_THRESHOLD = 50;

  function initLoader() {
    if (!loader) {
      if (hero) hero.classList.add("is-ready");
      return;
    }
    document.body.classList.add("is-loading");
    window.setTimeout(function () {
      loader.classList.add("is-hidden");
      document.body.classList.remove("is-loading");
      document.body.classList.add("is-ready");
      if (hero) hero.classList.add("is-ready");
      loader.setAttribute("aria-hidden", "true");
    }, LOADER_DURATION);
  }

  function initHeaderScroll() {
    if (!header) return;
    function updateHeader() {
      if (window.scrollY > SCROLL_THRESHOLD) {
        header.classList.add("is-scrolled");
      } else {
        header.classList.remove("is-scrolled");
      }
    }
    window.addEventListener("scroll", updateHeader, { passive: true });
    updateHeader();
  }

  function initMenu() {
    if (!menuBtn || !navOverlay) return;

    function openMenu() {
      menuBtn.classList.add("is-active");
      header.classList.add("is-menu-open");
      menuBtn.setAttribute("aria-expanded", "true");
      menuBtn.setAttribute("aria-label", "メニューを閉じる");
      navOverlay.classList.add("is-open");
      navOverlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-menu-open");
    }

    function closeMenu() {
      menuBtn.classList.remove("is-active");
      header.classList.remove("is-menu-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "メニューを開く");
      navOverlay.classList.remove("is-open");
      navOverlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-menu-open");
    }

    menuBtn.addEventListener("click", function () {
      if (navOverlay.classList.contains("is-open")) closeMenu();
      else openMenu();
    });

    navLinks.forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navOverlay.classList.contains("is-open")) {
        closeMenu();
        menuBtn.focus();
      }
    });
  }

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      anchor.addEventListener("click", function (e) {
        var href = anchor.getAttribute("href");
        if (!href || href === "#") {
          e.preventDefault();
          return;
        }
        var target = document.querySelector(href);
        if (!target || !header) return;
        e.preventDefault();
        var top =
          target.getBoundingClientRect().top +
          window.scrollY -
          header.offsetHeight;
        window.scrollTo({ top: top, behavior: "smooth" });
      });
    });
  }

  function initScrollReveal() {
    var revealElements = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      revealElements.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initParallax() {
    if (!messageSection) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var ticking = false;
    function updateParallax() {
      var rect = messageSection.getBoundingClientRect();
      var windowHeight = window.innerHeight;
      if (rect.top < windowHeight && rect.bottom > 0) {
        var progress = (windowHeight - rect.top) / (windowHeight + rect.height);
        var offset = (progress - 0.5) * 60;
        messageSection.style.transform = "translateY(" + offset + "px)";
      }
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      },
      { passive: true }
    );
  }

  function initAuthLinks() {
    document.querySelectorAll("[data-auth-href]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        var href = el.getAttribute("data-auth-href") || el.getAttribute("href");
        if (!href) return;
        e.preventDefault();
        function go() {
          window.location.href = href;
        }
        if (window.PhysLaboAuth && typeof window.PhysLaboAuth.requestAuth === "function") {
          window.PhysLaboAuth.requestAuth(go);
        } else {
          go();
        }
      });
    });
  }

  function init() {
    initLoader();
    initHeaderScroll();
    initMenu();
    initSmoothScroll();
    initScrollReveal();
    initParallax();
    initAuthLinks();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
