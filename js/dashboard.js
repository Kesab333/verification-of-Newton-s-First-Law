/* ==========================================================================
   dashboard.js — first-screen card grid (one card per config.sections entry)
   Each card previews its section. The simulation shares the main 3D scene;
   readings, calculations and results reflect the current force-table settings.
   ========================================================================== */

import { $, $$, setText, mathToHtml } from './utils.js';

const previews = {
  diagram: '<div class="dash-diagram-bg"><img src="images/Force table.png" alt="Labelled force table" draggable="false"></div>',
  formula: '<div class="dash-formula-bg"><div>Equilibrium of a particle</div><strong id="dashFormula"></strong><span>Fᵢ = mᵢg &nbsp; · &nbsp; ΣFₓ = ΣFᵧ = 0</span></div>',
  simulation: '<div id="dashSimulation" class="dash-simulation" aria-hidden="true"></div>',
  observation: '<div class="dash-obs-bg"><span class="dash-preview-tag">Current forces</span><table class="dash-obs-table"><thead><tr><th>Force</th><th>Mass (kg)</th><th>Angle</th></tr></thead><tbody id="dashObsBody"></tbody></table></div>',
  calculation: '<div class="dash-calc-bg"><div class="dash-calc-step"><b>1. Force from mass</b><span id="dashCalcForce"></span></div><div class="dash-calc-step"><b>2. Add the components</b><span>R = √(ΣFₓ² + ΣFᵧ²)</span><strong id="dashCalcR"></strong></div></div>',
  results: '<div class="dash-results-bg"><div class="dash-result-pill"><span>ΣFₓ</span><strong id="dashResultX"></strong></div><div class="dash-result-pill"><span>ΣFᵧ</span><strong id="dashResultY"></strong></div><div class="dash-result-pill"><span>Resultant R</span><strong id="dashResultR"></strong></div><div class="dash-result-pill"><span>Condition</span><strong id="dashCondition"></strong></div></div>'
};
let lastPreviewKey = '';

export function initDashboard(sections, { onOpen } = {}) {
  const view = $('#dashboardView');

  view.innerHTML = `
    <div class="dashboard-cards-grid">
      ${sections
        .map(
          (s, i) => `
        <div class="dash-preview-card" data-section="${s.id}" tabindex="0" role="button"
             aria-label="Open ${s.title}" style="--card-accent:${s.accent ?? 'var(--clr-primary)'}; --i:${i}">
          <div class="dash-preview-area">
            <div class="dash-preview-content">
              ${previews[s.id]}
            </div>
            <div class="dash-preview-badge" title="${s.title}">
              <img src="${s.icon}" alt="" class="dash-icon-img" draggable="false">
            </div>
          </div>
          <div class="dash-card-label"><span>${s.title}</span></div>
        </div>`
        )
        .join('')}
    </div>`;

  const formula = () => { $('#dashFormula').innerHTML = mathToHtml('$\\sum \\vec{F} = \\vec{0}$'); };
  formula();
  window.addEventListener('load', formula, { once: true });

  $$('.dash-preview-card', view).forEach((card) => {
    const open = () => onOpen && onOpen(card.dataset.section);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

export function renderDashboard(state) {
  const key = JSON.stringify(state.parameters);
  if (key === lastPreviewKey) return;
  lastPreviewKey = key;
  const { values: v } = state;
  $('#dashObsBody').innerHTML = v.forces.map((f, i) => `<tr><td>F${'₁₂₃₄'[i]}</td><td>${f.mass.toFixed(2)}</td><td>${f.angle.toFixed(0)}°</td></tr>`).join('');
  setText($('#dashCalcForce'), `F₁ = ${state.parameters.m1.toFixed(2)} × 9.8 = ${v.F1.toFixed(2)} N`);
  setText($('#dashCalcR'), `R = ${v.R.toFixed(2)} N`);
  setText($('#dashResultX'), `${v.sx.toFixed(2)} N`);
  setText($('#dashResultY'), `${v.sy.toFixed(2)} N`);
  setText($('#dashResultR'), `${v.R.toFixed(2)} N`);
  setText($('#dashCondition'), v.equilibrium ? 'Equilibrium' : 'Unbalanced');
}
