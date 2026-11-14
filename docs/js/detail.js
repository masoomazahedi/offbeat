/* OFFBEAT - The selected-hectare panel.
   Classification, verdict, the radar history chart, the evidence rows and the raw numbers.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Selected hectare ---------- */
function select(i) {
  S.sel = i;
  stopSound(true);
  $('empty').hidden = true;
  $('full').hidden = false;
  $('detail').classList.add('open');
  ringO.setLatLng([LAT[i], LON[i]]).addTo(map);
  ringI.setLatLng([LAT[i], LON[i]]).addTo(map);
  renderDetail();
  $('detail').scrollTop = 0;
}
$('closex').onclick = () => {
  $('detail').classList.remove('open');
  stopSound(true);
};
document.querySelectorAll('input[name=ch]').forEach(
  (r) =>
    (r.onchange = () => {
      S.ch = r.value;
      stopSound(true);
      renderDetail();
    }),
);

function renderDetail() {
  const i = S.sel,
    h = cur(HV, i),
    n = cur(NB, i),
    hh = cur(HH, i),
    rg = RG[i],
    k = K[i];
  const active = rg >= S.thr,
    kcls = cls(i),
    sum = PK[i] >= SUMMER,
    pk = dlong(PK[i]);
  const near = !active && rg >= Math.max(2, S.thr - 0.75);
  const [label, cvar, ctext] = CLASS[kcls];
  $('chip').style.color = ctext;
  $('chip').querySelector('i').style.background = `var(${cvar})`;
  $('chip-t').textContent = label;
  $('where').textContent = fromCity(LAT[i], LON[i]);
  $('coord').textContent = `${LAT[i].toFixed(4)}° N, ${LON[i].toFixed(4)}° E · one hectare`;
  const kind = sum ? 'A summer peak' : 'An early peak';
  const shape = sum
    ? `The echo rose to its strongest around ${pk}`
    : `The echo was strongest on ${pk} and then faded`;
  $('verdict').textContent = !active
    ? near
      ? `Just under the line. The echo here grew ${times(rg).toFixed(1)} times, more than bare ground ever did, but less than the ${times(S.thr).toFixed(1)} times this rule asks for.`
      : 'The radar echo from this hectare barely changed all summer.'
    : kcls === 4
      ? `${kind}. ${shape}. Fewer than four changing hectares lie within half a kilometre, so it is not compared with neighbours.`
      : k >= 0.7
        ? `${kind}. ${shape}, together with the changing fields around it.`
        : k >= 0.3
          ? `${kind}. ${shape}. The changing fields around it moved in the same general direction, but not closely.`
          : `${kind}. ${shape}, while the changing fields around it kept a different timetable.`;

  const hhMode = S.ch === 'hh';
  const ser = hhMode
    ? [{ v: hh, color: css('--blue'), w: 2.5, dots: true, name: 'This hectare (HH)' }]
    : [
        { v: h, color: css('--blue'), w: 2.5, dots: true, name: 'This hectare (HV)' },
        { v: n, color: '#5d6470', w: 1.8, dash: true, name: 'Changing neighbours' },
      ];
  drawChart(ser);
  $('key').innerHTML = ser
    .map(
      (s) => `<span><i class="${s.dash ? 'dash' : ''}" style="border-color:${s.color}"></i>${s.name}</span>`,
    )
    .join('');
  $('chart-d').textContent = hhMode
    ? 'HH responds most to upright surfaces and flooded ground. The neighbour average exists for HV only, so it is not drawn here.'
    : 'Radar echo in decibels on each of the ten passes. The dashed line is the average of the changing hectares within half a kilometre.';

  $('ev-m').textContent =
    `HV echo between ${Math.min(...h).toFixed(1)} and ${Math.max(...h).toFixed(1)} dB over ten passes, strongest on ${pk}.`;
  $('ev-c').textContent =
    `The echo grew ${times(rg).toFixed(1)} times from its weakest to its strongest pass (${rg.toFixed(1)} dB). ` +
    (CNT[i] >= MINNB
      ? `Match with ${CNT[i]} changing neighbours: ${sgn(k)} on a scale from −1 to +1.`
      : `Only ${CNT[i]} changing neighbour${CNT[i] === 1 ? '' : 's'} nearby, so no match score is used.`);
  $('ev-h').textContent = !active
    ? near
      ? 'None, on purpose. Something changed here, but not enough to pass the rule, so we do not interpret it.'
      : 'None. We do not interpret ground that shows no change. It may be bare, built on, or planted with trees that look the same all summer.'
    : !sum
      ? 'Fits a spring crop such as wheat harvested in June or July, with no summer crop after it.'
      : kcls === 4
        ? 'Fits a summer crop. With so few changing hectares nearby we do not say whether its timing is unusual.'
        : k < 0.3
          ? 'Fits a summer crop on its own schedule: a different crop, a later planting, or water arriving at a different time.'
          : 'Fits a summer crop watered on the same schedule as the land around it.';

  $('nums').innerHTML =
    '<tr><th>pass</th>' +
    D.dates.map((d, t) => `<th>${dshort(t)}</th>`).join('') +
    '</tr>' +
    '<tr><td>this hectare, HV</td>' +
    h.map((v) => `<td>${v.toFixed(1)}</td>`).join('') +
    '</tr>' +
    '<tr><td>changing neighbours</td>' +
    n.map((v) => `<td>${v.toFixed(1)}</td>`).join('') +
    '</tr>' +
    '<tr><td>this hectare, HH</td>' +
    hh.map((v) => `<td>${v.toFixed(1)}</td>`).join('') +
    '</tr>';
  $('nums-n').textContent =
    `Values in decibels. On bare ground the echo wobbles by about ${D.noise.toFixed(2)} dB from pass to pass.`;
  $('now').textContent = '';
}

