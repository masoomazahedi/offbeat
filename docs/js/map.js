/* OFFBEAT - The map and the headline numbers.
   Leaflet map, the three views, backgrounds, legend, threshold slider and the go-to box.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Map ---------- */
const map = L.map('lmap', { zoomSnap: 0.5, zoomAnimation: !REDUCED, fadeAnimation: !REDUCED });
const esri = (svc, attr) =>
  L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 19,
    attribution: attr,
  });
const BASE = {
  sat: esri('World_Imagery', 'Imagery &copy; Esri, Maxar, Earthstar Geographics'),
  street: esri('World_Street_Map', 'Street map &copy; Esri, HERE, Garmin, OpenStreetMap contributors'),
  topo: esri('World_Topo_Map', 'Topographic map &copy; Esri'),
};
const names = esri('Reference/World_Boundaries_and_Places', 'Labels &copy; Esri');
BASE.sat.addTo(map);
names.addTo(map);
L.control.scale({ imperial: false }).addTo(map);
const VALLEY = [
  [la0, lo0],
  [la1, lo1],
];
map.fitBounds(VALLEY);
document.querySelectorAll('input[name=base]').forEach(
  (r) =>
    (r.onchange = () => {
      Object.values(BASE).forEach((l) => map.removeLayer(l));
      BASE[r.value].addTo(map);
      BASE[r.value].bringToBack();
    }),
);
$('names').onchange = (e) => (e.target.checked ? names.addTo(map) : map.removeLayer(names));

const legend = L.control({ position: 'bottomleft' });
legend.onAdd = () => {
  const d = L.DomUtil.create('div', 'legend');
  d.id = 'legend';
  L.DomEvent.disableClickPropagation(d);
  return d;
};
legend.addTo(map);

const cellCanvas = L.DomUtil.create('canvas', 'leaflet-zoom-hide');
cellCanvas.style.pointerEvents = 'none';
map.getPanes().overlayPane.appendChild(cellCanvas);
const ringO = L.circleMarker(CITY, {
  radius: 12,
  color: '#0f2238',
  weight: 6,
  fill: false,
  interactive: false,
});
const ringI = L.circleMarker(CITY, {
  radius: 12,
  color: '#fff',
  weight: 2.5,
  fill: false,
  interactive: false,
});
const blockGroup = L.layerGroup().addTo(map);

