/**
 * physLabo — シミュレーション閲覧用パスワードゲート
 */
(function (global) {
  "use strict";

  var DEFAULT_AUTH_KEY = "physlabo_sim_unlocked";
  var DEFAULT_PASSWORD = "1225";
  var AUTH_KEY = DEFAULT_AUTH_KEY;
  var PASSWORD = DEFAULT_PASSWORD;

  var gate = null;
  var input = null;
  var errorEl = null;
  var toggleVisBtn = null;
  var cancelBtn = null;
  var titleEl = null;
  var messageEl = null;
  var onSuccess = null;
  var scrollY = 0;
  var gateMandatory = false;
  var bound = false;

  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function markUnlocked() {
    document.documentElement.classList.add("auth-unlocked");
    if (document.body) document.body.classList.add("auth-unlocked");
  }

  function setAuthed() {
    try {
      sessionStorage.setItem(AUTH_KEY, "1");
    } catch (e) { /* ignore */ }
    markUnlocked();
  }

  function pageAuthOptions() {
    var body = document.body;
    var options = {
      mandatory: true,
      title: "パスワード入力",
      message: "physLabo を見るにはパスワードが必要です。"
    };
    AUTH_KEY = DEFAULT_AUTH_KEY;
    PASSWORD = DEFAULT_PASSWORD;
    if (!body) return options;
    var key = body.getAttribute("data-auth-key");
    var pw = body.getAttribute("data-auth-password");
    var title = body.getAttribute("data-auth-title");
    var message = body.getAttribute("data-auth-message");
    if (key) AUTH_KEY = key;
    if (pw) PASSWORD = pw;
    if (title) options.title = title;
    if (message) {
      options.message = message;
    } else if (pw) {
      options.message = "このシミュレーションを見るにはパスワードが必要です。";
    }
    return options;
  }

  function isHeroPhase() {
    var html = document.documentElement;
    return html.classList.contains("hero-landing") ||
      html.classList.contains("hero-transition-active");
  }

  function lockBody() {
    scrollY = window.scrollY || 0;
    document.documentElement.classList.add("auth-gate-open");
    document.body.classList.add("auth-gate-open");
    if (isHeroPhase()) return;
    document.body.style.top = "-" + scrollY + "px";
    document.body.style.position = "fixed";
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
  }

  function unlockBody() {
    document.documentElement.classList.remove("auth-gate-open");
    document.body.classList.remove("auth-gate-open");
    document.body.style.top = "";
    document.body.style.position = "";
    document.body.style.width = "";
    if (isHeroPhase()) {
      window.scrollTo(0, 0);
      return;
    }
    window.scrollTo(0, scrollY);
  }

  function scrollPanelIntoView() {
    /* 固定オーバーレイのためページスクロールは不要 */
  }

  function applyGateOptions(options) {
    options = options || {};
    gateMandatory = !!options.mandatory;
    if (cancelBtn) {
      cancelBtn.style.display = gateMandatory ? "none" : "";
    }
    if (titleEl && options.title) {
      titleEl.textContent = options.title;
    }
    if (messageEl && options.message) {
      messageEl.textContent = options.message;
    }
  }

  function hideGate() {
    if (!gate) return;
    if (gateMandatory && !isAuthed()) return;
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
    gateMandatory = false;
    unlockBody();
    if (input) {
      input.value = "";
      input.type = "text";
    }
    if (toggleVisBtn) toggleVisBtn.textContent = "入力を隠す";
    if (errorEl) errorEl.classList.add("hidden");
    onSuccess = null;
  }

  function showError() {
    if (errorEl) errorEl.classList.remove("hidden");
    if (input) {
      input.focus({ preventScroll: true });
      input.select();
    }
    scrollPanelIntoView();
  }

  function submit() {
    if (!input) return;
    if (input.value === PASSWORD) {
      setAuthed();
      var cb = onSuccess;
      hideGate();
      if (typeof cb === "function") cb();
      return;
    }
    showError();
  }

  function toggleVisibility() {
    if (!input || !toggleVisBtn) return;
    if (input.type === "password") {
      input.type = "text";
      toggleVisBtn.textContent = "入力を隠す";
    } else {
      input.type = "password";
      toggleVisBtn.textContent = "入力を表示";
    }
    input.focus({ preventScroll: true });
  }

  function ensureGateDom() {
    if (document.getElementById("authGate")) return;
    var root = document.createElement("div");
    root.innerHTML =
      '<div class="auth-gate hidden" id="authGate" role="dialog" aria-modal="true" aria-labelledby="authTitle" aria-hidden="true">' +
      '<div class="auth-panel">' +
      '<h2 id="authTitle">パスワード入力</h2>' +
      '<p id="authMessage">シミュレーションを見るにはパスワードが必要です。</p>' +
      '<input type="text" class="auth-input" id="authPassword" inputmode="numeric" pattern="[0-9]*" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="パスワード">' +
      '<button type="button" class="auth-toggle-vis" id="authToggleVis">入力を隠す</button>' +
      '<p class="auth-error hidden" id="authError" role="alert">パスワードが正しくありません</p>' +
      '<div class="auth-actions">' +
      '<button type="button" id="authCancel">キャンセル</button>' +
      '<button type="button" class="primary" id="authSubmit">入室</button>' +
      "</div></div></div>";
    document.body.appendChild(root.firstChild);
  }

  function bindOnce() {
    ensureGateDom();
    if (bound) return;
    gate = document.getElementById("authGate");
    input = document.getElementById("authPassword");
    errorEl = document.getElementById("authError");
    toggleVisBtn = document.getElementById("authToggleVis");
    cancelBtn = document.getElementById("authCancel");
    titleEl = document.getElementById("authTitle");
    messageEl = document.getElementById("authMessage");
    var submitBtn = document.getElementById("authSubmit");

    if (!gate || !input || !submitBtn) return;

    bound = true;
    if (input.type === "password") input.type = "text";

    submitBtn.addEventListener("click", submit);
    if (cancelBtn) cancelBtn.addEventListener("click", hideGate);
    if (toggleVisBtn) toggleVisBtn.addEventListener("click", toggleVisibility);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape" && !gateMandatory) {
        hideGate();
      }
    });
    gate.addEventListener("click", function (e) {
      if (e.target === gate && !gateMandatory) hideGate();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        if (gate && !gate.classList.contains("hidden")) scrollPanelIntoView();
      });
    }
  }

  function requestAuth(callback, options) {
    bindOnce();
    if (isAuthed()) {
      if (typeof callback === "function") callback();
      return;
    }
    onSuccess = callback;
    applyGateOptions(options);
    if (errorEl) errorEl.classList.add("hidden");
    if (input) {
      input.type = "text";
      input.value = "";
    }
    if (toggleVisBtn) toggleVisBtn.textContent = "入力を隠す";
    if (gate) {
      lockBody();
      gate.classList.remove("hidden");
      gate.setAttribute("aria-hidden", "false");
    }
    window.setTimeout(function () {
      if (input) {
        input.focus({ preventScroll: true });
        scrollPanelIntoView();
      }
    }, 80);
  }

  function initEntryGate(options) {
    var pageOpts = pageAuthOptions();
    bindOnce();
    if (isAuthed()) {
      markUnlocked();
      return;
    }
    requestAuth(null, options || pageOpts);
  }

  global.PhysLaboAuth = {
    isAuthed: isAuthed,
    requestAuth: requestAuth,
    initEntryGate: initEntryGate,
    hideGate: hideGate
  };

  function bootEntryGate() {
    if (document.body && document.body.hasAttribute("data-auth-entry")) {
      initEntryGate();
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootEntryGate);
  } else {
    bootEntryGate();
  }
})(window);
