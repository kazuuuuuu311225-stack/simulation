/**
 * physLabo — Web Audio モバイル対応（iOS / Android の user-gesture 制限）
 */
(function (global) {
  "use strict";

  var contexts = [];
  var unlockBound = false;

  function AudioCtor() {
    return global.AudioContext || global.webkitAudioContext || null;
  }

  function register(ctx) {
    if (!ctx || contexts.indexOf(ctx) >= 0) return;
    contexts.push(ctx);
  }

  function resumeOne(ctx) {
    if (!ctx || ctx.state === "running") {
      return Promise.resolve(ctx);
    }
    var p = ctx.resume();
    if (p && typeof p.then === "function") {
      return p.then(function () {
        return ctx;
      });
    }
    return Promise.resolve(ctx);
  }

  function ensureRunning(ctx) {
    var Ctor = AudioCtor();
    if (!Ctor) {
      return Promise.reject(new Error("Web Audio API is not supported"));
    }
    if (!ctx) {
      ctx = new Ctor();
      register(ctx);
    } else {
      register(ctx);
    }
    return resumeOne(ctx);
  }

  function createContext() {
    var Ctor = AudioCtor();
    if (!Ctor) return null;
    var ctx = new Ctor();
    register(ctx);
    return ctx;
  }

  function unlockAll() {
    if (!contexts.length) return Promise.resolve();
    return Promise.all(contexts.map(resumeOne)).then(function () {
      return undefined;
    });
  }

  function bindUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    var opts = { capture: true, passive: true };
    function onGesture() {
      unlockAll();
    }
    global.addEventListener("pointerdown", onGesture, opts);
    global.addEventListener("touchend", onGesture, opts);
    global.addEventListener("click", onGesture, opts);
  }

  bindUnlock();

  global.PhysLaboAudio = {
    create: createContext,
    register: register,
    ensureRunning: ensureRunning,
    unlock: unlockAll
  };
})(window);
