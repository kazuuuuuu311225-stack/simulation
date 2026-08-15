const L_M = 0.10, pad = L_M * 0.018, lo = pad, hi = L_M - pad;
const KB = 1.380649e-23, m = 6.64e-27, T = 300, VIS = 28;
function randNormal() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function vTyp() { return Math.sqrt(3 * KB * T / m); }
function visMove() { return (L_M * 0.92) / (Math.max(vTyp(), 80) * 0.04 * VIS); }
function hitWall(p, axis, vKey, faceLo, faceHi, oAxis, hits) {
  if (p[axis] <= lo) {
    if (p[vKey] < 0 && oAxis > lo) hits[faceLo] = (hits[faceLo] || 0) + 1;
    p[axis] = lo; p[vKey] = Math.abs(p[vKey]) || 1;
  } else if (p[axis] >= hi) {
    if (p[vKey] > 0 && oAxis < hi) hits[faceHi] = (hits[faceHi] || 0) + 1;
    p[axis] = hi; p[vKey] = -Math.abs(p[vKey]) || -1;
  }
}
const move = visMove(), dt = 0.04, brown = Math.sqrt(KB * T / m) * 0.004;
const hits = {};
let p = { px: 0.05, py: 0.05, pz: 0.05, vx: 800, vy: 600, vz: 400 };
for (let i = 0; i < 50000; i++) {
  p.vx += randNormal() * brown * Math.sqrt(dt);
  p.vy += randNormal() * brown * Math.sqrt(dt);
  p.vz += randNormal() * brown * Math.sqrt(dt);
  const ox = p.px, oy = p.py, oz = p.pz;
  p.px += p.vx * dt * move; p.py += p.vy * dt * move; p.pz += p.vz * dt * move;
  hitWall(p, "px", "vx", "mx", "px", ox, hits);
  hitWall(p, "py", "vy", "my", "py", oy, hits);
  hitWall(p, "pz", "vz", "mz", "pz", oz, hits);
}
console.log(JSON.stringify(hits, null, 2));