/* ---------- Chart ---------- */
let CH = null;
function drawChart(series) {
  const W = 400,
    H = 232,
    Lm = 34,
    R = 10,
    Tp = 18,
    Bm = 42;
  const all = series.flatMap((s) => s.v);
  let lo = Math.min(...all),
    hi = Math.max(...all);
  const pad = Math.max(0.5, (hi - lo) * 0.15);
  lo -= pad;
  hi += pad;
  const X = (t) => Lm + (t * (W - Lm - R)) / (T - 1),
    Y = (v) => Tp + ((hi - v) * (H - Tp - Bm)) / (hi - lo);
  let s = '';
  const step = hi - lo > 6 ? 2 : 1;
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step)
    s += `<line class="ax" x1="${Lm}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}" stroke-dasharray="2 4"/><text class="axt" x="${Lm - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`;
  s += `<line class="ax" x1="${Lm}" y1="${H - Bm}" x2="${W - R}" y2="${H - Bm}"/><text class="axt" x="${Lm - 6}" y="${Tp - 5}" text-anchor="end">dB</text>`;
  for (let t = 0; t < T; t++)
    s += `<text class="axt" x="${X(t)}" y="${H - Bm + 14}" text-anchor="middle">${+D.dates[t].slice(8)}</text><text class="axt" x="${X(t)}" y="${H - Bm + 26}" text-anchor="middle">${MON[+D.dates[t].slice(5, 7)]}</text>`;
  s += `<line id="cursor" class="ax" y1="${Tp}" y2="${H - Bm}" stroke="${css('--navy')}" visibility="hidden"/>`;
  series.forEach((se) => {
    s += `<polyline fill="none" stroke="${se.color}" stroke-width="${se.w}" stroke-linejoin="round" ${se.dash ? 'stroke-dasharray="6 4"' : ''} points="${se.v.map((v, t) => X(t) + ',' + Y(v)).join(' ')}"/>`;
    if (se.dots)
      se.v.forEach((v, t) => {
        s += `<circle cx="${X(t)}" cy="${Y(v)}" r="3.2" fill="${se.color}"/>`;
      });
  });
  s += `<circle id="dot" r="7" fill="none" stroke-width="3" visibility="hidden"/>`;
  $('chart').innerHTML = s;
  CH = { X, Y, series, W, Lm, R };
}
function chartHover(e) {
  if (!CH) return;
  const box = $('chart').getBoundingClientRect();
  const x = ((e.clientX - box.left) / box.width) * CH.W;
  const t = Math.max(0, Math.min(T - 1, Math.round((x - CH.Lm) / ((CH.W - CH.Lm - CH.R) / (T - 1)))));
  const cu = document.getElementById('cursor');
  cu.setAttribute('x1', CH.X(t));
  cu.setAttribute('x2', CH.X(t));
  cu.setAttribute('visibility', 'visible');
  const tip = $('tip');
  tip.hidden = false;
  tip.innerHTML =
    `<b>Pass ${t + 1} · ${dlong(t)}</b><br>` +
    CH.series.map((s) => `${s.name}: <span>${s.v[t].toFixed(1)} dB</span>`).join('<br>');
  const px = (CH.X(t) / CH.W) * box.width,
    top = (Math.min(...CH.series.map((s) => CH.Y(s.v[t]))) / 232) * box.height;
  tip.style.left = Math.max(80, Math.min(box.width - 80, px)) + 'px';
  tip.style.top = top - 10 + 'px';
}
$('chart').addEventListener('pointermove', chartHover);
$('chart').addEventListener('pointerdown', chartHover);
$('chart').addEventListener('pointerleave', () => {
  $('tip').hidden = true;
  const c = document.getElementById('cursor');
  if (c) c.setAttribute('visibility', 'hidden');
});
