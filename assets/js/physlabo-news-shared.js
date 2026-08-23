/**
 * physLabo — NEWS 共通
 */
(function () {
  "use strict";

  var JSON_PATH = "data/news.json";
  var EMBED_PATH = "assets/js/news-data.js";
  var ARTICLE_URL = "news-article.html";
  var IMAGE_DIR = "data/news-images/";

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(iso) {
    if (!iso) return "";
    var p = String(iso).slice(0, 10).split("-");
    if (p.length !== 3) return iso;
    return p[0] + "." + p[1] + "." + p[2];
  }

  function articleHref(id) {
    return ARTICLE_URL + "?id=" + encodeURIComponent(id);
  }

  function plainText(body) {
    return String(body || "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function excerpt(body, max) {
    var text = plainText(body);
    if (!text) return "";
    if (text.length <= max) return text;
    return text.slice(0, max) + "…";
  }

  function sanitizeImageSrc(src) {
    src = String(src || "").trim().replace(/\\/g, "/");
    if (/^data\/news-images\/[a-zA-Z0-9._-]+$/.test(src)) return src;
    return "";
  }

  function renderImageFigure(src, alt) {
    var safeSrc = sanitizeImageSrc(src);
    if (!safeSrc) return "";
    return (
      '<figure class="news-body__figure">' +
      '<img class="news-body__img" src="' + escapeHtml(safeSrc) + '" alt="' + escapeHtml(alt || "") + '" loading="lazy">' +
      "</figure>"
    );
  }

  function renderBody(body) {
    var text = String(body || "");
    if (!text) return "";

    var parts = text.split("\n");
    var html = [];
    for (var i = 0; i < parts.length; i++) {
      var line = parts[i];
      var img = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line.trim());
      if (img) {
        html.push(renderImageFigure(img[2], img[1]));
        continue;
      }
      if (line) html.push("<p>" + escapeHtml(line) + "</p>");
      else html.push("<br>");
    }
    return html.join("");
  }

  function publishedItems(data) {
    var items = (data && data.items) || [];
    return items
      .filter(function (it) { return it.published !== false; })
      .sort(function (a, b) {
        return String(b.date || "").localeCompare(String(a.date || ""));
      });
  }

  function loadEmbedScript() {
    return new Promise(function (resolve, reject) {
      var prev = document.getElementById("physlaboNewsData");
      if (prev) prev.remove();
      delete window.__PHYSLABO_NEWS__;

      var s = document.createElement("script");
      s.id = "physlaboNewsData";
      s.src = EMBED_PATH + "?t=" + Date.now();
      s.onload = function () {
        if (window.__PHYSLABO_NEWS__) resolve(window.__PHYSLABO_NEWS__);
        else reject(new Error("no_embed"));
      };
      s.onerror = function () { reject(new Error("no_embed")); };
      document.head.appendChild(s);
    });
  }

  function loadData() {
    if (location.protocol === "file:") {
      return loadEmbedScript();
    }
    return fetch(JSON_PATH + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("fetch");
        return r.json();
      })
      .catch(function () {
        return loadEmbedScript();
      });
  }

  window.physLaboNews = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    articleHref: articleHref,
    excerpt: excerpt,
    plainText: plainText,
    sanitizeImageSrc: sanitizeImageSrc,
    renderImageFigure: renderImageFigure,
    renderBody: renderBody,
    publishedItems: publishedItems,
    loadData: loadData,
    IMAGE_DIR: IMAGE_DIR,
  };
})();
