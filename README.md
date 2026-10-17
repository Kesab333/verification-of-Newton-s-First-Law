# Experiment 6 – Verification of Newton's First Law: Equilibrium of a Particle

A SOLVE Virtual Lab experiment built on the SOLVE Virtual Lab experiment template (NITK Surathkal).
A student sets four masses and four pulley angles on a 3D force table and checks whether the central
ring stays centred, i.e. whether the vector sum of the forces is zero (ΣF = 0).

## Sections
Diagram · Formula · Simulation · Observation · Calculation · Results · Help.

The experiment updates continuously. Drag a pulley or force label to change its angle;
use the sliders or number boxes to change masses. Reset restores the default setup,
display options and camera, and clears readings. Leaving Simulation resets only the camera
to the overhead view; experiment values and readings are preserved. The ring travel is illustrative.

## Where things live
- `js/config.js`   – all text, variables (Mass 1–4 in kg, Angle 1–4 in degrees), formulas, calculation steps, help topics
- `js/physics.js`  – F = mg, components, ΣFx, ΣFy, R, θ, equilibrium test, ring motion
- `js/scene.js`    – Three.js force table, tripod, ring, strings, pulleys, hangers, force vectors
- `js/vectors.js`  – components table and vector diagram in Results
- `css/lab.css`    – styles added for this experiment

## Run locally
Serve the folder with any static HTTP server (modules and an import map are used), e.g.
`python -m http.server 8000`, then open http://localhost:8000. Three.js, KaTeX and the Nunito font are
loaded from public CDNs, so an internet connection is required.

## Attribution and license
Based on the SOLVE Virtual Lab experiment template by the SOLVE Virtual Lab team, NITK Surathkal.
Distributed under the MIT License (see LICENSE).
