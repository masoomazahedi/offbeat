/* OFFBEAT - The two lower sections and page start-up.
   Places to look first, filter by rule, and the first draw of everything.
   AI acknowledgment: written with the assistance of Claude, an AI model made by Anthropic,
   and reviewed by the project author. See README.md in the repository. */

/* ---------- Places to look first ---------- */
// The reader types how many places they want, largest first. Each card can show its
// place on the map, and the chosen cards can be printed (or saved) as a PDF.
// Which list is shown depends on the rule applied under "Filter by rule".
// With every switch off, the list follows the standard rule.
const RULES = {
  loose: ['Looser rule', 'echo grows 1.8 times (2.5 dB)', 1],
  standard: ['Standard rule', 'echo doubles (3.0 dB)', 0],
  strict: ['Stricter rule', 'echo grows 2.2 times (3.5 dB)', 2],
  strictest: ['Strictest test', 'doubles even without its best and worst pass', D.sensitivity.length - 1],
};
let ruleOn = null; // the rule the list follows now: null (standard) or one key of RULES
let rulePick = null; // the switch that is on; it takes effect when the button is pressed
const placeList = () => D.rule_places[ruleOn || 'standard'];
const ruleName = () => RULES[ruleOn || 'standard'][0].toLowerCase();

const PLACE_DEFAULT = 8;
let placeWanted = PLACE_DEFAULT; // the number the reader asked for
let placeOn = -1; // the card last shown on the map

