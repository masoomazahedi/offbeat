/* OFFBEAT - The two lower sections and page start-up.
   Places to look first, how far the evidence goes, and the first draw of everything.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Places to look first ---------- */
let placeShown = 8;
function renderPlaces() {
  $('place-list').innerHTML = D.places
    .slice(0, placeShown)
    .map((p, j) => {
      const why =
        p.k < -0.2
          ? 'Its echo tended to rise when the changing fields around it fell, and fall when they rose.'
          : 'Its echo rose and fell with little relation to the changing fields around it.';
      return `<article class="card place"><div class="top"><span class="rk">#${j + 1}</span><span class="ha">${p.ha} <small>hectares</small></span></div>
      <p>${fromCity(p.lat, p.lon)}</p>
      <p class="why">${PK[p.i] >= SUMMER ? 'Summer peak' : 'Early peak'} around ${dlong(PK[p.i])}. ${why} Match ${sgn(p.k)}.</p>
      <button data-p="${j}">Show on the map</button></article>`;
    })
    .join('');
  document.querySelectorAll('[data-p]').forEach(
    (b) =>
      (b.onclick = () => {
        select(D.places[+b.dataset.p].i);
        focusSel(15);
        $('map').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      }),
  );
  const left = D.places.length - placeShown;
  $('place-more').hidden = left <= 0;
  $('place-more').textContent = `Show ${Math.min(8, left)} more`;
  $('place-n').textContent =
    `Showing ${Math.min(placeShown, D.places.length)} of ${D.places.length} places of two hectares or more, under the standard rule.`;
}
$('place-more').onclick = () => {
  placeShown += 8;
  renderPlaces();
};

/* ---------- Evidence ---------- */
{
  const sv = D.sensitivity,
    pick = [
      [1, 'Looser rule', 'echo grows 1.8 times (2.5 dB)'],
      [0, 'Standard rule', 'echo doubles (3.0 dB)'],
      [2, 'Stricter rule', 'echo grows 2.2 times (3.5 dB)'],
      [sv.length - 1, 'Strictest test', 'doubles even without its best and worst pass'],
    ];
  const max = Math.max(...sv.map((s) => s.changed));
  $('bars').innerHTML = pick
    .map(
      ([j, t, sub]) => `<div class="bar-r ${j === 0 ? 'std' : ''}"><div class="t">${t}<i>${sub}</i></div>
    <div class="b"><i style="width:${(100 * sv[j].changed) / max}%"></i><span>${sv[j].changed} km² changed · ${sv[j].places} places out of step</span></div></div>`,
    )
    .join('');
  $('sens').innerHTML =
    '<tr><th>rule</th><th>changed km²</th><th>summer peak</th><th>early peak</th><th>out of step km²</th><th>places</th></tr>' +
    sv
      .map(
        (s) =>
          `<tr><td>${s.rule}</td><td>${s.changed}</td><td>${s.summer}</td><td>${s.early}</td><td>${s.out_of_step}</td><td>${s.places}</td></tr>`,
      )
      .join('');
  const f = D.false_alarm;
  $('fa').textContent =
    `A check on the rule itself: on ${f.bare_cells} hectares of bare ground outside the farmland, ${f.passed} pass the standard rule. The largest swing there is ${f.largest_swing_db} dB, against the 3 dB required.`;
  // two small grids: one field differs (flagged) versus all fields fail together (nothing flagged)
  const grid = (x0, mode) => {
    let s = '';
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const odd = mode === 'one' && r === 1 && c === 2;
        s += `<rect x="${x0 + c * 22}" y="${18 + r * 22}" width="20" height="20" rx="2" fill="${odd ? css('--off') : mode === 'one' ? css('--step') : css('--quiet')}"/>`;
      }
    return s;
  };
  $('fail-svg').innerHTML =
    `<svg viewBox="0 0 300 122" role="img" aria-label="Left: one field differs from its neighbours and is marked. Right: every field fails together and nothing is marked.">
    <text x="0" y="11" class="axt">one differs: marked</text><text x="140" y="11" class="axt">all fail: nothing marked</text>${grid(0, 'one')}${grid(140, 'all')}</svg>`;
}

/* ---------- Start ---------- */
renderStats();
drawMap();
renderPlaces();
orbitShow(T - 1);
