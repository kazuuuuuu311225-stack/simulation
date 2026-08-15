#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TARGET = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "83_atomic_models_thomson_nagaoka_rutherford_3D.html"
);

let html = fs.readFileSync(TARGET, "utf8");

const cssOld = `.timeline span {
      flex: 1; min-width: 60px; text-align: center; padding: 6px 4px; border-radius: 8px;
      font-size: 0.62rem; font-weight: 700; color: #94a3b8;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.15);
    }
    .timeline span.active { color: #fde68a; border-color: rgba(251,191,36,0.55); background: rgba(251,191,36,0.12); }
    .timeline span.future { opacity: 0.45; }`;

const cssNew = `.timeline .tl-btn {
      flex: 1; min-width: 52px; text-align: center; padding: 6px 4px; border-radius: 8px;
      font-size: 0.62rem; font-weight: 700; color: #94a3b8;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(148,163,184,0.15);
      font-family: inherit; cursor: pointer;
    }
    .timeline .tl-btn.active { color: #fde68a; border-color: rgba(251,191,36,0.55); background: rgba(251,191,36,0.12); }
    .timeline .tl-btn.bohr.active { color: #bae6fd; border-color: rgba(56,189,248,0.55); background: rgba(56,189,248,0.12); }
    .timeline .tl-btn.quantum.active { color: #c4b5fd; border-color: rgba(167,139,250,0.55); background: rgba(167,139,250,0.12); }`;

const footOld = `              <button type="button" class="mode-btn" data-model="bohr">ボーア模型</button>
              <button type="button" class="mode-btn" data-model="compare">3モデル比較</button>`;

const footNew = `              <button type="button" class="mode-btn" data-model="bohr">ボーア模型</button>
              <button type="button" class="mode-btn" data-model="quantum">量子力学模型</button>
              <button type="button" class="mode-btn" data-model="compare">3モデル比較</button>`;

const timelineOld = `            <div class="timeline">
              <span id="tl1" class="active">トムソン</span>
              <span id="tl2">長岡</span>
              <span id="tl3">ラザフォード</span>
              <span id="tl4" class="future">ボーア</span>
              <span id="tl5" class="future">量子</span>
            </div>`;

const timelineNew = `            <div class="timeline">
              <button type="button" class="tl-btn active" data-model="thomson" id="tl1">トムソン</button>
              <button type="button" class="tl-btn" data-model="nagaoka" id="tl2">長岡</button>
              <button type="button" class="tl-btn" data-model="rutherford" id="tl3">ラザフォード</button>
              <button type="button" class="tl-btn bohr" data-model="bohr" id="tl4">ボーア</button>
              <button type="button" class="tl-btn quantum" data-model="quantum" id="tl5">量子</button>
            </div>`;

const quantumDataOld = `        compare: {
          name: "3モデル比較モード",`;

const quantumDataNew = `        quantum: {
          name: "量子力学模型（電子雲）",
          year: "1926年〜 · シュレーディンガー",
          charge: "正電荷は原子核に集中",
          electron: "電子は<strong>確率雲</strong>として分布 — 軌道ではなく存在確率",
          evidence: "電子回折実験 · 水素原子の解 · 多電子原子のスペクトル",
          problem: "確率解釈は直感に反するが、現代化学の基礎",
          hint: "電子は「どこにあるか」ではなく「見つかる確率」で記述される。電子雲の形が結合や反応を決める。",
        },
        compare: {
          name: "3モデル比較モード",`;

const varsOld = `      let scene, camera, renderer, worldGroup;
      let thomsonGroup, nagaokaGroup, rutherfordGroup, bohrGroup, compareRoot;
      let alphaParticles = [];
      let electronData = [];`;

const varsNew = `      let scene, camera, renderer, worldGroup;
      let singleThomson, singleNagaoka, singleRutherford, singleBohr, singleQuantum;
      let compareThomson, compareNagaoka, compareRutherford, compareRoot;
      let alphaParticles = [];`;

const scriptStart = html.indexOf("      function buildBohr(parent, scale) {");
const scriptEnd = html.indexOf("      function bindControls() {");
const tailStart = html.indexOf("      function animate(now) {");

if (scriptStart < 0 || scriptEnd < 0 || tailStart < 0) {
  console.error("Could not locate script patch region");
  process.exit(1);
}

