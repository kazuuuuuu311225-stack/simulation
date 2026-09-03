/**
 * physLabo — NEWS 記事詳細
 */
(function () {
  "use strict";

  function getArticleId() {
    try {
      return new URLSearchParams(location.search).get("id") || "";
    } catch (e) {
      return "";
    }
  }

  function showNotFound(root, id) {
    root.innerHTML =
      '<p class="news-article__empty">記事が見つかりませんでした。</p>' +
      (id ? '<p class="news-article__meta">ID: ' + window.physLaboNews.escapeHtml(id) + "</p>" : "") +
      '<p class="news-article__back-wrap"><a class="news-article__back" href="00_physLabo_top.html#news">← NEWS 一覧へ戻る</a></p>';
    document.title = "記事が見つかりません — physLabo";
  }

  function renderArticle(root, item) {
    document.title = item.title + " — physLabo NEWS";
    var cover = item.image ? window.physLaboNews.renderImageFigure(item.image, item.title) : "";
    root.innerHTML =
      '<p class="news-article__back-wrap"><a class="news-article__back" href="00_physLabo_top.html#news">← NEWS 一覧へ戻る</a></p>' +
      '<header class="news-article__header">' +
      '<time class="news-article__date" datetime="' + window.physLaboNews.escapeHtml(item.date || "") + '">' +
      window.physLaboNews.escapeHtml(window.physLaboNews.formatDate(item.date)) +
      "</time>" +
      '<h1 class="news-article__title">' + window.physLaboNews.escapeHtml(item.title || "") + "</h1>" +
      "</header>" +
      (cover ? '<div class="news-article__cover">' + cover + "</div>" : "") +
      '<div class="news-article__body">' +
      window.physLaboNews.renderBody(item.body) +
      "</div>";
  }

  function load() {
    var root = document.getElementById("newsArticle");
    if (!root || !window.physLaboNews) return;

    var id = getArticleId();
    if (!id) {
      showNotFound(root, "");
      return;
    }

    function apply(data) {
      var item = window.physLaboNews.publishedItems(data).find(function (it) {
        return it.id === id;
      });
      if (!item) {
        showNotFound(root, id);
        return;
      }
      renderArticle(root, item);
    }

    window.physLaboNews.loadData()
      .then(apply)
      .catch(function () { showNotFound(root, id); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("is-ready");
  });
})();
