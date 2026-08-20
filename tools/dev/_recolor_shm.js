const fs = require("fs");
const path = require("path");
const dir = __dirname;
const files = [
  "shm_sine_simulation.html",
  "shm_velocity_acceleration.html",
  "shm_energy_simulation.html",
  "shm_projection_simulation.html",
  "pendulum_shm_simulation.html",
];
const pairs = [
  ["linear-gradient(160deg, #050810 0%, #0a1020 50%, #101835 100%)", "linear-gradient(160deg, #0a1210 0%, #0f1a18 45%, #1a1428 100%)"],
  ["linear-gradient(160deg, #0a0e27 0%, #1a1040 45%, #2a1060 100%)", "linear-gradient(160deg, #0a1210 0%, #0f1a18 45%, #1a1428 100%)"],
  ["#c8e4ff", "#b8f0e8"],
  ["#8aa8cc", "#8ab8b0"],
  ["#b8cce8", "#a8d0c8"],
  ["#b8d4ff", "#b8e8e0"],
  ["#dce8ff", "#e0f5f0"],
  ["#c8dcff", "#c8f0e8"],
  ["#eef4ff", "#eefaf8"],
  ["rgba(80, 140, 255, 0.35)", "rgba(20, 184, 166, 0.35)"],
  ["rgba(140, 180, 255, 0.4)", "rgba(94, 234, 212, 0.45)"],
  ["rgba(120, 180, 255, 0.5)", "rgba(52, 211, 167, 0.45)"],
  ["rgba(120, 160, 255, 0.25)", "rgba(52, 211, 167, 0.28)"],
  ["rgba(120, 160, 255, 0.35)", "rgba(52, 211, 167, 0.35)"],
  ["rgba(120, 160, 255, 0.2)", "rgba(52, 211, 167, 0.22)"],
  ["rgba(120, 160, 255, 0.15)", "rgba(52, 211, 167, 0.15)"],
  ["rgba(20, 30, 60, 0.6)", "rgba(12, 24, 28, 0.65)"],
  ["rgba(20, 30, 60, 0.65)", "rgba(12, 24, 28, 0.72)"],
  ["rgba(20,30,60,0.65)", "rgba(12,24,28,0.72)"],
  ["rgba(80, 120, 200, 0.15)", "rgba(45, 212, 191, 0.12)"],
  ["#6699ff", "#2dd4bf"],
  ["linear-gradient(135deg, #4488ff, #6655cc)", "linear-gradient(135deg, #14b8a6, #a855f7)"],
  ["rgba(100, 140, 255, 0.45)", "rgba(45, 212, 191, 0.4)"],
  ["rgba(80, 120, 255, 0.2)", "rgba(45, 212, 191, 0.18)"],
  ["#88b0ff", "#5eead4"],
  ["#66aaff", "#2dd4bf"],
  ["#050810", "#080f0e"],
  ["#101835", "#141022"],
  ["rgba(180,210,255,", "rgba(180,255,230,"],
  ["rgba(120,160,255,0.28)", "rgba(52,211,167,0.3)"],
  ["rgba(0,220,255,0.25)", "rgba(45,212,191,0.28)"],
  ["rgba(0,220,255,0.5)", "rgba(45,212,191,0.5)"],
  ["#44ddff", "#5eead4"],
  ["rgba(68,136,255,0.45)", "rgba(249,115,22,0.5)"],
  ["#88ccff", "#fde68a"],
  ["#4488dd", "#f97316"],
  ["#2255aa", "#c2410c"],
  ["rgba(140,200,255,0.5)", "rgba(253,224,71,0.45)"],
  ["rgba(100,140,220,0.12)", "rgba(52,180,160,0.14)"],
  ["rgba(120,180,255,0.25)", "rgba(52,211,167,0.28)"],
  ["#0088dd", "#2dd4bf"],
  ["rgba(0,136,221,", "rgba(45,212,191,"],
  ["#ff6677", "#f472b6"],
  ["#cc1133", "#f472b6"],
  ["rgba(204,17,51,", "rgba(244,114,182,"],
  ["rgba(0,80,150,", "rgba(20,120,100,"],
  ["rgba(0,100,180,", "rgba(20,140,120,"],
  ["#004c99", "#0d9488"],
  ["#4a7099", "#8ab8b0"],
  ["#228844", "#34d399"],
  ["#ee4455", "#fb923c"],
  ["rgba(238,68,85,", "rgba(251,146,60,"],
  ["rgba(102,170,255,", "rgba(94,234,212,"],
  ["#667788", "#5a7a72"],
  ["#8844cc", "#a78bfa"],
  ["#ff9966", "#fbbf24"],
  ["#66ccff", "#5eead4"],
  ["#99ddff", "#99f6e4"],
  ["#ff8899", "#f472b6"],
  ["#88ffaa", "#34d399"],
  ["rgba(20, 30, 60, 0.45)", "rgba(12, 24, 28, 0.5)"],
  ["rgba(255, 255, 255, 0.45)", "rgba(12, 24, 28, 0.5)"],
];
for (const f of files) {
  let s = fs.readFileSync(path.join(dir, f), "utf8");
  let n = 0;
  for (const [a, b] of pairs) {
    const parts = s.split(a);
    if (parts.length > 1) {
      n += parts.length - 1;
      s = parts.join(b);
    }
  }
  fs.writeFileSync(path.join(dir, f), s);
  console.log(`${f}: ${n} replacements`);
}
