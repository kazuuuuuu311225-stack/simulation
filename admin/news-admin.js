(function () {
  "use strict";

  var backend = window.physLaboNewsBackend;
  if (!backend) return;

  var state = { items: [], editingId: null };
  var isGitHub = backend.mode === "github";

  var loginPanel = document.getElementById("loginPanel");
  var editorPanel = document.getElementById("editorPanel");
  var listPanel = document.getElementById("listPanel");
  var loginMsg = document.getElementById("loginMsg");
  var editorMsg = document.getElementById("editorMsg");
  var localLogin = document.getElementById("localLogin");
  var githubLogin = document.getElementById("githubLogin");
  var modeBadge = document.getElementById("modeBadge");

  function $(id) { return document.getElementById(id); }

  function setMsg(el, text, isError) {
    el.textContent = text || "";
    el.classList.toggle("is-error", !!isError);
  }

  function showAuthed(show) {
    loginPanel.classList.toggle("hidden", show);
    editorPanel.classList.toggle("hidden", !show);
    listPanel.classList.toggle("hidden", !show);
  }

  function renderList() {
    var ul = $("articleList");
    if (!state.items.length) {
      ul.innerHTML = '<li><span class="article-meta">記事がありません。「新規」から追加してください。</span></li>';
      return;
    }
    var sorted = state.items.slice().sort(function (a, b) {
      return String(b.date).localeCompare(String(a.date));
    });
    ul.innerHTML = sorted.map(function (it) {
      return (
        '<li>' +
        '<span class="article-meta">' + it.date + "</span>" +
        '<span class="article-title">' + escapeHtml(it.title) + "</span>" +
        '<span class="badge' + (it.published === false ? " is-draft" : "") + '">' +
        (it.published === false ? "下書き" : "公開") +
        "</span>" +
        '<button type="button" class="btn" data-edit="' + escapeHtml(it.id) + '">編集</button>' +
        '<button type="button" class="btn btn--danger" data-del="' + escapeHtml(it.id) + '">削除</button>' +
        "</li>"
      );
    }).join("");

    ul.querySelectorAll("[data-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        loadArticle(btn.getAttribute("data-edit"));
      });
    });
    ul.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del");
        if (!confirm("この記事を削除しますか？")) return;
        state.items = state.items.filter(function (x) { return x.id !== id; });
        renderList();
        if (state.editingId === id) resetForm(true);
        saveItemsToServer("記事を削除しました");
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function collectArticleFromForm() {
    var id = $("editId").value.trim() || newId();
    return {
      id: id,
      date: $("editDate").value || todayIso(),
      title: $("editTitle").value.trim(),
      body: $("editBody").value,
      image: $("editImage").value.trim(),
      published: $("editPublished").checked,
    };
  }

  function mergeFormToState() {
    var item = collectArticleFromForm();
    if (!item.title) {
      setMsg(editorMsg, "タイトルを入力してください。", true);
      return null;
    }
    var idx = state.items.findIndex(function (x) { return x.id === item.id; });
    if (idx >= 0) state.items[idx] = item;
    else state.items.unshift(item);
    state.editingId = item.id;
    $("editId").value = item.id;
    renderList();
    return item;
  }

  function resetForm(asNew) {
    state.editingId = asNew ? null : state.editingId;
    $("editId").value = asNew ? "" : (state.editingId || "");
    $("editDate").value = todayIso();
    $("editTitle").value = "";
    $("editBody").value = "";
    $("editImage").value = "";
    $("editImageFile").value = "";
    updateImagePreview("");
    $("editPublished").checked = true;
    if (asNew) state.editingId = null;
  }

  function updateImagePreview(path) {
    var box = $("editImagePreview");
    if (!box) return;
    if (!path) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = '<img src="../' + escapeHtml(path) + '" alt="プレビュー">';
  }

  function insertAtCursor(textarea, text) {
    var start = textarea.selectionStart || 0;
    var end = textarea.selectionEnd || 0;
    var val = textarea.value;
    textarea.value = val.slice(0, start) + text + val.slice(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
  }

  function todayIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function newId() {
    return "news-" + Date.now().toString(36);
  }

  function uploadImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        var comma = result.indexOf(",");
        var base64 = comma >= 0 ? result.slice(comma + 1) : result;
        backend.uploadImage(file, base64).then(resolve).catch(reject);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadArticle(id) {
    var it = state.items.find(function (x) { return x.id === id; });
    if (!it) return;
    state.editingId = id;
    $("editId").value = id;
    $("editDate").value = it.date || todayIso();
    $("editTitle").value = it.title || "";
    $("editBody").value = it.body || "";
    $("editImage").value = it.image || "";
    updateImagePreview(it.image || "");
    $("editPublished").checked = it.published !== false;
    setMsg(editorMsg, "編集中: " + it.title);
  }

  function saveArticleLocal() {
    if (!mergeFormToState()) return;
    setMsg(editorMsg, "記事を一覧に保存しました。「HPに反映」を押して公開してください。");
  }

  function saveItemsToServer(successPrefix) {
    $("publishBtn").disabled = true;
    setMsg(editorMsg, "保存中…");
    return backend.saveNews(state.items)
      .then(function (res) {
        var tail = isGitHub
          ? " GitHub に保存しました。1〜2分後にサイトを再読み込みしてください。"
          : " トップページを再読み込み（F5）してください。";
        setMsg(
          editorMsg,
          successPrefix + "（" + res.count + " 件 · " + res.updatedAt.slice(0, 19).replace("T", " ") + "）。" + tail
        );
      })
      .catch(function (err) {
        var msg;
        if (err.status === 401) {
          msg = isGitHub
            ? "GitHub トークンが無効です。再ログインしてください。"
            : "ログインの有効期限が切れました。再ログインしてください。";
          logout();
        } else if (isGitHub && err.status === 404) {
          msg = "リポジトリまたはパスが見つかりません。設定（owner / repo / repoPath）を確認してください。";
        } else if (isGitHub) {
          msg = "GitHub への保存に失敗しました: " + (err.message || "エラー");
        } else {
          msg = "保存に失敗しました。news-server が起動しているか確認してください。";
        }
        setMsg(editorMsg, msg, true);
      })
      .finally(function () { $("publishBtn").disabled = false; });
  }

  function publishToServer() {
    var title = $("editTitle").value.trim();
    if (title) {
      if (!mergeFormToState()) return;
    }
    saveItemsToServer("HPを更新しました");
  }

  function loadNews() {
    return backend.loadNews().then(function (data) {
      state.items = (data && data.items) ? data.items.slice() : [];
      renderList();
    });
  }

  function logout() {
    backend.logout();
    showAuthed(false);
    setMsg(loginMsg, "");
    setMsg(editorMsg, "");
  }

  function checkServerCapabilities() {
    return backend.checkCapabilities().then(function (info) {
      if (info.upload) return;
      setMsg(
        editorMsg,
        "サーバーが古いバージョンです。tools/start-news-server.bat を再起動してください（画像アップロード不可）。",
        true
      );
    }).catch(function () { /* ignore */ });
  }

  function tryRestoreSession() {
    return backend.sessionOk().then(function (ok) {
      if (!ok) return false;
      showAuthed(true);
      resetForm(true);
      return loadNews().then(function () {
        return isGitHub ? true : checkServerCapabilities().then(function () { return true; });
      });
    }).catch(function () { return false; });
  }

  function prefillGitHubForm() {
    var cfg = backend.getConfig ? backend.getConfig() : (window.__PHYSLABO_NEWS_GITHUB__ || {});
    if ($("ghOwner") && cfg.owner) $("ghOwner").value = cfg.owner;
    if ($("ghRepo") && cfg.repo) $("ghRepo").value = cfg.repo;
    if ($("ghBranch") && cfg.branch) $("ghBranch").value = cfg.branch;
    if ($("ghRepoPath") && cfg.repoPath != null) $("ghRepoPath").value = cfg.repoPath;
  }

  function initModeUi() {
    if (modeBadge) {
      modeBadge.textContent = isGitHub ? "GitHub 公開サイトモード" : "PC ローカルモード";
    }
    if (localLogin) localLogin.classList.toggle("hidden", isGitHub);
    if (githubLogin) githubLogin.classList.toggle("hidden", !isGitHub);
    if (isGitHub) prefillGitHubForm();
  }

  $("loginBtn").addEventListener("click", function () {
    setMsg(loginMsg, "");
    backend.login({
      id: $("loginId").value.trim(),
      password: $("loginPassword").value,
    })
      .then(function () {
        showAuthed(true);
        resetForm(true);
        return loadNews().then(checkServerCapabilities);
      })
      .then(function () { setMsg(loginMsg, ""); })
      .catch(function () {
        setMsg(loginMsg, "ID またはパスワードが正しくありません。", true);
      });
  });

  $("githubLoginBtn").addEventListener("click", function () {
    setMsg(loginMsg, "");
    backend.login({
      owner: $("ghOwner").value.trim(),
      repo: $("ghRepo").value.trim(),
      branch: $("ghBranch").value.trim() || "main",
      repoPath: $("ghRepoPath").value.trim(),
      token: $("ghToken").value.trim(),
    })
      .then(function (res) {
        showAuthed(true);
        resetForm(true);
        $("ghToken").value = "";
        return loadNews();
      })
      .then(function () {
        setMsg(loginMsg, "GitHub にログインしました。");
      })
      .catch(function (err) {
        var msg = "GitHub ログインに失敗しました。";
        if (err && err.message === "missing_fields") {
          msg += " ユーザー名・リポジトリ・トークンを入力してください。";
        } else if (err && err.status === 401) {
          msg += " トークンが正しくないか、権限が不足しています。";
        }
        setMsg(loginMsg, msg, true);
      });
  });

  $("saveArticleBtn").addEventListener("click", saveArticleLocal);
  $("newArticleBtn").addEventListener("click", function () { resetForm(true); setMsg(editorMsg, "新規記事"); });
  $("publishBtn").addEventListener("click", publishToServer);
  $("logoutBtn").addEventListener("click", logout);

  $("uploadImageBtn").addEventListener("click", function () {
    var fileInput = $("editImageFile");
    var file = fileInput.files && fileInput.files[0];
    if (!file) {
      setMsg(editorMsg, "画像ファイルを選んでください。", true);
      return;
    }
    $("uploadImageBtn").disabled = true;
    setMsg(editorMsg, "画像をアップロード中…");
    uploadImage(file)
      .then(function (res) {
        $("editImage").value = res.path;
        updateImagePreview(res.path);
        if ($("editBody").value.indexOf(res.path) < 0) {
          insertAtCursor($("editBody"), "![image](" + res.path + ")\n");
        }
        setMsg(
          editorMsg,
          isGitHub
            ? "画像を GitHub にアップロードしました。「HPに反映」を押してください。"
            : "画像をアップロードしました。「HPに反映」を押すと HP に表示されます。"
        );
      })
      .catch(function (err) {
        var msg = "画像のアップロードに失敗しました。";
        if (err && err.message === "invalid_upload") {
          msg += " PNG / JPEG / GIF / WebP のファイルを選んでください。";
        } else if (isGitHub) {
          msg += " トークンに repo への書き込み権限があるか確認してください。";
        } else if (err && err.message === "not_found") {
          msg += " tools/start-news-server.bat を再起動してください。";
        } else {
          msg += " news-server が起動しているか確認してください。";
        }
        setMsg(editorMsg, msg, true);
      })
      .finally(function () { $("uploadImageBtn").disabled = false; });
  });

  $("insertImageBtn").addEventListener("click", function () {
    var path = $("editImage").value.trim();
    if (!path) {
      setMsg(editorMsg, "先に画像をアップロードしてください。", true);
      return;
    }
    insertAtCursor($("editBody"), "![image](" + path + ")\n");
    setMsg(editorMsg, "本文に画像を挿入しました。");
  });

  $("clearImageBtn").addEventListener("click", function () {
    $("editImage").value = "";
    $("editImageFile").value = "";
    updateImagePreview("");
    setMsg(editorMsg, "アイキャッチ画像をクリアしました。");
  });

  $("loginPassword").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("loginBtn").click();
  });
  $("ghToken").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("githubLoginBtn").click();
  });

  initModeUi();
  tryRestoreSession().then(function (ok) {
    if (!ok) showAuthed(false);
  });
})();
