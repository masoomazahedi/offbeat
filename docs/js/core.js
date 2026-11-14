/* OFFBEAT - Data, rules and shared helpers.
   Decodes data.js, applies the three rules to every hectare, and holds the page state.
   Everything else reads from here. Load this file first.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Data ---------- */
const D = window.OFFBEAT_DATA;
const i16 = (s) => {
  const bin = atob(s),
    b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new Int16Array(b.buffer);
};
const POS = i16(D.pos),
  HV = i16(D.hv),
  HH = i16(D.hh),
  NB = i16(D.nb);
const T = D.dates.length,
  N = D.n,
  ROWS = D.rows,
  COLS = D.cols;
const $ = (id) => document.getElementById(id);
const cur = (a, i) => {
  const o = new Array(T);
  for (let t = 0; t < T; t++) o[t] = a[i * T + t] / 100;
  return o;
};
const MON = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['', '', '', '', '', '', 'June', 'July', 'August', 'September', 'October'];
const dshort = (t) => `${+D.dates[t].slice(8)} ${MON[+D.dates[t].slice(5, 7)]}`;
const dlong = (t) => `${+D.dates[t].slice(8)} ${MONL[+D.dates[t].slice(5, 7)]}`;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const times = (db) => Math.pow(10, db / 10);
const sgn = (k) => (k >= 0 ? '+' : '−') + Math.abs(k).toFixed(2);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Science (rules unchanged) ---------- */
// Rule 1: swing between weakest and strongest pass. Rule 2: which pass was strongest.
// Rule 3: correlation of the ten values with the average of active neighbours.
const RG = new Float32Array(N),
  K = new Float32Array(N),
  PK = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  let lo = 99,
    hi = -99,
    ma = 0,
    mb = 0;
  for (let t = 0; t < T; t++) {
    const v = HV[i * T + t] / 100;
    if (v < lo) lo = v;
    if (v > hi) {
      hi = v;
      PK[i] = t;
    }
    ma += v;
    mb += NB[i * T + t] / 100;
  }
  ma /= T;
  mb /= T;
  let n = 0,
    da = 0,
    db = 0;
  for (let t = 0; t < T; t++) {
    const x = HV[i * T + t] / 100 - ma,
      y = NB[i * T + t] / 100 - mb;
    n += x * y;
    da += x * x;
    db += y * y;
  }
  RG[i] = hi - lo;
  K[i] = da > 0 && db > 0 ? n / Math.sqrt(da * db) : 0;
}
const idxAt = new Int32Array(ROWS * COLS).fill(-1);
for (let i = 0; i < N; i++) idxAt[POS[i * 2] * COLS + POS[i * 2 + 1]] = i;
// Active neighbours (standard 3 dB rule) within half a kilometre, itself excluded.
const CNT = new Uint16Array(N);
for (let i = 0; i < N; i++) {
  const r = POS[i * 2],
    c = POS[i * 2 + 1];
  let n = 0;
  for (let rr = Math.max(0, r - 5); rr <= Math.min(ROWS - 1, r + 5); rr++)
    for (let cc = Math.max(0, c - 5); cc <= Math.min(COLS - 1, c + 5); cc++) {
      const q = idxAt[rr * COLS + cc];
      if (q >= 0 && q !== i && RG[q] >= 3) n++;
    }
  CNT[i] = n;
}
const MINNB = 4,
  SUMMER = 4,
  STD = 3,
  B = 50;

/* ---------- State ---------- */
const S = { sel: null, thr: STD, layer: 'step', ch: 'hv', alpha: 0.85 };
// classes: 0 no clear season, 1 in step, 2 out of step, 4 too isolated
const cls = (i) => (RG[i] < S.thr ? 0 : CNT[i] < MINNB ? 4 : K[i] >= 0.3 ? 1 : 2);
const CLASS = {
  0: ['No clear season', '--quiet', '#6b6558'],
  1: ['In step', '--step', '#17695b'],
  2: ['Out of step', '--off', '#a85a10'],
  4: ['Too isolated to compare', '--iso', '#5b4f8c'],
};
const RAMP = [
  '#440154',
  '#482878',
  '#3e4a89',
  '#31688e',
  '#26828e',
  '#1f9e89',
  '#35b779',
  '#6dcd59',
  '#b4de2c',
  '#fde725',
];
const latlon = (r, c) => {
  const g = [1, r, c, r * c];
  return [D.clat.reduce((s, v, j) => s + v * g[j], 0), D.clon.reduce((s, v, j) => s + v * g[j], 0)];
};
const LAT = new Float64Array(N),
  LON = new Float64Array(N);
let la0 = 90,
  la1 = -90,
  lo0 = 180,
  lo1 = -180;
for (let i = 0; i < N; i++) {
  const p = latlon(POS[i * 2], POS[i * 2 + 1]);
  LAT[i] = p[0];
  LON[i] = p[1];
  if (p[0] < la0) la0 = p[0];
  if (p[0] > la1) la1 = p[0];
  if (p[1] < lo0) lo0 = p[1];
  if (p[1] > lo1) lo1 = p[1];
}
const CITY = latlon(D.city[0], D.city[1]);
const fromCity = (la, lo) => {
  const n = (la - CITY[0]) * 111.2,
    e = (lo - CITY[1]) * 111.32 * Math.cos((la * Math.PI) / 180),
    parts = [];
  if (Math.hypot(n, e) < 0.7) return 'In Herat city centre';
  if (Math.abs(e) >= 0.5) parts.push(`${Math.abs(e).toFixed(1)} km ${e > 0 ? 'east' : 'west'}`);
  if (Math.abs(n) >= 0.5) parts.push(`${Math.abs(n).toFixed(1)} km ${n > 0 ? 'north' : 'south'}`);
  return parts.join(' and ') + ' of Herat city centre';
};
const nearest = (la, lo) => {
  const kx = Math.cos((la * Math.PI) / 180);
  let best = -1,
    bd = 1e9;
  for (let i = 0; i < N; i++) {
    const dy = LAT[i] - la,
      dx = (LON[i] - lo) * kx,
      d = dx * dx + dy * dy;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return [best, Math.sqrt(bd) * 111200];
};
