/**
 * TreeLayout — 基礎→発展の樹形学習マップ（SVG 接続線 + ノードミニアニメーション）
 */
(function () {
  "use strict";

  const HASH_REDIRECT = {
    "folder-classical": "00_folder_classical.html",
    "folder-thermo": "00_folder_thermo.html",
    "folder-waves": "00_folder_waves.html",
    "folder-em": "00_folder_electromagnetism.html",
    "folder-electromagnetism": "00_folder_electromagnetism.html",
    "folder-atom": "00_folder_atom.html",
    "folder-ex": "00_folder_ex.html",
  };

  function redirectFromHash() {
    const key = location.hash.slice(1);
    const href = HASH_REDIRECT[key];
    if (href) location.replace(href);
  }

  function centerOf(el, container) {
    const r = el.getBoundingClientRect();
    const c = container.getBoundingClientRect();
    return {
      x: r.left + r.width / 2 - c.left,
      y: r.top + r.height / 2 - c.top,
      bottom: r.bottom - c.top,
      top: r.top - c.top,
      left: r.left - c.left,
      right: r.right - c.left,
    };
  }

  function bezierPath(x1, y1, x2, y2, bend) {
    const midY = (y1 + y2) / 2;
    const c1y = y1 + (midY - y1) * bend;
    const c2y = y2 - (y2 - midY) * bend;
    return `M ${x1} ${y1} C ${x1} ${c1y}, ${x2} ${c2y}, ${x2} ${y2}`;
  }

  function initTreeLayout() {
    const tree = document.getElementById("learningTree");
    const svg = document.getElementById("treeLines");
    const root = document.getElementById("treeRoot");
    const junction = document.getElementById("treeJunction");
    const foundation = document.getElementById("treeFoundation");
    const advanced = document.getElementById("treeAdvanced");
    if (!tree || !svg || !root || !junction || !foundation || !advanced) return;

    const nodes = [...foundation.querySelectorAll(".tree-node")];
    const advancedNodes = [...advanced.querySelectorAll(".tree-node")];
    if (!advancedNodes.length) return;

    function drawLines() {
      const w = tree.clientWidth;
      const h = tree.clientHeight;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", w);
      svg.setAttribute("height", h);

      const rootC = centerOf(root, tree);
      const juncC = centerOf(junction, tree);
      const paths = [];

      nodes.forEach((node) => {
        const nc = centerOf(node, tree);
        paths.push({
          d: bezierPath(rootC.x, rootC.bottom + 4, nc.x, nc.top - 4, 0.55),
          accent: node.dataset.physics,
        });
        paths.push({
          d: bezierPath(nc.x, nc.bottom + 4, juncC.x, juncC.top - 2, 0.45),
          accent: node.dataset.physics,
        });
      });

      advancedNodes.forEach((node) => {
        const nc = centerOf(node, tree);
        paths.push({
          d: bezierPath(juncC.x, juncC.bottom + 4, nc.x, nc.top - 4, 0.5),
          accent: node.dataset.physics,
        });
      });

      const accentColor = {
        classical: "rgba(96, 165, 250, 0.55)",
        thermo: "rgba(251, 146, 60, 0.55)",
        waves: "rgba(56, 189, 248, 0.55)",
        em: "rgba(129, 140, 248, 0.55)",
        atom: "rgba(244, 114, 182, 0.55)",
        ex: "rgba(6, 182, 212, 0.6)",
      };

      svg.innerHTML = paths.map((p, i) => {
        const stroke = accentColor[p.accent] || "rgba(148, 163, 184, 0.4)";
        return `<path class="tree-line" data-i="${i}" d="${p.d}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`;
      }).join("");

      requestAnimationFrame(() => {
        svg.querySelectorAll(".tree-line").forEach((path, i) => {
          const len = path.getTotalLength();
          path.style.strokeDasharray = `${len}`;
          path.style.strokeDashoffset = `${len}`;
          path.style.animation = `tree-line-draw 0.9s ease forwards`;
          path.style.animationDelay = `${0.08 * i}s`;
        });
      });
    }

    let resizeTimer = 0;
    function scheduleRedraw() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawLines, 80);
    }

    drawLines();
    window.addEventListener("resize", scheduleRedraw);
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(scheduleRedraw);
      ro.observe(tree);
      nodes.forEach((n) => ro.observe(n));
      advancedNodes.forEach((n) => ro.observe(n));
    }
  }

  function init() {
    redirectFromHash();
    initTreeLayout();
    if (window.PhysLaboShared) {
      PhysLaboShared.initNodeFx(document, ".tree-node[data-physics]");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