const scriptMid = `      function buildCompareScene() {
        compareRoot = new THREE.Group();
        compareThomson = buildThomson(compareRoot, 0.55);
        compareThomson.position.set(-2.8, 0, 0);
        compareNagaoka = buildNagaoka(compareRoot, 0.55);
        compareNagaoka.position.set(0, 0, 0);
        compareRutherford = buildRutherford(compareRoot, 0.55);
        compareRutherford.position.set(2.8, 0, 0);
        worldGroup.add(compareRoot);
        compareRoot.visible = false;
      }

      function buildSingleScene() {
        singleThomson = buildThomson(worldGroup, 1);
        singleNagaoka = buildNagaoka(worldGroup, 1);
        singleRutherford = buildRutherford(worldGroup, 1);
        singleBohr = buildBohr(worldGroup, 1);
        singleQuantum = buildQuantum(worldGroup, 1);
        singleNagaoka.visible = false;
        singleRutherford.visible = false;
        singleBohr.visible = false;
        singleQuantum.visible = false;
      }

      function buildBohr(parent, scale) {
        const g = new THREE.Group();
        const nucleus = new THREE.Mesh(
          new THREE.SphereGeometry(0.16 * scale, 20, 20),
          new THREE.MeshPhysicalMaterial({
            color: 0xf87171, emissive: 0xff4444, emissiveIntensity: 1.3,
            metalness: 0.4, roughness: 0.15,
          })
        );
        g.add(nucleus);
        const orbitRadii = [0.55, 0.95, 1.35];
        const orbitColors = [0x38bdf8, 0x4ade80, 0xfbbf24];
        const electrons = [];
        orbitRadii.forEach((r, oi) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(r * scale, 0.022, 8, 64),
            new THREE.MeshBasicMaterial({
              color: orbitColors[oi], transparent: true, opacity: 0.55, side: THREE.DoubleSide,
            })
          );
          ring.rotation.x = Math.PI / 2;
          g.add(ring);
          const e = makeElectronMesh();
          e.userData = {
            type: "bohr",
            angle: (oi / 3) * Math.PI * 2,
            speed: 1.2 + oi * 0.35,
            radius: r * scale,
          };
          g.add(e);
          electrons.push(e);
        });
        g.userData.electrons = electrons;
        parent.add(g);
        return g;
      }

      function buildQuantum(parent, scale) {
        const g = new THREE.Group();
        const nucleus = new THREE.Mesh(
          new THREE.SphereGeometry(0.16 * scale, 20, 20),
          new THREE.MeshPhysicalMaterial({
            color: 0xf87171, emissive: 0xff4444, emissiveIntensity: 1.2,
            metalness: 0.4, roughness: 0.15,
          })
        );
        g.add(nucleus);
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(1.05 * scale, 32, 32),
          new THREE.MeshPhysicalMaterial({
            color: 0x818cf8, emissive: 0x6366f1, emissiveIntensity: 0.35,
            transparent: true, opacity: 0.14, metalness: 0.1, roughness: 0.6,
          })
        );
        g.add(shell);
        const electrons = [];
        for (let i = 0; i < 72; i += 1) {
          const e = makeElectronMesh();
          e.scale.setScalar(0.55);
          const th = Math.random() * Math.PI * 2;
          const ph = Math.acos(2 * Math.random() - 1);
          const r = (0.25 + Math.random() * 0.75) * scale;
          e.userData = {
            type: "quantum",
            th, ph, r,
            phase: Math.random() * Math.PI * 2,
            drift: 0.04 + Math.random() * 0.06,
          };
          g.add(e);
          electrons.push(e);
        }
        g.userData.electrons = electrons;
        parent.add(g);
        return g;
      }

      function spawnAlpha() {
        alphaParticles = [];
        for (let i = 0; i < 5; i++) {
          const m = new THREE.Mesh(
            new THREE.SphereGeometry(0.06, 10, 10),
            new THREE.MeshPhysicalMaterial({
              color: 0xfde047, emissive: 0xfbbf24, emissiveIntensity: 1.5,
            })
          );
          m.userData = {
            x: -5 + i * 0.3,
            z: (Math.random() - 0.5) * 0.5,
            vx: 0.045 + Math.random() * 0.01,
            vz: 0,
            scattered: false,
            life: 0,
          };
          worldGroup.add(m);
          alphaParticles.push(m);
        }
        alphaDemo = true;
      }

      function updateElectrons(t) {
        function updateGroup(grp) {
          if (!grp || !grp.userData.electrons) return;
          grp.userData.electrons.forEach((e) => {
            const d = e.userData;
            if (d.type === "thomson") {
              const wob = d.amp * Math.sin(t * 2 + d.phase);
              const r = d.baseR + wob;
              e.position.set(
                r * Math.sin(d.ph) * Math.cos(d.th + t * 0.15),
                r * Math.cos(d.ph) + wob * 0.5,
                r * Math.sin(d.ph) * Math.sin(d.th + t * 0.15)
              );
            } else if (d.type === "nagaoka") {
              const ang = d.angle + t * d.speed;
              e.position.set(
                Math.cos(ang) * d.radius,
                Math.sin(ang) * d.tilt,
                Math.sin(ang) * d.radius
              );
            } else if (d.type === "rutherford") {
              const ang = d.angle + t * d.speed;
              const yf = d.plane === 0 ? 0.35 : d.plane === 1 ? 0.55 : 0.2;
              const zf = d.plane === 0 ? 0.2 : d.plane === 1 ? 0.1 : 0.45;
              e.position.set(
                Math.cos(ang) * d.radius,
                Math.sin(ang) * d.radius * yf,
                Math.sin(ang) * d.radius * zf
              );
            } else if (d.type === "bohr") {
              const ang = d.angle + t * d.speed;
              e.position.set(Math.cos(ang) * d.radius, 0, Math.sin(ang) * d.radius);
            } else if (d.type === "quantum") {
              const pulse = d.drift * Math.sin(t * 2.2 + d.phase);
              const r = d.r + pulse;
              e.position.set(
                r * Math.sin(d.ph) * Math.cos(d.th + t * d.drift),
                r * Math.cos(d.ph),
                r * Math.sin(d.ph) * Math.sin(d.th + t * d.drift)
              );
            }
          });
        }
        updateGroup(singleThomson);
        updateGroup(singleNagaoka);
        updateGroup(singleRutherford);
        updateGroup(singleBohr);
        updateGroup(singleQuantum);
        updateGroup(compareThomson);
        updateGroup(compareNagaoka);
        updateGroup(compareRutherford);
      }

      function updateAlpha(dt) {
        if (!alphaDemo) return;
        const nucX = model === "compare" ? 2.8 : 0;
        alphaParticles.forEach((p) => {
          const d = p.userData;
          d.life += dt;
          if (!d.scattered && d.x > nucX - 0.5 && Math.random() < 0.08) {
            d.scattered = true;
            d.vx = -0.02 - Math.random() * 0.03;
            d.vz = (Math.random() - 0.5) * 0.06;
          }
          if (d.scattered && d.x < nucX + 0.3 && Math.random() < 0.03) {
            d.vx = 0.04;
            d.vz = (Math.random() - 0.5) * 0.08;
          }
          d.x += d.vx;
          d.z += d.vz;
          p.position.set(d.x, 0.2, d.z);
          if (d.life > 12) {
            d.x = -5;
            d.z = (Math.random() - 0.5) * 0.5;
            d.vx = 0.045;
            d.vz = 0;
            d.scattered = false;
            d.life = 0;
          }
        });
      }

      function setModelVisual() {
        const isCompare = model === "compare" || targetModel === "compare";
        const s = lerp(0.55, 1, blend);

        [singleThomson, singleNagaoka, singleRutherford, singleBohr, singleQuantum].forEach((grp) => {
          if (grp) grp.visible = false;
        });

        if (compareRoot) compareRoot.visible = isCompare && blend > 0.5;

        if (isCompare) {
          compareThomson.visible = true;
          compareNagaoka.visible = true;
          compareRutherford.visible = true;
          return;
        }

        if (model === "bohr" || targetModel === "bohr") {
          singleBohr.visible = true;
          singleBohr.scale.setScalar(s);
          return;
        }
        if (model === "quantum" || targetModel === "quantum") {
          singleQuantum.visible = true;
          singleQuantum.scale.setScalar(s);
          return;
        }

        singleThomson.visible = model === "thomson" || targetModel === "thomson";
        singleNagaoka.visible = model === "nagaoka" || targetModel === "nagaoka";
        singleRutherford.visible = model === "rutherford" || targetModel === "rutherford";
        singleThomson.scale.setScalar(model === "thomson" ? s : 0.001);
        singleNagaoka.scale.setScalar(model === "nagaoka" ? s : 0.001);
        singleRutherford.scale.setScalar(model === "rutherford" ? s : 0.001);
      }

      function updateHUD() {
        const data = MODEL_DATA[model] || MODEL_DATA.thomson;
        document.getElementById("hudName").textContent = data.name;
        document.getElementById("hudYear").textContent = data.year;
        document.getElementById("hudCharge").innerHTML = data.charge;
        document.getElementById("hudElectron").innerHTML = data.electron;
        document.getElementById("hudEvidence").innerHTML = data.evidence;
        document.getElementById("hudProblem").innerHTML = data.problem;
        document.getElementById("hintText").innerHTML = data.hint;

        document.getElementById("modeBadge").textContent =
          data.name + "\\n" + data.year;

        document.getElementById("statusBadge").textContent =
          alphaDemo ? "α線散乱デモ再生中" : "ドラッグで回転 · スクロールで拡大";

        document.getElementById("tl1").classList.toggle("active", model === "thomson" || model === "compare");
        document.getElementById("tl2").classList.toggle("active", model === "nagaoka" || model === "compare");
        document.getElementById("tl3").classList.toggle("active", model === "rutherford" || model === "compare");
        document.getElementById("tl4").classList.toggle("active", model === "bohr");
        document.getElementById("tl5").classList.toggle("active", model === "quantum");

        document.getElementById("step1").classList.toggle("active", model === "thomson");
        document.getElementById("step2").classList.toggle("active", model === "nagaoka");
        document.getElementById("step3").classList.toggle("active", model === "rutherford");
        document.getElementById("step4").classList.toggle("active", model === "bohr" || model === "quantum");

        document.querySelectorAll(".mode-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.model === model);
        });
        document.getElementById("btnAlpha").classList.toggle("active", alphaDemo);
      }

      function selectModel(m) {
        targetModel = m;
        model = m;
        blend = 1;
        if (m !== "rutherford" && m !== "compare") alphaDemo = false;
        alphaParticles.forEach((p) => worldGroup.remove(p));
        alphaParticles = [];
        setModelVisual();
        updateHUD();
      }

      function initThree() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0A0A0A);
        const w = Math.max(wrap.clientWidth, 1), h = Math.max(wrap.clientHeight, 320);
        camera = new THREE.PerspectiveCamera(48, w / h, 0.05, 80);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.setSize(w, h);
        wrap.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0x404060, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(4, 6, 3);
        scene.add(key);
        const rim = new THREE.PointLight(0xfbbf24, 0.5, 20);
        rim.position.set(-3, 2, 2);
        scene.add(rim);

        worldGroup = new THREE.Group();
        scene.add(worldGroup);

        buildSingleScene();
        buildCompareScene();

        const grid = new THREE.GridHelper(14, 28, 0x475569, 0x1e293b);
        grid.position.y = -1.6;
        worldGroup.add(grid);

        renderer.domElement.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; ly = e.clientY; });
        renderer.domElement.addEventListener("pointermove", (e) => {
          if (!dragging) return;
          rotY += (e.clientX - lx) * 0.008;
          rotX += (e.clientY - ly) * 0.008;
          rotX = clamp(rotX, -0.9, 0.9);
          lx = e.clientX; ly = e.clientY;
        });
        renderer.domElement.addEventListener("pointerup", () => { dragging = false; });
        renderer.domElement.addEventListener("pointerleave", () => { dragging = false; });
        wrap.addEventListener("wheel", (e) => {
          e.preventDefault();
          zoom = clamp(zoom + e.deltaY * 0.006, 6, 18);
        }, { passive: false });
        new ResizeObserver(() => {
          const rw = Math.max(wrap.clientWidth, 1), rh = Math.max(wrap.clientHeight, 320);
          renderer.setSize(rw, rh);
          camera.aspect = rw / rh;
          camera.updateProjectionMatrix();
        }).observe(wrap);
      }

`;

