#!/usr/bin/env node
"use strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const HTML = path.join(ROOT, "00_physLabo_top.html");

let html = fs.readFileSync(HTML, "utf8");

const heroOld = `        <p class="hero__copy">高校物理のインタラクティブ教材。<br>式と動きで、直感的に学ぶ physLabo。</p>
      </div>`;

const heroNew = `        <p class="hero__copy">高校物理のインタラクティブ教材。<br>式と動きで、直感的に学ぶ physLabo。</p>
        <div class="hero__actions">
          <a href="#works" class="btn btn--primary hero__btn">すぐ試す</a>
          <a href="#service" class="btn btn--outline hero__btn">分野から選ぶ</a>
        </div>
      </div>`;

const worksOld = html.match(/<ul class="works__list">[\s\S]*?<\/ul>/)?.[0];
if (!worksOld) {
  console.error("works__list not found");
  process.exit(1);
}

const worksNew = `        <ul class="works__list">
          <li class="works__item reveal">
            <a href="simulation.html" class="works__card">
              <div class="works__visual works__visual--classical">
                <img src="assets/img/works/01_projectile.png?v=20260827b" alt="斜方投射シミュレーション" width="800" height="600" decoding="async">
              </div>
              <div class="works__info">
                <span class="works__num">01</span>
                <h3 class="works__title">斜方投射</h3>
                <p class="works__category">力学 · 1章</p>
              </div>
            </a>
          </li>
          <li class="works__item reveal reveal--delay-1">
            <a href="brownian_motion_simulation.html" class="works__card">
              <div class="works__visual works__visual--thermo">
                <img src="assets/img/works/02_brownian.png?v=20260827" alt="ブラウン運動シミュレーション" width="800" height="600" decoding="async">
              </div>
              <div class="works__info">
                <span class="works__num">02</span>
                <h3 class="works__title">ブラウン運動</h3>
                <p class="works__category">熱力学 · 14章</p>
              </div>
            </a>
          </li>
          <li class="works__item reveal reveal--delay-2">
            <a href="16_wave_interference.html" class="works__card">
              <div class="works__visual works__visual--waves">
                <img src="assets/img/works/03_interference.png?v=20260827e" alt="波の干渉シミュレーション" width="800" height="600" decoding="async">
              </div>
              <div class="works__info">
                <span class="works__num">03</span>
                <h3 class="works__title">波の干渉</h3>
                <p class="works__category">波動 · 16章</p>
              </div>
            </a>
          </li>
          <li class="works__item reveal reveal--delay-1">
            <a href="54_electromagnetic_induction_3D_sim.html" class="works__card">
              <div class="works__visual works__visual--em">
                <img src="assets/img/works/04_em_induction.png?v=20260827" alt="電磁誘導 3Dシミュレーション" width="800" height="600" decoding="async">
              </div>
              <div class="works__info">
                <span class="works__num">04</span>
                <h3 class="works__title">電磁誘導 3D</h3>
                <p class="works__category">電磁気 · 25章</p>
              </div>
            </a>
          </li>
          <li class="works__item reveal reveal--delay-2">
            <a href="83_atomic_models_thomson_nagaoka_rutherford_3D.html" class="works__card">
              <div class="works__visual works__visual--atom">
                <img src="assets/img/works/05_atomic_models.png?v=20260815b" alt="原子模型の歴史 3Dシミュレーション" width="800" height="600" decoding="async">
              </div>
              <div class="works__info">
                <span class="works__num">05</span>
                <h3 class="works__title">原子模型の歴史 3D</h3>
                <p class="works__category">原子 · 28章</p>
              </div>
            </a>
          </li>
          <li class="works__item reveal reveal--delay-3">
            <a href="fluorescence_phosphorescence_simulation.html" class="works__card">
              <div class="works__visual works__visual--ex">
                <img src="assets/img/works/06_fluorescence.png?v=20260815b" alt="蛍光と燐光シミュレーション" width="800" height="600" decoding="async">
              </div>
              <div class="works__info">
                <span class="works__num">06</span>
                <h3 class="works__title">蛍光と燐光</h3>
                <p class="works__category">EX章</p>
              </div>
            </a>
          </li>
        </ul>`;

if (!html.includes(heroOld)) {
  console.error("hero block not found (maybe already restored?)");
} else {
  html = html.replace(heroOld, heroNew);
}

html = html.replace(worksOld, worksNew);

fs.writeFileSync(HTML, html, "utf8");
console.log("Restored hero CTAs and works section in", HTML);
