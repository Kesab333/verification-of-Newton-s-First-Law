/* Force-table equilibrium model. Ring travel is a bounded visual aid, not a dynamics measurement. */
import { clamp } from './utils.js';

export const G = 9.8;
export const FORCE_COUNT = 4;
export const EQ_TOLERANCE = 0.005;
const MAX_DISPLACEMENT = 0.11;
const DISPLACEMENT_SCALE = 0.8;
const RESPONSE_RATE = 5;
const toRad = (deg) => deg * Math.PI / 180;
const clean = (x) => Math.abs(x) < 1e-9 ? 0 : x;

export class ExperimentModel {
  static MAX_READINGS = 8;

  constructor({ variables = [], toggles = [] } = {}) {
    this.defs = Object.fromEntries(variables.map((v) => [v.name, v]));
    this.defaultToggles = Object.fromEntries(toggles.map((t) => [t.id, t.checked ?? true]));
    this.reset();
  }

  reset() {
    this.parameters = Object.fromEntries(Object.values(this.defs).map((v) => [v.name, v.value]));
    this.toggles = { ...this.defaultToggles };
    this.time = 0;
    this.x = 0;
    this.y = 0;
    this.readings = [];
    this.readingSeq = 0;
    this.computeOutputs();
  }

  setToggle(id, enabled) { this.toggles[id] = enabled; }

  setParameter(name, value) {
    const def = this.defs[name];
    if (!def || !Number.isFinite(Number(value))) return this.parameters[name];
    const clamped = clamp(Number(value), def.min, def.max);
    this.parameters[name] = Number((Math.round((clamped - def.min) / def.step) * def.step + def.min).toFixed(8));
    this.computeOutputs();
    return this.parameters[name];
  }

  update(dt) {
    this.step(dt);
    this.time += dt;
    this.computeOutputs();
  }

  addReading(row) {
    this.readings.push(row);
    if (this.readings.length > ExperimentModel.MAX_READINGS) this.readings.shift();
  }

  get state() {
    return { time: this.time, parameters: { ...this.parameters }, toggles: { ...this.toggles }, values: this.values, readings: this.readings };
  }

  /** F_i = m_i g, resolved into components; summed into ΣFx, ΣFy. */
  netForce() {
    const forces = [];
    let sx = 0;
    let sy = 0;
    for (let i = 1; i <= FORCE_COUNT; i += 1) {
      const mass = this.parameters[`m${i}`];
      const angle = this.parameters[`a${i}`];
      const F = mass * G;
      const fx = clean(F * Math.cos(toRad(angle)));
      const fy = clean(F * Math.sin(toRad(angle)));
      forces.push({ mass, angle, F, fx, fy });
      sx += fx;
      sy += fy;
    }
    return { forces, sx: clean(sx), sy: clean(sy) };
  }

  /** Ring drifts toward the resultant force (or back to the centre when balanced). */
  step(dt) {
    const { sx, sy } = this.netForce();
    const R = Math.hypot(sx, sy);
    let tx = 0;
    let ty = 0;
    if (R >= EQ_TOLERANCE) {
      const reach = MAX_DISPLACEMENT * (1 - Math.exp(-R / DISPLACEMENT_SCALE));
      tx = (reach * sx) / R;
      ty = (reach * sy) / R;
    }
    const follow = 1 - Math.exp(-RESPONSE_RATE * dt);
    this.x += (tx - this.x) * follow;
    this.y += (ty - this.y) * follow;
  }

  /** Everything the UI shows. Keys are read by config.results / scene.js / vectors.js */
  computeOutputs() {
    const { forces, sx, sy } = this.netForce();
    const R = Math.hypot(sx, sy);
    const equilibrium = R < EQ_TOLERANCE;
    const theta = equilibrium ? NaN : (((Math.atan2(sy, sx) * 180) / Math.PI) + 360) % 360;

    this.values = {
      forces,
      sx,
      sy,
      R,
      theta,
      equilibrium,
      sumMagnitudes: forces.reduce((total, f) => total + f.F, 0),
      ringX: this.x,
      ringY: this.y,
      displacement: Math.hypot(this.x, this.y) * 100 // cm
    };
    forces.forEach((f, i) => { this.values[`F${i + 1}`] = f.F; });
  }

  /** Called by the "Record Reading" button. */
  recordReading() {
    const v = this.values;
    const p = this.parameters;
    const list = (key, digits) => Array.from({ length: FORCE_COUNT }, (_, i) => p[`${key}${i + 1}`].toFixed(digits)).join(', ');
    this.addReading({
      // a unique sequence distinguishes readings taken at the same time
      time: this.time + this.readingSeq * 1e-4,
      masses: list('m', 2),
      angles: list('a', 0),
      sx: v.sx,
      sy: v.sy,
      R: v.R,
      equilibrium: v.equilibrium
    });
    this.readingSeq += 1;
  }

}
