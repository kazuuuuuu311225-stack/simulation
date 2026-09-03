/**
 * physLabo NEWS — GitHub API バックエンド（GitHub Pages 用）
 */
(function () {
  "use strict";

  var GH_TOKEN_KEY = "physlabo_news_gh_token";
  var GH_CFG_KEY = "physlabo_news_gh_cfg";
  var API = "https://api.github.com";

  function encodePath(p) {
    return p.split("/").map(encodeURIComponent).join("/");
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function base64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(String(b64).replace(/\n/g, ""))));
  }

  function mergeConfig(base, override) {
    base = base || {};
    override = override || {};
    return {
      owner: String(override.owner || base.owner || "").trim(),
      repo: String(override.repo || base.repo || "").trim(),
      branch: String(override.branch || base.branch || "main").trim() || "main",
      repoPath: String(override.repoPath != null ? override.repoPath : base.repoPath || "")
        .replace(/^\/+|\/+$/g, ""),
    };
  }

  function repoRel(cfg, rel) {
    rel = String(rel || "").replace(/^\/+/, "");
    return cfg.repoPath ? cfg.repoPath + "/" + rel : rel;
  }

  function getStoredCfg() {
    try {
      var raw = sessionStorage.getItem(GH_CFG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getToken() {
    try {
      return sessionStorage.getItem(GH_TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function ghHeaders(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function createGitHubBackend(defaultCfg) {
    function cfg() {
      return mergeConfig(defaultCfg, getStoredCfg());
    }

    function ghFetch(path, options) {
      options = options || {};
      var token = getToken();
      if (!token) return Promise.reject(Object.assign(new Error("no_token"), { status: 401 }));
      return fetch(API + path, {
        method: options.method || "GET",
        headers: Object.assign(
          { "Content-Type": "application/json" },
          ghHeaders(token),
          options.headers || {}
        ),
        body: options.body ? JSON.stringify(options.body) : undefined,
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) {
            var err = new Error(data.message || "github_error");
            err.status = r.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      });
    }

    function getFile(rel) {
      var c = cfg();
      if (!c.owner || !c.repo) {
        return Promise.reject(new Error("config_required"));
      }
      var path =
        "/repos/" +
        encodeURIComponent(c.owner) +
        "/" +
        encodeURIComponent(c.repo) +
        "/contents/" +
        encodePath(repoRel(c, rel)) +
        "?ref=" +
        encodeURIComponent(c.branch);
      return ghFetch(path);
    }

    function putFile(rel, contentUtf8, message, sha) {
      var c = cfg();
      var body = {
        message: message,
        content: utf8ToBase64(contentUtf8),
        branch: c.branch,
      };
      if (sha) body.sha = sha;
      var path =
        "/repos/" +
        encodeURIComponent(c.owner) +
        "/" +
        encodeURIComponent(c.repo) +
        "/contents/" +
        encodePath(repoRel(c, rel));
      return ghFetch(path, { method: "PUT", body: body });
    }

    function putFileBase64(rel, base64Content, message, sha) {
      var c = cfg();
      var body = {
        message: message,
        content: base64Content,
        branch: c.branch,
      };
      if (sha) body.sha = sha;
      var path =
        "/repos/" +
        encodeURIComponent(c.owner) +
        "/" +
        encodeURIComponent(c.repo) +
        "/contents/" +
        encodePath(repoRel(c, rel));
      return ghFetch(path, { method: "PUT", body: body });
    }

    function safeUploadName(name) {
      var base = String(name || "image.jpg").split(/[/\\]/).pop();
      var m = base.match(/\.(jpe?g|png|webp|gif)$/i);
      if (!m) return null;
      var ext = m[1].toLowerCase();
      if (ext === "jpeg") ext = "jpg";
      return "image." + ext;
    }

    function normalizeItems(items) {
      return (items || []).map(function (it) {
        return {
          id: String(it.id || ""),
          date: String(it.date || "").slice(0, 10),
          title: String(it.title || "").trim(),
          body: String(it.body || ""),
          image: String(it.image || "").trim(),
          published: it.published !== false,
        };
      }).filter(function (it) { return it.id && it.title; });
    }

    return {
      mode: "github",
      getConfig: cfg,

      login: function (credentials) {
        var merged = mergeConfig(defaultCfg, credentials);
        if (!merged.owner || !merged.repo || !credentials.token) {
          return Promise.reject(new Error("missing_fields"));
        }
        try {
          sessionStorage.setItem(GH_TOKEN_KEY, credentials.token.trim());
          sessionStorage.setItem(GH_CFG_KEY, JSON.stringify(merged));
        } catch (e) { /* ignore */ }
        return ghFetch("/user").then(function (user) {
          return { ok: true, login: user.login };
        });
      },

      logout: function () {
        try {
          sessionStorage.removeItem(GH_TOKEN_KEY);
          sessionStorage.removeItem(GH_CFG_KEY);
        } catch (e) { /* ignore */ }
      },

      sessionOk: function () {
        if (!getToken()) return Promise.resolve(false);
        return ghFetch("/user").then(function () { return true; }).catch(function () { return false; });
      },

      checkCapabilities: function () {
        return Promise.resolve({ upload: true, github: true });
      },

      loadNews: function () {
        return fetch("../data/news.json?t=" + Date.now(), { cache: "no-store" })
          .then(function (r) {
            if (!r.ok) throw new Error("fetch");
            return r.json();
          })
          .catch(function () {
            return getFile("data/news.json").then(function (meta) {
              return JSON.parse(base64ToUtf8(meta.content));
            });
          });
      },

      saveNews: function (items) {
        var payload = {
          updatedAt: new Date().toISOString(),
          items: normalizeItems(items),
        };
        var jsonText = JSON.stringify(payload, null, 2) + "\n";
        var jsText =
          "window.__PHYSLABO_NEWS__=" + JSON.stringify(payload) + ";\n";
        return Promise.all([
          getFile("data/news.json").catch(function () { return { sha: null }; }),
          getFile("assets/js/news-data.js").catch(function () { return { sha: null }; }),
        ]).then(function (metas) {
          return putFile(
            "data/news.json",
            jsonText,
            "Update physLabo NEWS (news.json)",
            metas[0].sha
          ).then(function () {
            return putFile(
              "assets/js/news-data.js",
              jsText,
              "Update physLabo NEWS (news-data.js)",
              metas[1].sha
            );
          }).then(function () {
            return {
              ok: true,
              count: payload.items.length,
              updatedAt: payload.updatedAt,
            };
          });
        });
      },

      uploadImage: function (file, base64Data) {
        var safe = safeUploadName(file.name);
        if (!safe) return Promise.reject(new Error("invalid_upload"));
        var stored = Date.now().toString(36) + "-" + safe;
        var rel = "data/news-images/" + stored;
        return getFile(rel)
          .catch(function () { return { sha: null }; })
          .then(function (meta) {
            return putFileBase64(
              rel,
              base64Data,
              "Upload physLabo NEWS image " + stored,
              meta.sha
            ).then(function () {
              return { ok: true, path: rel };
            });
          });
      },
    };
  }

  function createLocalBackend() {
    var TOKEN_KEY = "physlabo_news_admin_token";

    function token() {
      try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; }
    }

    function api(path, options) {
      options = options || {};
      var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
      if (token()) headers.Authorization = "Bearer " + token();
      return fetch(path, {
        method: options.method || "GET",
        headers: headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok) {
            var err = new Error(data.error || "request_failed");
            err.status = r.status;
            throw err;
          }
          return data;
        });
      });
    }

    return {
      mode: "local",

      login: function (credentials) {
        return api("/api/news/login", {
          method: "POST",
          body: { id: credentials.id, password: credentials.password },
        }).then(function (res) {
          try { sessionStorage.setItem(TOKEN_KEY, res.token); } catch (e) { /* ignore */ }
          return res;
        });
      },

      logout: function () {
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
      },

      sessionOk: function () {
        if (!token()) return Promise.resolve(false);
        return api("/api/news/session").then(function (r) { return !!r.ok; }).catch(function () { return false; });
      },

      checkCapabilities: function () {
        return api("/api/news/status").then(function (info) {
          return { upload: !!(info && info.upload), github: false };
        }).catch(function () { return { upload: false, github: false }; });
      },

      loadNews: function () {
        return api("/api/news");
      },

      saveNews: function (items) {
        return api("/api/news", { method: "PUT", body: { items: items } });
      },

      uploadImage: function (file, base64Data) {
        return api("/api/news/upload", {
          method: "POST",
          body: { filename: file.name, data: base64Data },
        });
      },
    };
  }

  function isLocalNewsServer() {
    var h = location.hostname;
    var p = location.port;
    return (h === "localhost" || h === "127.0.0.1") && p === "8790";
  }

  window.physLaboNewsBackend = isLocalNewsServer()
    ? createLocalBackend()
    : createGitHubBackend(window.__PHYSLABO_NEWS_GITHUB__ || {});
})();
