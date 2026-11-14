/* OFFBEAT - Listen to the season.
   Turns the ten measurements into rhythm, with play, pause and restart, and the three examples.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Sound ---------- */
// Rhythm carries the shape: rising = fast beeps, falling = slow beeps, no clear season = a steady
// tick, and a patch that keeps reversing gets uneven timing. This rule is unchanged.
function rhythm(series, active) {
  const d = [],
    beats = [];
  for (let t = 1; t < series.length; t++) d.push(series[t] - series[t - 1]);
  let flips = 0;
  for (let i = 1; i < d.length; i++) if (Math.sign(d[i]) !== Math.sign(d[i - 1])) flips++;
  const jitter = active ? Math.min(0.45, (flips / d.length) * 0.7) : 0;
  const xs = [-2, -0.5, 0, 0.5, 2],
    ys = [1, 2, 3, 4.5, 8];
  for (const v of d) {
    if (!active) {
      beats.push(3);
      continue;
    }
    let n = ys[0];
    for (let i = 1; i < xs.length; i++)
      if (v >= xs[i - 1])
        n = ys[i - 1] + ((ys[i] - ys[i - 1]) * (Math.min(v, xs[i]) - xs[i - 1])) / (xs[i] - xs[i - 1]);
    beats.push(Math.max(1, Math.min(8, Math.round(n))));
  }
  return { beats, jitter, d };
}
let actx = null;
const SND = { timer: null, step: 0, plan: null, on: false };
const SPAN = 0.55,
  GAP = 0.6;
function beep(at, freq, gain) {
  const o = actx.createOscillator(),
    g = actx.createGain();
  o.type = 'square';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0006, at + 0.075);
  o.connect(g);
  g.connect(actx.destination);
  o.start(at);
  o.stop(at + 0.09);
}
function buildPlan() {
  const i = S.sel,
    active = RG[i] >= S.thr,
    hhMode = S.ch === 'hh';
  const voices = hhMode
    ? [[cur(HH, i), 660, 0.16, css('--blue'), 'This hectare, HH']]
    : [
        [cur(HV, i), 660, 0.16, css('--blue'), 'This hectare'],
        [cur(NB, i), 440, 0.12, '#5d6470', 'Its changing neighbours'],
      ];
  return voices.map(([ser, freq, gain, color, name]) => ({
    ser,
    freq,
    gain,
    color,
    name,
    ...rhythm(ser, active),
    active,
  }));
}
function tick() {
  const per = T - 1,
    total = SND.plan.length * per;
  if (SND.step >= total) {
    stopSound(true);
    $('now').textContent = 'Finished.';
    return;
  }
  const v = SND.plan[Math.floor(SND.step / per)],
    i = SND.step % per,
    nb = v.beats[i],
    t0 = actx.currentTime + 0.04;
  for (let b = 0; b < nb; b++) {
    const j = v.jitter ? (Math.random() - 0.5) * 2 * v.jitter * (SPAN / nb) : 0;
    beep(t0 + Math.max(0, (b * SPAN) / nb + j), v.freq, v.gain);
  }
  const dot = document.getElementById('dot');
  if (dot && CH) {
    dot.setAttribute('cx', CH.X(i + 1));
    dot.setAttribute('cy', CH.Y(v.ser[i + 1]));
    dot.setAttribute('stroke', v.color);
    dot.setAttribute('visibility', 'visible');
  }
  const move = !v.active
    ? 'steady tick, no clear season'
    : v.d[i] > 0.5
      ? 'rising'
      : v.d[i] < -0.5
        ? 'falling'
        : 'holding';
  $('now').innerHTML =
    `<b>${v.name}</b> · pass ${i + 1} to ${i + 2} (${dshort(i)} to ${dshort(i + 1)}) · ${move}`;
  SND.step++;
  SND.timer = setTimeout(tick, (SPAN + (SND.step % per === 0 ? GAP : 0)) * 1000);
}
function startSound(fromStart) {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  if (fromStart || !SND.plan) {
    SND.plan = buildPlan();
    SND.step = 0;
  }
  clearTimeout(SND.timer);
  SND.on = true;
  $('play').textContent = '❚❚ Pause';
  $('play').setAttribute('aria-pressed', 'true');
  tick();
}
function stopSound(reset) {
  clearTimeout(SND.timer);
  SND.on = false;
  $('play').textContent = '▶ Play';
  $('play').setAttribute('aria-pressed', 'false');
  if (reset) {
    SND.plan = null;
    SND.step = 0;
    const d = document.getElementById('dot');
    if (d) d.setAttribute('visibility', 'hidden');
  }
}
$('play').onclick = () => {
  if (SND.on) {
    stopSound(false);
    $('now').innerHTML += ' · paused';
  } else startSound(false);
};
$('replay').onclick = () => startSound(true);

// Three examples picked from the data: the best match, the worst match, and the quietest ground.
const EX = {};
{
  let bs = -9,
    bo = -9,
    bq = -9;
  for (let i = 0; i < N; i++) {
    if (RG[i] >= 4.5 && CNT[i] >= MINNB) {
      if (PK[i] >= SUMMER && K[i] > bs) {
        bs = K[i];
        EX.step = i;
      }
      if (-K[i] > bo) {
        bo = -K[i];
        EX.off = i;
      }
    }
    const q = -Math.abs(RG[i] - 0.8);
    if (q > bq) {
      bq = q;
      EX.quiet = i;
    }
  }
}
document.querySelectorAll('[data-ex]').forEach(
  (b) =>
    (b.onclick = () => {
      select(EX[b.dataset.ex]);
      focusSel(15);
    }),
);
