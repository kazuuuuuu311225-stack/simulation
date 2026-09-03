/**
 * physLabo — トップページ NEWS 一覧
 */
(function () {
  "use strict";

  var LIST_ID = "newsList";

  function render(listEl, data) {
    var pub = window.physLaboNews.publishedItems(data);

    if (!pub.length) {
      listEl.innerHTML = '<li class="news__empty">現在、お知らせはありません。</li>';
      return;
    }

    listEl.innerHTML = pub.map(function (it) {
      var href = window.physLaboNews.articleHref(it.id);
      var preview = window.physLaboNews.excerpt(it.body, 72);
      var thumb = it.image ? window.physLaboNews.renderImageFigure(it.image, it.title) : "";
      return (
        '<li class="news__item reveal">' +
        '<a class="news__link" href="' + window.physLaboNews.escapeHtml(href) + '">' +
        (thumb ? '<div class="news__thumb">' + thumb + "</div>" : "") +
        '<div class="news__item-head">' +
        '<time class="news__date" datetime="' + window.physLaboNews.escapeHtml(it.date || "") + '">' +
        window.physLaboNews.escapeHtml(window.physLaboNews.formatDate(it.date)) +
        "</time>" +
        '<h3 class="news__title">' + window.physLaboNews.escapeHtml(it.title || "") + "</h3>" +
        "</div>" +
        (preview
          ? '<p class="news__excerpt">' + window.physLaboNews.escapeHtml(preview) + "</p>"
          : "") +
        '<span class="news__more">続きを読む</span>' +
        "</a></li>"
      );
    }).join("");

    if (window.IntersectionObserver) {
      listEl.querySelectorAll(".reveal").forEach(function (el) {
        if (el.classList.contains("is-visible")) return;
        var obs = new IntersectionObserver(function (entries, o) {
          entries.forEach(function (en) {
            if (en.isIntersecting) {
              en.target.classList.add("is-visible");
              o.unobserve(en.target);
            }
          });
        }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
        obs.observe(el);
      });
    } else {
      listEl.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
    }
  }

  function showLoadError(listEl) {
    listEl.innerHTML =
      '<li class="news__empty">お知らせを読み込めませんでした。' +
      (location.protocol === "file:"
        ? " HP は <code>tools/start-news-server.bat</code> 起動後、<code>http://localhost:8790/00_physLabo_top.html</code> から開いてください。"
        : "") +
      "</li>";
  }

  function load() {
    var listEl = document.getElementById(LIST_ID);
    if (!listEl || !window.physLaboNews) return;

    window.physLaboNews.loadData()
      .then(function (data) { render(listEl, data); })
      .catch(function () { showLoadError(listEl); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
