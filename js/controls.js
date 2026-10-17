/* ==========================================================================
   controls.js — the right-hand "Controls" and "Variables" cards

   buildControls()   generates toggles, extra buttons and the variable
                     rows (label + slider + number box with arrows + unit)
   bindControls()    wires every input to callbacks — no experiment logic here
   syncControl()     pushes a value back into the slider + number box
   renderControls()  per-frame: status bar, display options and drag hint
   Generic — everything comes from config.
   ========================================================================== */

import { $, $$, clamp, decimalsOf, setText } from './utils.js';

/* ------------------------------------------------------------------ Build */

function variableMarkup(v) {
  const id = `ctl-${v.name}`;
  const decimals = decimalsOf(v.step);
  return `
    <div class="var-div" data-var="${v.name}">
      <label class="var-label" for="${id}-number">${v.color ? `<i class="var-dot" style="background:${v.color}"></i>` : ''}${v.label}</label>
      <div class="var-controls-row">
        <input type="range" id="${id}" aria-label="${v.label} slider"
               min="${v.min}" max="${v.max}" step="${v.step}" value="${v.value}">
        <div class="input-unit-wrap">
          <div class="custom-stepper">
            <input type="number" class="var-number-input" id="${id}-number"
                   min="${v.min}" max="${v.max}" step="${v.step}" value="${Number(v.value).toFixed(decimals)}">
            <div class="stepper-arrow-box">
              <button type="button" class="step-btn step-up" aria-label="Increase ${v.label}">▲</button>
              <button type="button" class="step-btn step-down" aria-label="Decrease ${v.label}">▼</button>
            </div>
          </div>
          <span class="var-unit">${v.unit ? `(${v.unit})` : ''}</span>
        </div>
      </div>
    </div>`;
}

/** Returns { [variableName]: { def, decimals, slider, number, up, down } } */
export function buildControls(config) {
  $('#resetButton').textContent = config.labels?.reset ?? 'Reset';

  const toggles = config.toggles ?? [];
  $('#toggleGroup').hidden = toggles.length === 0;
  $('#toggleList').innerHTML = toggles
    .map((t) => `<label><input type="checkbox" data-toggle="${t.id}" ${t.checked !== false ? 'checked' : ''}> ${t.label}</label>`)
    .join('');

  $('#actionButtons').insertAdjacentHTML(
    'beforeend',
    (config.extraButtons ?? [])
      .map((b) => `<button class="control-button" type="button" data-extra="${b.id}">${b.label}</button>`)
      .join('')
  );

  $('#variablesList').innerHTML = config.variables.map(variableMarkup).join('');

  const refs = {};
  config.variables.forEach((def) => {
    const row = $(`.var-div[data-var="${def.name}"]`);
    refs[def.name] = {
      def,
      decimals: decimalsOf(def.step),
      slider: $('input[type="range"]', row),
      number: $('input[type="number"]', row),
      up: $('.step-up', row),
      down: $('.step-down', row)
    };
  });
  return refs;
}

/* ------------------------------------------------------------------ Bind */

/**
 * handlers = { onParameter(name, value, commit), onToggle(id, on),
 *              onExtra(id), onReset() }
 * `commit` is true when the user finished editing (blur / Enter / arrow click),
 * so the number box can be rewritten with the clamped value.
 */
export function bindControls(refs, handlers) {
  Object.values(refs).forEach(({ def, decimals, slider, number, up, down }) => {
    slider.addEventListener('input', () => handlers.onParameter(def.name, Number(slider.value), false));

    // Live while typing — but ignore half-typed values like "" or "-"
    number.addEventListener('input', () => {
      if (number.value.trim() === '') return;
      const raw = Number(number.value);
      if (Number.isFinite(raw)) handlers.onParameter(def.name, raw, false);
    });

    const commit = () => {
      const raw = Number(number.value);
      const value = number.value.trim() === '' || !Number.isFinite(raw) ? def.min : raw;
      handlers.onParameter(def.name, value, true);
    };
    number.addEventListener('change', commit);
    number.addEventListener('blur', commit);

    // Arrow buttons: step by def.step, rounded so 0.1 + 0.2 never shows 0.30000000000000004
    const nudge = (direction) => {
      const current = Number(number.value);
      const base = Number.isFinite(current) ? current : def.value;
      const next = Number((base + direction * def.step).toFixed(decimals));
      handlers.onParameter(def.name, clamp(next, def.min, def.max), true);
    };
    up.addEventListener('click', () => nudge(1));
    down.addEventListener('click', () => nudge(-1));
  });


  $('#toggleList').addEventListener('change', (event) => {
    const input = event.target.closest('[data-toggle]');
    if (input) handlers.onToggle(input.dataset.toggle, input.checked);
  });

  $('#actionButtons').addEventListener('click', (event) => {
    const button = event.target.closest('[data-extra]');
    if (button) handlers.onExtra(button.dataset.extra);
  });

  $('#resetButton').addEventListener('click', handlers.onReset);
}

/* ------------------------------------------------------------------ Sync */

/** Write a value into the slider and (unless the user is typing in it) the number box. */
export function syncControl(refs, name, value, { force = false } = {}) {
  const ref = refs[name];
  if (!ref) return;
  ref.slider.value = value;
  if (force || document.activeElement !== ref.number) ref.number.value = Number(value).toFixed(ref.decimals);
}

/** Per-frame refresh of everything in the Controls card + status bar. */
export function renderControls(config, state) {
  setText($('#experimentStatus'), config.statusText(state));
  $('#statusDot').className = `status-dot ${state.values.equilibrium ? 'running' : 'unbalanced'}`;
  $$('[data-toggle]').forEach((input) => { input.checked = state.toggles[input.dataset.toggle]; });
}
