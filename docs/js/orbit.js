/* OFFBEAT - How it would run in orbit.
   Replays the analysis one pass at a time with a fixed-size running summary, and draws the timeline.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Streaming replay ---------- */
// Streaming replay: one pass at a time, a fixed-size summary per cell, nothing from the future.
const RP = (() => {
  const mn = new Float32Array(N).fill(99),
    mx = new Float32Array(N).fill(-99);
  const sx = new Float64Array(N),
    sy = new Float64Array(N),
    sxy = new Float64Array(N),
    sxx = new Float64Array(N),
    syy = new Float64Array(N);
  const W1 = COLS + 1,
    sat = () => new Float64Array((ROWS + 1) * W1),
    snaps = [],
    R = 5;
  for (let t = 0; t < T; t++) {
    const act = new Uint8Array(N),
      v = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      v[i] = HV[i * T + t] / 100;
      if (v[i] < mn[i]) mn[i] = v[i];
      if (v[i] > mx[i]) mx[i] = v[i];
      act[i] = mx[i] - mn[i] >= 3 ? 1 : 0;
    }
    const sA = sat(),
      cA = sat(),
      sL = sat(),
      cL = sat();
    for (let r = 0; r < ROWS; r++) {
      let a = 0,
        b = 0,
        e = 0,
        d = 0;
      for (let c = 0; c < COLS; c++) {
        const i = idxAt[r * COLS + c];
        if (i >= 0) {
          e += v[i];
          d += 1;
          if (act[i]) {
            a += v[i];
            b += 1;
          }
        }
        const o = (r + 1) * W1 + c + 1,
          u = r * W1 + c + 1;
        sA[o] = sA[u] + a;
        cA[o] = cA[u] + b;
        sL[o] = sL[u] + e;
        cL[o] = cL[u] + d;
      }
    }
    const box = (s, r0, c0, r1, c1) => s[r1 * W1 + c1] - s[r0 * W1 + c1] - s[r1 * W1 + c0] + s[r0 * W1 + c0];
    const cl = new Uint8Array(N),
      n = t + 1;
    for (let i = 0; i < N; i++) {
      const r = POS[i * 2],
        c = POS[i * 2 + 1];
      const r0 = Math.max(0, r - R),
        r1 = Math.min(ROWS, r + R + 1),
        c0 = Math.max(0, c - R),
        c1 = Math.min(COLS, c + R + 1);
      let sa = box(sA, r0, c0, r1, c1),
        ca = box(cA, r0, c0, r1, c1);
      if (act[i]) {
        sa -= v[i];
        ca -= 1;
      }
      const y = ca >= 4 ? sa / ca : box(sL, r0, c0, r1, c1) / box(cL, r0, c0, r1, c1);
      sx[i] += v[i];
      sy[i] += y;
      sxy[i] += v[i] * y;
      sxx[i] += v[i] * v[i];
      syy[i] += y * y;
      if (!act[i]) continue;
      if (n < 4) {
        cl[i] = 1;
        continue;
      }
      if (ca < MINNB) {
        cl[i] = 4;
        continue;
      }
      const cov = sxy[i] - (sx[i] * sy[i]) / n,
        vx = sxx[i] - (sx[i] * sx[i]) / n,
        vy = syy[i] - (sy[i] * sy[i]) / n;
      cl[i] = (vx > 1e-9 && vy > 1e-9 ? cov / Math.sqrt(vx * vy) : 0) >= 0.3 ? 1 : 2;
    }
    const seen = new Uint8Array(N);
    let places = 0;
    for (let i = 0; i < N; i++) {
      if (cl[i] !== 2 || seen[i]) continue;
      let size = 0;
      const st = [i];
      seen[i] = 1;
      while (st.length) {
        const j = st.pop();
        size++;
        const r = POS[j * 2],
          c = POS[j * 2 + 1];
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr,
              cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= ROWS || cc >= COLS) continue;
            const q = idxAt[rr * COLS + cc];
            if (q >= 0 && cl[q] === 2 && !seen[q]) {
              seen[q] = 1;
              st.push(q);
            }
          }
      }
      if (size >= 2) places++;
    }
    snaps.push({ cl, places });
  }
  return { snaps, stateBytes: N * 24 };
})();

/* ---------- Orbit ---------- */
const kb = (b) => (b < 1024 ? b + ' bytes' : (b / 1024).toFixed(1) + ' KB');
const mini = $('mini');
mini.width = COLS;
mini.height = ROWS;
const hex = (v) => {
  const c = css(v).replace('#', '');
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
};
const MINICOL = { 0: [205, 200, 188], 1: hex('--step'), 2: hex('--off'), 4: hex('--iso') };
let orT = T - 1,
  orTimer = null;
function orbitShow(t) {
  orT = t;
  const sn = RP.snaps[t],
    g = mini.getContext('2d'),
    img = g.createImageData(COLS, ROWS);
  for (let i = 0; i < N; i++) {
    const o = (POS[i * 2] * COLS + POS[i * 2 + 1]) * 4,
      c = MINICOL[sn.cl[i]];
    img.data[o] = c[0];
    img.data[o + 1] = c[1];
    img.data[o + 2] = c[2];
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  document.querySelectorAll('#tl button').forEach((b, j) => {
    b.className = j < t ? 'done' : j === t ? 'cur' : '';
    b.setAttribute('aria-current', j === t ? 'step' : 'false');
  });
  $('or-lab').textContent = `Pass ${t + 1} of ${T} · ${dlong(t)}`;
  $('or-raw').textContent = `≈ ${7 * (t + 1)} GB`;
  $('or-keep').textContent = (RP.stateBytes / 1048576).toFixed(1) + ' MB';
  $('or-places').textContent = t < 3 ? 'none yet' : sn.places;
  $('or-bytes').textContent = t < 3 ? '0 bytes' : kb(sn.places * 10);
  $('or-note').textContent =
    t < 3
      ? 'Green here only means "has started to change". The comparison with neighbours begins at pass 4, because a match score needs at least four points.'
      : 'Each flagged place is sent as ten bytes: position, size and match score. The running summary stays the same size however many passes go by.';
}
$('tl').innerHTML = D.dates
  .map(
    (d, t) =>
      `<button aria-label="Pass ${t + 1}, ${dlong(t)}"><i>${t + 1}</i><span>${dshort(t)}</span></button>`,
  )
  .join('');
document.querySelectorAll('#tl button').forEach(
  (b, t) =>
    (b.onclick = () => {
      clearInterval(orTimer);
      orbitShow(t);
    }),
);
$('or-play').onclick = () => {
  clearInterval(orTimer);
  let t = 0;
  orbitShow(0);
  orTimer = setInterval(
    () => {
      if (++t >= T) return clearInterval(orTimer);
      orbitShow(t);
    },
    REDUCED ? 1400 : 900,
  );
};
{
  const last = RP.snaps[T - 1];
  $('or-state').textContent = (RP.stateBytes / 1048576).toFixed(1) + ' MB';
  $('or-msg').textContent = kb(last.places * 10);
}
