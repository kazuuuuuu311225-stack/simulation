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
  var onSuccess = null;

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

  function hideGate() {
    if (!gate) return;
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
    if (input) input.value = "";
    if (errorEl) errorEl.classList.add("hidden");
    onSuccess = null;
  }

  function showError() {
    if (errorEl) errorEl.classList.remove("hidden");
    if (input) {
      input.focus();
      input.select();
    }
  }

  function submit() {
    if (!input) return;
    if (input.value === PASSWORD) {
      setAuthed();
      hideGate();
      if (typeof onSuccess === "function") onSuccess();
      return;
    }
    showError();
  }

  function bindOnce() {
    if (gate) return;
    gate = document.getElementById("authGate");
    input = document.getElementById("authPassword");
    errorEl = document.getElementById("authError");
    var submitBtn = document.getElementById("authSubmit");
    var cancelBtn = document.getElementById("authCancel");

    if (!gate || !input || !submitBtn) return;

    submitBtn.addEventListener("click", submit);
    if (cancelBtn) cancelBtn.addEventListener("click", hideGate);
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
  }

  function requestAuth(callback) {
    bindOnce();
    if (isAuthed()) {
      if (typeof callback === "function") callback();
      return;
    }
    onSuccess = callback;
    if (errorEl) errorEl.classList.add("hidden");
    if (gate) {
      gate.classList.remove("hidden");
      gate.setAttribute("aria-hidden", "false");
    }
    window.setTimeout(function () {
      if (input) input.focus();
    }, 50);
  }

  global.PhysLaboAuth = {
    isAuthed: isAuthed,
    requestAuth: requestAuth,
    hideGate: hideGate
  };
})(window);