function paintCells() {
  const size = map.getSize();
  L.DomUtil.setPosition(cellCanvas, map.containerPointToLayerPoint([0, 0]));
  cellCanvas.width = size.x;
  cellCanvas.height = size.y;
  if (S.layer === 'blocks') return;
  const g = cellCanvas.getContext('2d');
  const mpp = (156543.03392 * Math.cos((34.33 * Math.PI) / 180)) / Math.pow(2, map.getZoom()),
    s = Math.max(1.5, 100 / mpp);
  const cols = { 0: css('--quiet'), 1: css('--step'), 2: css('--off'), 4: css('--iso') };
  const b = map.getBounds().pad(0.03),
    so = b.getSouth(),
    no = b.getNorth(),
    we = b.getWest(),
    ea = b.getEast();
  for (let i = 0; i < N; i++) {
    if (LAT[i] < so || LAT[i] > no || LON[i] < we || LON[i] > ea) continue;
    let quiet, col;
    if (S.layer === 'step') {
      const k = cls(i);
      quiet = k === 0;
      col = cols[k];
    } else {
      quiet = RG[i] < S.thr;
      col = quiet ? cols[0] : RAMP[PK[i]];
    }
    const p = map.latLngToContainerPoint([LAT[i], LON[i]]);
    g.globalAlpha = quiet ? S.alpha * 0.3 : S.alpha;
    g.fillStyle = col;
    g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
}
function paintBlocks() {
  blockGroup.clearLayers();
  if (S.layer !== 'blocks') return;
  for (let r0 = 0; r0 < ROWS; r0 += B)
    for (let c0 = 0; c0 < COLS; c0 += B) {
      const r1 = Math.min(ROWS, r0 + B),
        c1 = Math.min(COLS, c0 + B);
      let aoi = 0,
        act = 0;
      for (let r = r0; r < r1; r++)
        for (let c = c0; c < c1; c++) {
          const i = idxAt[r * COLS + c];
          if (i < 0) continue;
          aoi++;
          if (RG[i] >= S.thr && PK[i] >= SUMMER) act++;
        }
      if (aoi < 300) continue;
      const pct = (100 * act) / aoi;
      L.polygon([latlon(r0, c0), latlon(r0, c1), latlon(r1, c1), latlon(r1, c0)], {
        color: '#fff',
        weight: 1,
        fillColor: css('--blue'),
        fillOpacity: 0.12 + 0.6 * Math.min(1, pct / 35),
        interactive: false,
      })
        .bindTooltip(pct.toFixed(0) + '%', { permanent: true, direction: 'center', className: 'pct' })
        .addTo(blockGroup);
    }
}
function paintLegend() {
  const row = (k) =>
    `<div><span class="sw" style="background:var(${CLASS[k][1]})"></span>${CLASS[k][0]}</div>`;
  $('legend').innerHTML =
    S.layer === 'step'
      ? `<b>Compared with neighbours</b>${row(1)}${row(2)}${row(4)}${row(0)}`
      : S.layer === 'season'
        ? `<b>Pass with the strongest echo</b><div class="ramp" style="display:flex">${RAMP.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
       <div class="rampl"><span>${dshort(0)}</span><span>${dshort(SUMMER)} ▸ summer</span><span>${dshort(T - 1)}</span></div>${row(0)}`
        : `<b>5 km blocks</b>Share of the farmland in each block that reached a summer peak.`;
}
function drawMap() {
  paintCells();
  paintBlocks();
  paintLegend();
}
map.on('moveend zoomend resize', paintCells);
map.on('click', (e) => {
  const [i, d] = nearest(e.latlng.lat, e.latlng.lng);
  if (i >= 0 && d < 400) select(i);
});
const focusSel = (z) =>
  map.setView([LAT[S.sel], LON[S.sel]], Math.max(map.getZoom(), z || 15), { animate: !REDUCED });
document.querySelectorAll('input[name=layer]').forEach(
  (r) =>
    (r.onchange = () => {
      S.layer = r.value;
      drawMap();
    }),
);
$('alpha').oninput = (e) => {
  S.alpha = +e.target.value;
  paintCells();
};
$('thr').oninput = (e) => {
  S.thr = +e.target.value;
  renderStats();
  drawMap();
  if (S.sel != null) renderDetail();
};
$('thr-reset').onclick = () => {
  $('thr').value = STD;
  $('thr').oninput({ target: $('thr') });
};
$('goto-city').onclick = () => map.setView(CITY, 13, { animate: !REDUCED });
$('goto-all').onclick = () => map.fitBounds(VALLEY, { animate: !REDUCED });
function goTo() {
  const m = $('goto').value.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/);
  if (!m) {
    $('goto-msg').textContent = 'Write two numbers, latitude first: 34.33, 62.05';
    return;
  }
  const [i, d] = nearest(+m[1], +m[2]);
  if (d > 1500) {
    $('goto-msg').textContent =
      `That point is ${(d / 1000).toFixed(1)} km outside the farmland studied (${la0.toFixed(2)}–${la1.toFixed(2)}° N, ${lo0.toFixed(2)}–${lo1.toFixed(2)}° E).`;
    return;
  }
  $('goto-msg').textContent = 'Showing the nearest hectare.';
  select(i);
  focusSel(15);
}
$('goto-b').onclick = goTo;
$('goto').onkeydown = (e) => {
  if (e.key === 'Enter') goTo();
};

/* ---------- Headline numbers ---------- */
function renderStats() {
  let changed = 0,
    season = 0,
    diff = 0;
  for (let j = 0; j < N; j++)
    if (RG[j] >= S.thr) {
      changed++;
      if (PK[j] >= SUMMER) season++;
      if (CNT[j] >= MINNB && K[j] < 0.3) diff++;
    }
  $('st-area').textContent = (N / 100).toFixed(0) + ' km²';
  $('st-changed').textContent = (changed / 100).toFixed(0) + ' km²';
  $('st-summer').textContent = (season / 100).toFixed(0) + ' km²';
  $('st-early').textContent = ((changed - season) / 100).toFixed(0) + ' km²';
  $('st-diff').textContent = (diff / 100).toFixed(1) + ' km²';
  $('st-diff-s').textContent =
    'moved differently from neighbours' + (S.thr === STD ? `, in ${D.places.length} places` : '');
  $('thr-v').textContent = `${times(S.thr).toFixed(1)} times (${S.thr.toFixed(1)} dB)`;
  $('thr-reset').disabled = S.thr === STD;
  // Nothing is said while the standard rule is in force; the warning appears only
  // once the reader moves the slider, because the numbers then differ from the standard.
  $('statnote').innerHTML =
    S.thr === STD
      ? ''
      : `<b>You changed the rule.</b> These numbers are for a threshold of ${S.thr.toFixed(1)} dB, not the standard ${STD.toFixed(1)} dB.`;
}
