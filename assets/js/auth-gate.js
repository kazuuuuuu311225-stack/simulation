/**
 * physLabo — シミュレーション閲覧用パスワードゲート
 */
(function (global) {
  "use strict";

  var AUTH_KEY = "physlabo_sim_unlocked";
  var PASSWORD = "1225";

  var gate = null;
  var input = null;
  var errorEl = null;
  var toggleVisBtn = null;
  var onSuccess = null;
  var scrollY = 0;

  function isAuthed() {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch (e) {
      return false;
    }
  }

  function setAuthed() {
    try {
      sessionStorage.setItem(AUTH_KEY, "1");
    } catch (e) { /* ignore */ }
  }

  function isHeroPhase() {
    var html = document.documentElement;
    return html.classList.contains("hero-landing") ||
      html.classList.contains("hero-transition-active");
  }

  function lockBody() {
    scrollY = window.scrollY || 0;
    document.body.classList.add("auth-gate-open");
    /* Hero 画面は html.hero-landing で既にスクロール固定 — body.fixed はレイアウトずれの原因 */
    if (isHeroPhase()) return;
    document.body.style.top = "-" + scrollY + "px";
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
  }

  function unlockBody() {
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
    if (!gate) return;
    if (document.documentElement.classList.contains("hero-landing")) return;
    var panel = gate.querySelector(".auth-panel");
    if (panel && panel.scrollIntoView) {
      panel.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    }
  }

  function hideGate() {
    if (!gate) return;
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
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
      '<p>シミュレーションを見るにはパスワードが必要です。</p>' +
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
    if (gate) return;
    gate = document.getElementById("authGate");
    input = document.getElementById("authPassword");
    errorEl = document.getElementById("authError");
    toggleVisBtn = document.getElementById("authToggleVis");
    var submitBtn = document.getElementById("authSubmit");
    var cancelBtn = document.getElementById("authCancel");

    if (!gate || !input || !submitBtn) return;

    if (input.type === "password") input.type = "text";

    submitBtn.addEventListener("click", submit);
    if (cancelBtn) cancelBtn.addEventListener("click", hideGate);
    if (toggleVisBtn) toggleVisBtn.addEventListener("click", toggleVisibility);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        hideGate();
      }
    });
    gate.addEventListener("click", function (e) {
      if (e.target === gate) hideGate();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        if (gate && !gate.classList.contains("hidden")) scrollPanelIntoView();
      });
    }
  }

  function requestAuth(callback) {
    bindOnce();
    if (isAuthed()) {
      if (typeof callback === "function") callback();
      return;
    }
    onSuccess = callback;
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

  global.PhysLaboAuth = {
    isAuthed: isAuthed,
    requestAuth: requestAuth,
    hideGate: hideGate
  };
})(window);