function renderPlaces() {
  const list = placeList(),
    all = list.length,
    shown = Math.min(placeWanted, all);
  $('place-count').max = all;
  $('place-list').innerHTML = list
    .slice(0, shown)
    .map((p, j) => {
      const why =
        p.k < -0.2
          ? 'Its echo tended to rise when the changing fields around it fell, and fall when they rose.'
          : 'Its echo rose and fell with little relation to the changing fields around it.';
      return `<article class="card place${j === placeOn ? ' on' : ''}"><div class="top"><span class="rk">#${j + 1}</span><span class="ha">${p.ha} <small>hectares</small></span></div>
      <p>${fromCity(LAT[p.i], LON[p.i])}</p>
      <p class="xy num">${LAT[p.i].toFixed(4)}° N, ${LON[p.i].toFixed(4)}° E</p>
      <p class="why">${PK[p.i] >= SUMMER ? 'Summer peak' : 'Early peak'} around ${dlong(PK[p.i])}. ${why} Match ${sgn(p.k)}.</p>
      <button data-p="${j}" type="button">Show on the map</button></article>`;
    })
    .join('');
  document.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => showPlace(+b.dataset.p)));
  $('place-n').textContent =
    `Showing ${shown} of ${all} places of two hectares or more, under the ${ruleName()}` +
    (ruleOn ? `: ${RULES[ruleOn][1]}.` : '. To use another rule, go to "Filter by rule".');
  $('place-print').textContent = shown === 1 ? 'Print this card as a PDF' : `Print these ${shown} cards as a PDF`;
  $('print-sum').textContent =
    (shown === all ? `All ${all} places, largest first` : `The ${shown === 1 ? 'largest' : shown + ' largest'} of ${all} places`) +
    `, under the ${ruleName()}: ${RULES[ruleOn || 'standard'][1]}. ` +
    `Ten NISAR radar passes over the farmland of Herat, Afghanistan, ${dlong(0)} to ${dlong(T - 1)} ${D.dates[0].slice(0, 4)}. ` +
    `Printed ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
}

// Move the ring to the place's own hectare, centre the map on it, and fill the
// panel beside the map with that hectare's measurements.
function showPlace(j) {
  placeOn = j;
  select(placeList()[j].i);
  if (ruleOn && ruleOn !== 'standard') {
    // The map and this panel are drawn under the map's own rule, so say which rule listed the place.
    $('rule-note').textContent =
      `Listed as out of step under the ${ruleName()}: ${RULES[ruleOn][1]}. ` +
      'The label and numbers in this panel follow the rule set on the map, so they can differ.';
    $('rule-note').hidden = false;
  }
  map.setView([LAT[S.sel], LON[S.sel]], 15, { animate: false });
  document.querySelectorAll('.place').forEach((c, k) => c.classList.toggle('on', k === j));
  $('map').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
}

// The number box: whole numbers from 1 to the number of places under the current rule.
{
  const box = $('place-count');
  box.value = placeWanted;
  const apply = (fix) => {
    const n = Math.round(+box.value);
    if (!box.value || !Number.isFinite(n)) {
      if (fix) box.value = Math.min(placeWanted, placeList().length);
      return;
    }
    placeWanted = Math.min(placeList().length, Math.max(1, n));
    if (fix) box.value = placeWanted;
    placeOn = -1;
    renderPlaces();
  };
  box.oninput = () => apply(false);
  box.onchange = () => apply(true);
}

// Printing: css/style.css hides everything except the cards while body has this class.
$('place-print').onclick = () => {
  document.body.classList.add('print-places');
  window.print();
};
window.addEventListener('afterprint', () => document.body.classList.remove('print-places'));

/* ---------- Filter by rule ---------- */
{
  const sv = D.sensitivity;
  const max = Math.max(...sv.map((s) => s.changed));
  $('bars').innerHTML = Object.entries(RULES)
    .map(
      ([key, [t, sub, j]]) => `<div class="bar-r ${key === 'standard' ? 'std' : ''}"><div class="t">${t}<i>${sub}</i></div>
    <div class="b"><i style="width:${(100 * sv[j].changed) / max}%"></i><span>${sv[j].changed} km² changed · ${sv[j].places} places out of step</span></div>
    <button class="rule-sw" type="button" role="switch" aria-checked="false" data-rule="${key}" aria-label="Use the ${t.toLowerCase()} for the places list"><i></i><span>Off</span></button></div>`,
    )
    .join('');
  // One switch at a time. A switch only chooses the rule; the button applies it
  // to the places list. With every switch off, the button returns the list to
  // the standard rule.
  const paintRule = () => {
    document.querySelectorAll('.rule-sw').forEach((b) => {
      const on = b.dataset.rule === rulePick;
      b.setAttribute('aria-checked', String(on));
      b.querySelector('span').textContent = on ? 'On' : 'Off';
    });
    $('rule-msg').textContent =
      rulePick !== ruleOn
        ? rulePick
          ? `${RULES[rulePick][0]} is switched on. Press the button to filter the places.`
          : 'Every switch is off. Press the button to go back to the standard rule.'
        : ruleOn
          ? `${RULES[ruleOn][0]} applied: ${placeList().length} places.`
          : 'Switch one rule on to make the list follow it.';
  };
  document.querySelectorAll('.rule-sw').forEach(
    (b) =>
      (b.onclick = () => {
        rulePick = rulePick === b.dataset.rule ? null : b.dataset.rule;
        paintRule();
      }),
  );
  $('rule-apply').onclick = () => {
    ruleOn = rulePick;
    placeOn = -1;
    $('place-count').value = Math.min(placeWanted, placeList().length);
    paintRule();
    renderPlaces();
    $('places').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  };
  paintRule();
  $('sens').innerHTML =
    '<tr><th>rule</th><th>changed km²</th><th>summer peak</th><th>early peak</th><th>out of step km²</th><th>places</th></tr>' +
    sv
      .map(
        (s) =>
          `<tr><td>${s.rule}</td><td>${s.changed}</td><td>${s.summer}</td><td>${s.early}</td><td>${s.out_of_step}</td><td>${s.places}</td></tr>`,
      )
      .join('');
}

/* ---------- Start ---------- */
renderStats();
drawMap();
renderPlaces();
orbitShow(T - 1);
