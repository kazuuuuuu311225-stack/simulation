/**
 * Hero → CHAPTERS クリック移行（スクロールなし・パネルスライド）
 */
(function () {
  "use strict";

  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  const CARD_STAGGER_MS = 110;
  const CARD_ANIM_MS = 650;
  let transitioning = false;

  function showChaptersHeader(sectionTitle, chaptersBrand) {
    if (sectionTitle) sectionTitle.classList.add("is-shown");
    if (chaptersBrand) chaptersBrand.classList.add("is-shown");
  }

  function showChaptersTitle(sectionTitle) {
    if (sectionTitle) sectionTitle.classList.add("is-shown");
  }

  function showChaptersBrand(chaptersBrand) {
    if (chaptersBrand) chaptersBrand.classList.add("is-shown");
  }

  function finishTransition(hero, pageWrap, cardGrid, cards) {
    const sectionTitle = document.getElementById("chapters");
    const chaptersBrand = document.getElementById("chaptersBrand");
    root.classList.remove("hero-transition-active", "hero-landing");
    root.classList.add("hero-transition-done", "chapters-mode");
    hero.classList.add("hero-dismissed");
    pageWrap.classList.remove("is-entering", "content-show");
    pageWrap.classList.add("content-visible");
    cardGrid.classList.remove("is-entering");
    cards.forEach((c) => c.classList.add("is-revealed"));
    showChaptersHeader(sectionTitle, chaptersBrand);
    window.scrollTo(0, 0);
    transitioning = false;
  }

  function revealCardsStaggered(cards) {
    cards.forEach((card, i) => {
      window.setTimeout(() => {
        card.classList.add("is-revealed");
      }, 950 + i * CARD_STAGGER_MS);
    });
    return 950 + (cards.length - 1) * CARD_STAGGER_MS + CARD_ANIM_MS + 200;
  }

  function playTransition(hero, pageWrap, cardGrid, cards) {
    if (transitioning) return;
    transitioning = true;

    if (REDUCED) {
      root.classList.remove("hero-landing");
      finishTransition(hero, pageWrap, cardGrid, cards);
      return;
    }

    root.classList.remove("hero-landing");
    root.classList.add("hero-transition-active");
    pageWrap.classList.add("is-entering");
    cardGrid.classList.add("is-entering");
    cards.forEach((c) => c.classList.remove("is-revealed"));

    if (window.HeroCanvas && typeof window.HeroCanvas.triggerWave === "function") {
      window.HeroCanvas.triggerWave();
    }

    window.setTimeout(() => {
      pageWrap.classList.add("content-show");
      showChaptersTitle(document.getElementById("chapters"));
    }, 520);

    window.setTimeout(() => {
      showChaptersBrand(document.getElementById("chaptersBrand"));
    }, 780);

    const finishDelay = revealCardsStaggered(cards);

    window.setTimeout(() => {
      finishTransition(hero, pageWrap, cardGrid, cards);
    }, finishDelay);
  }

  function initNav(hero, pageWrap, cardGrid, cards) {
    const cta = document.querySelector(".hero-cta");
    const indicator = document.querySelector(".scroll-indicator");

    function go(e) {
      if (e) e.preventDefault();
      const run = () => playTransition(hero, pageWrap, cardGrid, cards);
      if (window.PhysLaboAuth && typeof window.PhysLaboAuth.requestAuth === "function") {
        window.PhysLaboAuth.requestAuth(run);
      } else {
        run();
      }
    }

    if (cta) {
      cta.addEventListener("click", go);
    }

    if (indicator) {
      indicator.style.pointerEvents = "auto";
      indicator.style.cursor = "pointer";
      indicator.setAttribute("role", "button");
      indicator.setAttribute("tabindex", "0");
      indicator.setAttribute("aria-label", "CHAPTERS へ移動");
      indicator.addEventListener("click", go);
      indicator.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") go(e);
      });
    }
  }

  function boot() {
    const hero = document.getElementById("hero");
    const pageWrap = document.querySelector(".page-wrap");
    const cardGrid = document.querySelector(".card-grid");
    const cards = document.querySelectorAll(".chapter-card");
    if (!hero || !pageWrap || !cardGrid) return;

    cards.forEach((card, i) => {
      card.style.setProperty("--reveal-i", String(i));
    });

    initNav(hero, pageWrap, cardGrid, cards);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
