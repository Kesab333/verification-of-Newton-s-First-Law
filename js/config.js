/* ==========================================================================
   config.js — EVERYTHING that is specific to Experiment 6 lives here:
   VERIFICATION OF NEWTON'S FIRST LAW — EQUILIBRIUM OF A PARTICLE

   The generic app (layout, navigation, dashboard, controls and help)
   reads this object. Physics lives in js/physics.js, the 3D force table in
   js/scene.js.
   ========================================================================== */


// Small formatting helpers used by the getters below
const fixed = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');
const signed = (n, d = 3) => `${n >= 0 ? '+' : ''}${fixed(n, d)}`;
const clean = (n) => (Math.abs(n) < 1e-9 ? 0 : n);
const G = 9.8;
const rad = (deg) => (deg * Math.PI) / 180;
const EQ_TOLERANCE = 0.005; // N — same threshold as physics.js

// Colours of the four strings / hangers (also used by the scene and the vector diagram)
export const FORCE_COLORS = ['#e53935', '#1e88e5', '#43a047', '#f9a825'];

export const LAB = {
  /* ---------------------------------------------------------------- Branding */
  title: "Verification of Newton's First Law ",
  logo: 'images/nitk.webp',
  footer: 'Copyright © SOLVE The Virtual Lab @ NITK Surathkal',

  /* ---------------------------------------------------------------- Sections */
  sections: [
    { id: 'diagram',     title: 'Diagram',     heading: 'Apparatus Diagram',   icon: 'images/diagram.svg',  accent: '#3b82f6', interactive: false },
    { id: 'formula',     title: 'Formula',     icon: 'images/formula.svg',     accent: '#8b5cf6', interactive: false },
    { id: 'simulation',  title: 'Simulation',  icon: 'images/simulation.svg',  accent: '#0d9488', interactive: true  },
    { id: 'observation', title: 'Observation', icon: 'images/observation.svg', accent: '#f59e0b', interactive: false },
    { id: 'calculation', title: 'Calculation', icon: 'images/calculation.svg', accent: '#6366f1', interactive: false },
    { id: 'results',     title: 'Results',     icon: 'images/results.svg',     accent: '#f43f5e', interactive: false },
  ],

  /* ---------------------------------------------------------------- Diagram */
  diagram: {
    image: 'images/Force table.png',
    alt: 'Labelled force table showing the graduated surface, central pin and ring, strings, pulleys and weight hangers',
    caption: 'Fig. 1: Force table. Strings connect the central ring to hanging weights over rim-mounted pulleys. Move a pulley to set the force direction; change its hanging mass to set the force magnitude (F = mg). The central pin marks the reference centre.'
  },

  /* ---------------------------------------------------------------- Button labels */
  labels: { reset: 'Reset' },

  /* Keep the Controls and Variables cards open together (Record Reading must stay reachable while sliding) */
  accordion: false,


  /* ---------------------------------------------------------------- Extra action buttons */
  extraButtons: [
    { id: 'record', label: 'Record Reading', run: (model) => model.recordReading() }
  ],

  /* ---------------------------------------------------------------- Display toggles ("Show" checkboxes) */
  toggles: [
    { id: 'vectors',   label: 'Show force vectors', checked: true },
    { id: 'resultant', label: 'Show resultant R',   checked: true },
    { id: 'labels',    label: 'Show force labels',  checked: true }
  ],

  /* ---------------------------------------------------------------- Variables (sliders)
     Mass i (kg) in [0, 1] and Angle i (degrees) in [0, 360], i = 1…4 — as in the experiment document. */
  variables: [
    { name: 'm1', label: 'Mass 1',  min: 0, max: 1,   step: 0.01, value: 0.1, unit: 'kg', color: FORCE_COLORS[0] },
    { name: 'a1', label: 'Angle 1', min: 0, max: 360, step: 1,    value: 90,  unit: '°',  color: FORCE_COLORS[0] },
    { name: 'm2', label: 'Mass 2',  min: 0, max: 1,   step: 0.01, value: 0.1, unit: 'kg', color: FORCE_COLORS[1] },
    { name: 'a2', label: 'Angle 2', min: 0, max: 360, step: 1,    value: 0,   unit: '°',  color: FORCE_COLORS[1] },
    { name: 'm3', label: 'Mass 3',  min: 0, max: 1,   step: 0.01, value: 0.1, unit: 'kg', color: FORCE_COLORS[2] },
    { name: 'a3', label: 'Angle 3', min: 0, max: 360, step: 1,    value: 180, unit: '°',  color: FORCE_COLORS[2] },
    { name: 'm4', label: 'Mass 4',  min: 0, max: 1,   step: 0.01, value: 0.1, unit: 'kg', color: FORCE_COLORS[3] },
    { name: 'a4', label: 'Angle 4', min: 0, max: 360, step: 1,    value: 270, unit: '°',  color: FORCE_COLORS[3] }
  ],

  /* ---------------------------------------------------------------- Status bar text */
  statusText: (s) => {
    const base = s.values.equilibrium
      ? 'Achieved Equilibrium – The ring is centered'
      : 'Not in Equilibrium – Adjust the values';
    return base;
  },

  /* ---------------------------------------------------------------- Results panel */
  results: [
    { label: 'Force F<sub>1</sub> = m<sub>1</sub>g', unit: 'N', decimals: 2, get: (s) => s.values.F1 },
    { label: 'Force F<sub>2</sub> = m<sub>2</sub>g', unit: 'N', decimals: 2, get: (s) => s.values.F2 },
    { label: 'Force F<sub>3</sub> = m<sub>3</sub>g', unit: 'N', decimals: 2, get: (s) => s.values.F3 },
    { label: 'Force F<sub>4</sub> = m<sub>4</sub>g', unit: 'N', decimals: 2, get: (s) => s.values.F4 },
    { label: 'ΣF<sub>x</sub>', unit: 'N', decimals: 2, signed: true, get: (s) => s.values.sx },
    { label: 'ΣF<sub>y</sub>', unit: 'N', decimals: 2, signed: true, get: (s) => s.values.sy },
    { label: 'Resultant force R', unit: 'N', decimals: 2, get: (s) => s.values.R },
    { label: 'Resultant angle θ', unit: '°', decimals: 1, get: (s) => (Number.isFinite(s.values.theta) ? s.values.theta : 'undefined (R = 0)') },
    { label: 'Ring displacement', unit: 'cm', decimals: 1, get: (s) => s.values.displacement },
    { label: 'Condition', get: (s) => (s.values.equilibrium ? 'Equilibrium' : 'Not in equilibrium') }
  ],

  /* Horizontal bar under the readouts: how large R is compared with the total applied force */
  resultsBar: {
    label: 'Resultant R compared with the total applied force ΣF<sub>i</sub>',
    unit: 'N',
    decimals: 2,
    get: (s) => s.values.R,
    full: (s) => s.values.sumMagnitudes || 1
  },

  /* ---------------------------------------------------------------- Observation panel */
  observationText: (s) => {
    const v = s.values;
    if (v.equilibrium) {
      return `Achieved Equilibrium – The ring is centered. ΣFx = ${fixed(v.sx, 2)} N and ΣFy = ${fixed(v.sy, 2)} N, so the vector sum of the forces is zero (ΣF = 0) and Newton’s First Law is verified.`;
    }
    return `Not in Equilibrium – Adjust the values. The resultant is R = ${fixed(v.R, 2)} N at θ = ${fixed(v.theta, 1)}° (ΣFx = ${fixed(v.sx, 2)} N, ΣFy = ${fixed(v.sy, 2)} N). The ring moves in the direction of this resultant force.`;
  },

  readingsTable: {
    title: 'Recorded readings (press “Record Reading” in the Simulation section)',
    emptyText: 'No readings yet. Open the Simulation, set the masses and angles, then press “Record Reading”.',
    highlightKey: 'R',
    columns: [
      { key: 'masses', label: 'Masses m<sub>1</sub>…m<sub>4</sub> (kg)' },
      { key: 'angles', label: 'Angles θ<sub>1</sub>…θ<sub>4</sub> (°)' },
      { key: 'sx',  label: 'ΣF<sub>x</sub> (N)', format: (v) => signed(v, 2) },
      { key: 'sy',  label: 'ΣF<sub>y</sub> (N)', format: (v) => signed(v, 2) },
      { key: 'R',   label: 'R (N)',              format: (v) => fixed(v, 2) },
      { key: 'equilibrium', label: 'Result', format: (v) => (v ? '<span class="eq-yes">Equilibrium</span>' : '<span class="eq-no">Not in equilibrium</span>') }
    ]
  },

  /* ---------------------------------------------------------------- Formulas */
  formulas: [
    {
      id: 'force',
      name: 'Force due to a hanging mass',
      usage: 'Each hanging mass pulls on the ring through its string with a force equal to its weight.',
      latex: 'F_i = m_i\\, g',
      variables: [
        { symbol: 'F_i', desc: 'Force due to gravity on each hanging mass (N)' },
        { symbol: 'm_i', desc: 'Mass i (kg)' },
        { symbol: 'g', desc: 'Acceleration due to gravity (9.8 m/s²)' },
        { symbol: 'i', desc: '1, 2, 3, 4' }
      ]
    },
    {
      id: 'components',
      name: 'Components of a force',
      usage: 'Resolves each force into its horizontal ($x$) and vertical ($y$) components so the forces can be added.',
      latex: 'F_{ix} = F_i\\cos\\theta_i \\qquad F_{iy} = F_i\\sin\\theta_i',
      variables: [
        { symbol: 'F_{ix}', desc: 'x-component (N)' },
        { symbol: 'F_{iy}', desc: 'y-component (N)' },
        { symbol: 'F_i', desc: 'Force due to gravity on each hanging mass (N)' },
        { symbol: '\\theta_i', desc: 'Angle i (degrees)' }
      ]
    },
    {
      id: 'equilibrium',
      name: 'Condition for equilibrium',
      usage: 'The ring stays at the centre only when the horizontal and vertical components each add up to zero.',
      latex: '\\sum F_x = \\sum F_{ix} = 0 \\qquad \\sum F_y = \\sum F_{iy} = 0',
      variables: [
        { symbol: '\\sum F_{ix}', desc: 'Sum of all x-components (N)' },
        { symbol: '\\sum F_{iy}', desc: 'Sum of all y-components (N)' }
      ]
    },
    {
      id: 'resultant',
      name: 'Resultant force',
      usage: 'Magnitude of the net force on the ring when the forces are not balanced.',
      latex: 'R = \\sqrt{\\left(\\sum F_{ix}\\right)^2 + \\left(\\sum F_{iy}\\right)^2}',
      variables: [
        { symbol: 'R', desc: 'Resultant force (N)' },
        { symbol: '\\sum F_{ix}', desc: 'Sum of all x-components (N)' },
        { symbol: '\\sum F_{iy}', desc: 'Sum of all y-components (N)' }
      ]
    },
    {
      id: 'angle',
      name: 'Direction of the resultant',
      usage: 'Angle between $\\sum F_{ix}$ and $R$; the ring moves in this direction when it is out of equilibrium.',
      latex: '\\theta = \\tan^{-1}\\!\\left(\\frac{\\sum F_{iy}}{\\sum F_{ix}}\\right)',
      variables: [
        { symbol: '\\theta', desc: 'Angle between $\\sum F_{ix}$ and $R$ (degrees)' },
        { symbol: '\\sum F_{ix}', desc: 'Sum of all x-components (N)' },
        { symbol: '\\sum F_{iy}', desc: 'Sum of all y-components (N)' }
      ]
    }
  ],

  /* ---------------------------------------------------------------- Calculation panel */
  calculation: {
    inputs: [
      { id: 'm1', label: 'Mass m₁ (kg)',  value: 0.1, step: 0.01, min: 0, max: 1 },
      { id: 'a1', label: 'Angle θ₁ (°)',  value: 90,  step: 1,    min: 0, max: 360 },
      { id: 'm2', label: 'Mass m₂ (kg)',  value: 0.1, step: 0.01, min: 0, max: 1 },
      { id: 'a2', label: 'Angle θ₂ (°)',  value: 0,   step: 1,    min: 0, max: 360 },
      { id: 'm3', label: 'Mass m₃ (kg)',  value: 0.1, step: 0.01, min: 0, max: 1 },
      { id: 'a3', label: 'Angle θ₃ (°)',  value: 180, step: 1,    min: 0, max: 360 },
      { id: 'm4', label: 'Mass m₄ (kg)',  value: 0.1, step: 0.01, min: 0, max: 1 },
      { id: 'a4', label: 'Angle θ₄ (°)',  value: 270, step: 1,    min: 0, max: 360 }
    ],
    steps: [1, 2, 3, 4].map((i) => ({
      key: `F${i}`,
      title: `Step ${i}: Force F<sub>${i}</sub>`,
      latex: `F_${i} = m_${i}\\, g`,
      substitute: (v) => `${v[`m${i}`]} \\times ${G}`,
      compute: (v) => v[`m${i}`] * G,
      unit: 'N',
      digits: 3
    })).concat([
      {
        key: 'sx', title: 'Step 5: Sum of x-components (ΣF<sub>x</sub>)',
        latex: '\\sum F_x = \\sum F_i\\cos\\theta_i',
        substitute: (v, r) => [1, 2, 3, 4].map((i) => `${r[`F${i}`].toFixed(3)}\\cos ${v[`a${i}`]}^\\circ`).join(' + '),
        compute: (v, r) => clean([1, 2, 3, 4].reduce((t, i) => t + r[`F${i}`] * Math.cos(rad(v[`a${i}`])), 0)),
        unit: 'N', digits: 3
      },
      {
        key: 'sy', title: 'Step 6: Sum of y-components (ΣF<sub>y</sub>)',
        latex: '\\sum F_y = \\sum F_i\\sin\\theta_i',
        substitute: (v, r) => [1, 2, 3, 4].map((i) => `${r[`F${i}`].toFixed(3)}\\sin ${v[`a${i}`]}^\\circ`).join(' + '),
        compute: (v, r) => clean([1, 2, 3, 4].reduce((t, i) => t + r[`F${i}`] * Math.sin(rad(v[`a${i}`])), 0)),
        unit: 'N', digits: 3
      },
      {
        key: 'R', title: 'Step 7: Resultant force (R)',
        latex: 'R = \\sqrt{\\left(\\sum F_x\\right)^2 + \\left(\\sum F_y\\right)^2}',
        substitute: (v, r) => `\\sqrt{(${r.sx.toFixed(3)})^2 + (${r.sy.toFixed(3)})^2}`,
        compute: (v, r) => Math.hypot(r.sx, r.sy),
        unit: 'N', digits: 3
      },
      {
        key: 'theta', title: 'Step 8: Direction of the resultant (θ)',
        latex: '\\theta = \\tan^{-1}\\!\\left(\\frac{\\sum F_y}{\\sum F_x}\\right)',
        substitute: (v, r) => `\\tan^{-1}\\!\\left(\\frac{${r.sy.toFixed(3)}}{${r.sx.toFixed(3)}}\\right)`,
        // atan2 puts the angle in the correct quadrant; undefined when R = 0 (equilibrium)
        compute: (v, r) => (r.R < EQ_TOLERANCE ? NaN : ((Math.atan2(r.sy, r.sx) * 180) / Math.PI + 360) % 360),
        unit: '°', digits: 1
      }
    ])
  },

  /* ---------------------------------------------------------------- Side info cards (non-interactive sections) */
  sideInfo: {
    diagram: {
      title: 'Components',
      items: [
        { label: 'Force table', text: 'circular scale graduated 0°–360°' },
        { label: 'Central ring', text: 'represents the particle where the string tensions meet' },
        { label: 'Central pin', text: 'marks the centre; a balanced ring is centred without pressing against it' },
        { label: 'Pulleys', text: 'guide the strings; their positions set the force angles' },
        { label: 'Strings', text: 'light, inextensible; one per force' },
        { label: 'Weight hangers', text: 'carry the slotted weights; the mass control specifies the total hanging mass' }
      ]
    },
    formula: {
      title: 'Constants',
      items: [
        { label: '$g$', text: '9.8 m/s²' },
        { label: '$i$', text: '1, 2, 3, 4 (one force per string)' }
      ]
    },
    observation: {
      title: 'Lab Reference',
      items: [
        { label: 'Tip', text: 'Press “Record Reading” in the Simulation section to add a row to the table.' },
        { label: 'Equilibrium', text: '$\\sum F_x = 0$ and $\\sum F_y = 0$' }
      ]
    }
  },

  /* ---------------------------------------------------------------- Help modal
     A topic is opened automatically when it matches the section you are in
     (topic.id === section id, or the section is listed in topic.sections).      */
  helpTitle: 'Procedure & Operating Guide',
  helpSubtitle: 'Select a topic from the list to view the procedure',
  help: [
    {"id": "diagram", "question": "How to use the Diagram section", "title": "How to use the Diagram section", "steps": [{"title": "Identify the apparatus", "desc": "Use the labelled illustration and the components list to locate the force table, central ring and pin, strings, pulleys and weight hangers."}, {"title": "Connect the diagram to the simulation", "desc": "Each string applies a force to the ring. Its pulley position sets the angle and its total hanging mass sets the magnitude. Open Simulation to adjust them."}]},
    {"id": "formula", "question": "How to use the Formula section", "title": "How to use the Formula section", "steps": [{"title": "Choose a formula", "desc": "Use Select Formula to view the force, components, equilibrium condition or resultant relationship."}, {"title": "Read the definitions", "desc": "The usage box explains when to apply the formula. Check the variable definitions and units, then use Calculation to work through a set of masses and angles."}]},
    {
      id: 'simulation',
      question: 'How the Simulation works',
      title: 'How the Simulation Section Works',
      subtitle: 'Setting the forces and watching the ring',
      steps: [
        { title: 'Open the Variables card', desc: 'The right-hand panel has <strong>Controls</strong> and <strong>Variables</strong> cards. Open <strong>Variables</strong> to see the eight sliders: <strong>Mass 1–4 (kg)</strong> and <strong>Angle 1–4 (°)</strong>.' },
        { title: 'Choose the masses', desc: 'Drag a <strong>Mass i</strong> slider or type a value (0 to 1 kg). The brass stack illustrates the mass; use the number box for its exact value. The force $F_i = m_i g$ is updated.' },
        { title: 'Choose the angles', desc: 'Drag a <strong>pulley or coloured force label</strong> around the table, or use its <strong>Angle i</strong> slider or number box (0° to 360°). Masses are changed only with their sliders or number boxes. The pulley moves around the scale and the string follows. Each string and hanger has its own colour, matching its slider.' },
        { title: 'Read the status bar', desc: 'Above the 3D view the lab shows <em>“Achieved Equilibrium – The ring is centered”</em> or <em>“Not in Equilibrium – Adjust the values”</em>. When unbalanced, the ring drifts in the direction of the resultant.' },
        { title: 'Use the Controls card', desc: '<strong>Reset</strong> restores all default masses, angles, display options and the camera view, recentres the ring and clears recorded readings. The forces update continuously. <strong>Record Reading</strong> saves the present masses, angles and sums to the Observation table. Tick or untick <strong>Show</strong> options to hide the force vectors, the white resultant arrow labelled <strong>R</strong> or the labels. At equilibrium R is zero, so its arrow and label are hidden.' },
        { title: 'Move around the table', desc: 'Drag on empty space to rotate the view, use the mouse wheel or pinch to zoom, and use the corner buttons for full-screen. Leaving Simulation restores the overhead camera view without changing the masses, angles or recorded readings.' }
      ],
      tip: 'Change one slider at a time so you can see exactly how that force changes the resultant.'
    },
    {
      id: 'equilibrium',
      question: 'How to reach equilibrium',
      title: 'How to Bring the Ring to Equilibrium',
      subtitle: 'Making ΣFx = 0 and ΣFy = 0',
      steps: [
        { title: 'Calculate each force', desc: 'Use $F_i = m_i g$ with $g = 9.8\\ \\text{m/s}^2$. For example, 0.1 kg gives 0.98 N.' },
        { title: 'Resolve into components', desc: 'Work out $F_{ix} = F_i\\cos\\theta_i$ and $F_{iy} = F_i\\sin\\theta_i$ for every string.' },
        { title: 'Cancel the x- and y-components', desc: 'Change a mass or an angle until $\\sum F_{ix} = 0$ <em>and</em> $\\sum F_{iy} = 0$. Both sums must vanish, not just one of them.' },
        { title: 'Try these balanced set-ups', desc: 'Two equal masses at opposite angles (such as 0° and 180°) cancel. Three equal masses at 0°, 120° and 240° also cancel. Four equal masses at 0°, 90°, 180° and 270° are balanced too.' },
        { title: 'Confirm', desc: 'When the sums read 0.00 N the message changes to <em>“Achieved Equilibrium”</em> and the ring settles at the centre.' }
      ],
      tip: 'Equal masses are not enough on their own. The directions matter: two equal masses at the <em>same</em> angle add up instead of cancelling.'
    },
    {
      id: 'observation',
      question: 'How the Observation table works',
      title: 'How the Observation Section Works',
      subtitle: 'Recording and comparing your trials',
      steps: [
        { title: 'Set up a trial', desc: 'In the Simulation, choose the masses and angles you want to test.' },
        { title: 'Record it', desc: 'Press <strong>Record Reading</strong>. A row is added with the masses, the angles, $\\sum F_x$, $\\sum F_y$, $R$ and whether the ring is in equilibrium.' },
        { title: 'Compare the trials', desc: 'The table keeps your latest eight readings. The largest and smallest $R$ are marked <strong>[MAX]</strong> and <strong>[MIN]</strong>. <strong>Reset</strong> clears the table.' }
      ],
      tip: 'Record at least one balanced and one unbalanced trial so you can compare them.'
    },
    {
      id: 'calculation',
      question: 'How the Calculation section works',
      title: 'How the Calculation Section Works',
      subtitle: 'Work through the numbers step by step',
      steps: [
        { title: 'Enter masses and angles', desc: 'Type the four masses (kg) and four angles (°) you want to check in the <strong>Calculation Variables</strong> boxes.' },
        { title: 'Follow the steps', desc: 'The page calculates $F_i = m_i g$, then $\\sum F_x$, $\\sum F_y$, $R$ and $\\theta$, showing the formula and your numbers for every step.' },
        { title: 'Check against the simulation', desc: 'Use the same values in the Simulation. The results must match what you calculate here.' }
      ],
      tip: 'When $R = 0$ the angle $\\theta$ is undefined, so it is shown as a dash.'
    },
    {
      id: 'results',
      question: 'How to read the Results',
      title: 'How to Read the Results Section',
      subtitle: 'Numbers and vector diagrams',
      steps: [
        { title: 'Readouts', desc: 'The page lists $F_1$ to $F_4$, $\\sum F_x$, $\\sum F_y$, $R$, $\\theta$, the ring displacement and the condition.' },
        { title: 'Force components table', desc: 'It shows the magnitude, angle and x- and y-components of each force.' },
        { title: 'Vector diagram', desc: 'The left diagram draws all forces from one point. The right diagram places them head to tail. At equilibrium the polygon <strong>closes</strong>, so the resultant is zero.' }
      ],
      tip: 'A closed polygon is a quick visual proof of equilibrium.'
    },
    {
      id: 'troubleshooting',
      question: 'Troubleshooting & FAQ',
      title: 'Troubleshooting & FAQ',
      subtitle: 'Common questions',
      steps: [
        { title: 'The ring does not move', desc: 'The ring stays centred when the forces balance. Change a mass or drag a pulley to change an angle; the ring responds automatically. Reset restores the balanced default setup.' },
        { title: 'The 3D view is blank', desc: 'The 3D table needs WebGL and an internet connection to load Three.js. Reload the page, or try another browser. The other sections work without it.' },
        { title: 'Formulas look like plain text', desc: 'Formulas are drawn with KaTeX, which is also loaded from the internet. Check your connection and reload the page.' },
        { title: 'Why is the ring displacement small?', desc: 'The ring movement is exaggerated for visibility and limited to the table. Rely on the numbers ($R$ and $\\theta$) for the exact values.' }
      ],
      tip: 'Use the ✕ Close button to return to the dashboard at any time.'
    }
  ]
};
