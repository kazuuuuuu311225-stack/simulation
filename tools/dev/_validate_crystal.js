const DEG = Math.PI / 180;
function fracToCart(fx, fy, fz, mat) {
  const { a, b, c, alpha, beta, gamma, lattice } = mat;
  if (lattice === "HCP" || (lattice === "Hexagonal" && Math.abs(gamma - 120) < 0.1)) {
    return { x: a * (fx + fy * 0.5), y: a * (Math.sqrt(3) / 2) * fy, z: c * fz };
  }
  const al = alpha * DEG, be = beta * DEG, ga = gamma * DEG;
  const cosA = Math.cos(al), cosB = Math.cos(be), cosG = Math.cos(ga);
  const sinG = Math.sin(ga);
  const vol = Math.sqrt(Math.max(1e-8, 1 - cosA * cosA - cosB * cosB - cosG * cosG + 2 * cosA * cosB * cosG));
  return {
    x: a * fx + b * fy * cosG + c * fz * cosB,
    y: b * fy * sinG + c * fz * (cosA - cosB * cosG) / sinG,
    z: c * fz * vol / sinG,
  };
}
function dist(p, q) { return Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z); }
function origin() { return { x: 0, y: 0, z: 0 }; }

const nacl = { a: 5.64, b: 5.64, c: 5.64, alpha: 90, beta: 90, gamma: 90, lattice: "Rocksalt" };
const basis = [
  { el: "Cl", x: 0, y: 0, z: 0 }, { el: "Cl", x: 0.5, y: 0.5, z: 0 },
  { el: "Cl", x: 0.5, y: 0, z: 0.5 }, { el: "Cl", x: 0, y: 0.5, z: 0.5 },
  { el: "Na", x: 0.5, y: 0, z: 0 }, { el: "Na", x: 0, y: 0.5, z: 0 },
  { el: "Na", x: 0, y: 0, z: 0.5 }, { el: "Na", x: 0.5, y: 0.5, z: 0.5 },
];
const pos = basis.map((b) => ({ ...b, ...fracToCart(b.x, b.y, b.z, nacl) }));
const cl0 = pos.find((p) => p.el === "Cl" && p.x === 0);
const naD = pos.filter((p) => p.el === "Na").map((p) => dist(cl0, p));
console.log("NaCl Na-Cl:", naD.map((d) => d.toFixed(3)).join(", "), "exp", (nacl.a / 2).toFixed(3));

const cu = { a: 3.61, b: 3.61, c: 3.61, alpha: 90, beta: 90, gamma: 90, lattice: "FCC" };
console.log("FCC NN:", dist(fracToCart(0, 0, 0, cu), fracToCart(0.5, 0.5, 0, cu)).toFixed(3), "exp", (cu.a / Math.sqrt(2)).toFixed(3));

const fe = { a: 2.87, b: 2.87, c: 2.87, alpha: 90, beta: 90, gamma: 90, lattice: "BCC" };
console.log("BCC NN:", dist(fracToCart(0, 0, 0, fe), fracToCart(0.5, 0.5, 0.5, fe)).toFixed(3), "exp", (fe.a * Math.sqrt(3) / 2).toFixed(3));

const bi = { a: 4.75, b: 4.75, c: 4.75, alpha: 57.14, beta: 57.14, gamma: 57.14, lattice: "Rhombohedral" };
console.log("Bi dist:", dist(fracToCart(0.237, 0.237, 0.237, bi), fracToCart(0.763, 0.763, 0.763, bi)).toFixed(3));

const mg = { a: 3.21, b: 3.21, c: 5.21, alpha: 90, beta: 90, gamma: 120, lattice: "HCP" };
console.log("HCP NN:", dist(fracToCart(0, 0, 0, mg), fracToCart(1 / 3, 2 / 3, 0.5, mg)).toFixed(3));

const gyp = { a: 5.68, b: 15.18, c: 6.52, alpha: 90, beta: 118.43, gamma: 90, lattice: "Monoclinic" };
const va = fracToCart(1, 0, 0, gyp), vc = fracToCart(0, 0, 1, gyp);
console.log("Monoclinic beta:", (Math.acos((va.x * vc.x + va.y * vc.y + va.z * vc.z) / (dist(origin(), va) * dist(origin(), vc))) * 180 / Math.PI).toFixed(2));
