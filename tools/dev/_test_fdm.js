const NX = 64;
function solveTridiagonal(a, b, c, d, n) {
  const cp = new Float64Array(n);
  const dp = new Float64Array(n);
  cp[0] = c[0] / b[0];
  dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const denom = b[i] - a[i] * cp[i - 1];
    cp[i] = i < n - 1 ? c[i] / denom : 0;
    dp[i] = (d[i] - a[i] * dp[i - 1]) / denom;
  }
  const x = new Float64Array(n);
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}
const C = new Float64Array(NX);
for (let i = 0; i < NX; i++) C[i] = i / (NX - 1) < 0.5 ? 0.9 : 0.2;
const D = 5, dt = 0.04;
const dx = 1 / (NX - 1);
const r = D * dt / (dx * dx);
for (let step = 0; step < 100; step++) {
  const a = new Float64Array(NX);
  const b = new Float64Array(NX);
  const c = new Float64Array(NX);
  const rhs = new Float64Array(NX);
  for (let i = 1; i < NX - 1; i++) {
    a[i] = -r; b[i] = 1 + 2 * r; c[i] = -r; rhs[i] = C[i];
  }
  b[0] = 1 + 2 * r; c[0] = -2 * r; rhs[0] = C[0];
  a[NX - 1] = -2 * r; b[NX - 1] = 1 + 2 * r; rhs[NX - 1] = C[NX - 1];
  const next = solveTridiagonal(a, b, c, rhs, NX);
  for (let i = 0; i < NX; i++) {
    if (!Number.isFinite(next[i])) { console.log('NaN at', step, i); process.exit(1); }
    C[i] = next[i];
  }
}
console.log('OK mid=', C[32].toFixed(3), 'left=', C[0].toFixed(3), 'right=', C[63].toFixed(3));