const bindControlsNew = `      function bindControls() {
        document.querySelectorAll(".mode-btn").forEach((b) => {
          b.addEventListener("click", () => selectModel(b.dataset.model));
        });
        document.querySelectorAll(".tl-btn").forEach((b) => {
          b.addEventListener("click", () => selectModel(b.dataset.model));
        });
        document.getElementById("btnAlpha").addEventListener("click", () => {
          selectModel("rutherford");
          alphaParticles.forEach((p) => worldGroup.remove(p));
          spawnAlpha();
        });
        document.getElementById("btnSpin").addEventListener("click", () => {
          autoSpin = !autoSpin;
          document.getElementById("btnSpin").classList.toggle("active", autoSpin);
        });
        document.getElementById("btnResetView").addEventListener("click", () => {
          rotX = INIT_ROT_X; rotY = INIT_ROT_Y; zoom = INIT_ZOOM;
        });
      }

`;

html = html.replace(cssOld, cssNew);
html = html.replace(footOld, footNew);
html = html.replace(timelineOld, timelineNew);
html = html.replace(quantumDataOld, quantumDataNew);
html = html.replace(varsOld, varsNew);

const before = html.slice(0, scriptStart);
const tail = html.slice(tailStart);
html = before + scriptMid + bindControlsNew + tail;

fs.writeFileSync(TARGET, html, "utf8");
console.log("Fixed", TARGET);
