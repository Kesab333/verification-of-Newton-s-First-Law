/* ==========================================================================
   app.js — entry point. Builds the UI from config, owns the model + scene,
   and runs the main loop:

        model.update(fixed dt)  ->  render(state)  ->  requestAnimationFrame

   Nothing experiment-specific lives here: edit config.js / physics.js / scene.js.
   ========================================================================== */

import { LAB } from './config.js';
import { ExperimentModel } from './physics.js';
import { $, isVisible } from './utils.js';
import { buildNav, initWorkspace, initFullscreen } from './workspace.js';
import { buildControls, bindControls, syncControl, renderControls } from './controls.js';
import { initDashboard, renderDashboard } from './dashboard.js';
import { initFormulas } from './formula.js';
import { initCalculation } from './calculation.js';
import { initObservation, renderObservation } from './observation.js';
import { initResults, renderResults } from './results.js';
import { initHelp } from './help.js';
import { renderComponentsTable, renderVectorDiagram } from './vectors.js';

/* ---- Integration settings ----
   FIXED_DT          physics runs in fixed steps so results don't depend on frame rate
   PHYSICS_SUB_STEPS raise this (e.g. 8–16) if your equations are stiff / unstable */
const FIXED_DT = 1 / 120;
const PHYSICS_SUB_STEPS = 1;

/* ------------------------------------------------------------------ 1. Static page bits */
document.title = `${LAB.title} | SOLVE Virtual Lab`;
$('#labTitle').textContent = LAB.title;
$('#labLogo').src = LAB.logo;
$('#footerText').textContent = LAB.footer;
if (LAB.diagram) {
  $('#diagramImage').src = LAB.diagram.image;
  $('#diagramImage').alt = LAB.diagram.alt ?? '';
  $('#diagramCaption').textContent = LAB.diagram.caption ?? '';
}

/* ------------------------------------------------------------------ 2. Model + UI */
const model = new ExperimentModel(LAB);

buildNav(LAB.sections);
const controlRefs = buildControls(LAB);
initFormulas(LAB);
initCalculation(LAB);
initObservation(LAB);
initResults(LAB);
initHelp(LAB);

/* ------------------------------------------------------------------ 3. 3D scene (optional)
   Loaded lazily so a Three.js / WebGL failure never takes the rest of the lab down. */
const simViewport = $('#simViewport');
let scene = null;

async function loadScene() {
  try {
    const { LabScene } = await import('./scene.js');
    scene = new LabScene(simViewport, {
      onAngleInput: (index, angle) => setParameter(`a${index + 1}`, angle, true)
    });
    placeScene();
  } catch (error) {
    console.warn('[lab] 3D scene unavailable:', error);
    simViewport.innerHTML =
      '<p class="viewport-fallback">The 3D view could not be loaded (Three.js or WebGL is unavailable). The rest of the experiment still works.</p>';
    $('#dashSimulation').innerHTML = '<img src="images/Force table.png" alt="Force table apparatus" style="width:100%;height:100%;object-fit:contain">';
  }
}
loadScene();

/* ------------------------------------------------------------------ 4. Navigation */
let activeSection = null;
const workspace = initWorkspace(LAB, {
  onChange: (section) => {
    if (activeSection === 'simulation' && section !== 'simulation') scene?.resetView();
    activeSection = section;
    requestAnimationFrame(placeScene);
  }
});
initDashboard(LAB.sections, { onOpen: workspace.show });
initFullscreen();
function placeScene() {
  if (!scene) return;
  const dashboard = document.body.classList.contains('dashboard-active');
  scene.attachTo(dashboard ? $('#dashSimulation') : simViewport, !dashboard);
}
window.addEventListener('resize', () => scene && scene.resize());

/* ------------------------------------------------------------------ 5. Controls -> model */
function setParameter(name, value, commit = false) {
  const applied = model.setParameter(name, value);
  syncControl(controlRefs, name, applied, { force: commit });
}

bindControls(controlRefs, {
  onParameter: setParameter,
  onToggle: (id, enabled) => model.setToggle(id, enabled),
  onExtra: (id) => LAB.extraButtons?.find((b) => b.id === id)?.run(model),
  onReset: () => {
    model.reset();
    Object.entries(model.parameters).forEach(([name, value]) => syncControl(controlRefs, name, value, { force: true }));
    scene?.resetView();
    render();
  }
});

/* ------------------------------------------------------------------ 6. Render */
const panels = {
  simulation: $('#panel-simulation'),
  observation: $('#panel-observation'),
  results: $('#panel-results')
};

const vectorCanvas = $('#vectorCanvas');

function render() {
  const state = model.state;
  renderControls(LAB, state);

  // Only touch panels the user can currently see
  if (isVisible(panels.observation)) renderObservation(LAB, state);
  if (isVisible(panels.results)) {
    renderResults(LAB, state);
    renderComponentsTable(state);
    renderVectorDiagram(vectorCanvas, state);
  }
  const dashboard = document.body.classList.contains('dashboard-active');
  if (dashboard) renderDashboard(state);
  if (scene && (dashboard || isVisible(panels.simulation))) scene.update(state);
}

/* ------------------------------------------------------------------ 7. Main loop */
let lastFrame = performance.now();
let accumulator = 0;

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1); // clamp: a background tab must not "catch up" in one jump
  lastFrame = now;

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    for (let i = 0; i < PHYSICS_SUB_STEPS; i += 1) model.update(FIXED_DT / PHYSICS_SUB_STEPS);
    accumulator -= FIXED_DT;
  }

  render();
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
