/* ==========================================================================
   scene.js — the 3D view (Three.js): a circular force table on a tripod.

   GENERIC (kept from the template): renderer, camera, OrbitControls, resize
                   handling (incl. portrait / mobile camera), pointer plumbing
   SPECIFIC:       buildApparatus() and updateApparatus() — table, ring,
                   strings, pulleys, hangers, force vectors

   Contract with app.js
   --------------------
     const scene = new LabScene(hostElement, { onAngleInput });
     scene.update(state)   every frame, after the model has advanced
     scene.resize()        when the layout changes

   Coordinates: the table lies in the x–z plane. An angle θ on the scale points
   along (cos θ, 0, −sin θ), so 0° is to the right and 90° is the far side.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FORCE_COLORS } from './config.js';

/* ---- Apparatus dimensions (scene units) ---- */
const FACE_R = 4.95;        // dark scale face
const RING_Y = 0.88;        // strings meet the top of the raised pulley wheels
const PULLEY_X = 5.65;      // keep the entire wheel outside the metal rim
const PULLEY_R = 0.35;      // pulley wheel radius
const PULLEY_Y = RING_Y - PULLEY_R;
const HANG_X = PULLEY_X + PULLEY_R;
const HANG_TOP = -1.9;
const RING_R = 0.28;
const DISPLACEMENT_SCALE = 14;  // metres of ring travel -> scene units
const ARROW_Y = 0.38;           // full arrowheads clear the tabletop
const FORCE_COUNT = 4;
const ARROW_UNITS_PER_N = 1.5;  // default vector length per newton …
const ARROW_MAX = 4.4;          // … rescaled together if the longest would exceed this
const TOLERANCE = 0.005;
const DISC_MASS = 0.1;          // illustrative brass stack; controls show the exact total mass

const rad = (deg) => (deg * Math.PI) / 180;
const dirOf = (deg) => new THREE.Vector3(Math.cos(rad(deg)), 0, -Math.sin(rad(deg)));
const UP = new THREE.Vector3(0, 1, 0);

export class LabScene {
  constructor(host, { onAngleInput = () => {} } = {}) {
    this.host = host;
    this.onAngleInput = onAngleInput;
    this.interactive = true;
    this.dragging = false;
    this.pickables = [];

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    /* ---- Scene / camera / renderer ---- */
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    // Overhead view: 90° at the top, 0° to the right, with the full rim in view.
    this.camera.position.set(0, 19.5, 0.001);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.touchAction = 'none';
    host.append(this.renderer.domElement);

    this.addLights();
    this.buildApparatus();

    /* ---- Orbit controls: drag empty space to rotate, wheel/pinch to zoom ---- */
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 0, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 38;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.rotateSpeed = 0.5;
    this.controls.update();
    this.controls.saveState();
    this.bindAngleDragging();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
  }

  attachTo(host, interactive = true) {
    this.endAngleDrag();
    this.resizeObserver.unobserve(this.host);
    this.host = host;
    host.append(this.renderer.domElement);
    this.interactive = interactive;
    this.controls.enabled = interactive;
    this.resizeObserver.observe(host);
    this.resize();
  }

  resetView() {
    this.endAngleDrag();
    // Consume any orbit inertia before restoring the saved camera and target.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.reset();
    this.controls.enableDamping = true;
    this.resize();
  }

  pointerRay(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  bindAngleDragging() {
    const canvas = this.renderer.domElement;
    const plane = new THREE.Plane(UP, -RING_Y);
    const point = new THREE.Vector3();
    this.endAngleDrag = () => {
      const pointerId = this.dragPointer;
      this.dragPointer = null;
      this.dragging = false;
      if (pointerId != null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
      this.controls.enabled = this.interactive;
      canvas.style.cursor = '';
    };
    const angleAtPointer = (event) => {
      this.pointerRay(event);
      if (!this.raycaster.ray.intersectPlane(plane, point) || Math.hypot(point.x, point.z) < 0.7) return null;
      return (THREE.MathUtils.radToDeg(Math.atan2(-point.z, point.x)) + 360) % 360;
    };
    this.onPointerDown = (event) => {
      if (!this.interactive || this.dragging || event.button !== 0) return;
      this.pointerRay(event);
      const hit = this.raycaster.intersectObjects(this.pickables, false).find((h) => h.object.visible);
      if (!hit) return;
      const angle = angleAtPointer(event);
      if (angle == null) return;
      this.dragIndex = hit.object.userData.forceIndex;
      this.dragOffset = this.currentAngles[this.dragIndex] - angle;
      this.dragging = true;
      this.dragPointer = event.pointerId;
      this.controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    this.onPointerMove = (event) => {
      if (!this.interactive) return;
      if (!this.dragging) {
        this.pointerRay(event);
        canvas.style.cursor = this.raycaster.intersectObjects(this.pickables, false).some((h) => h.object.visible) ? 'grab' : '';
        return;
      }
      if (event.pointerId !== this.dragPointer) return;
      const angle = angleAtPointer(event);
      if (angle != null) this.onAngleInput(this.dragIndex, Math.round(((angle + this.dragOffset) % 360 + 360) % 360) % 360);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    this.onPointerEnd = (event) => {
      if (event.pointerId !== this.dragPointer) return;
      this.endAngleDrag();
      event.stopImmediatePropagation();
    };
    canvas.addEventListener('pointerdown', this.onPointerDown, true);
    canvas.addEventListener('pointermove', this.onPointerMove, true);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => canvas.addEventListener(type, this.onPointerEnd, true));
    window.addEventListener('blur', this.endAngleDrag);
  }

  /* ------------------------------------------------------------------------
     GENERIC
     ------------------------------------------------------------------------ */

  addLights() {
    const r = this.renderer;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;

    // Studio-like backdrop, drawn once into a canvas (also used for metal reflections)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const g = canvas.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#f2f5fa');
    sky.addColorStop(0.5, '#9aa3ad');
    sky.addColorStop(0.51, '#3a3f46');
    sky.addColorStop(1, '#14161a');
    g.fillStyle = sky;
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#ffffff';
    g.fillRect(140, 60, 220, 90);
    g.fillRect(600, 40, 280, 100);
    g.fillRect(400, 170, 120, 40);
    const env = new THREE.CanvasTexture(canvas);
    env.mapping = THREE.EquirectangularReflectionMapping;
    env.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromEquirectangular(env).texture;
    pmrem.dispose();
    env.dispose();

    this.scene.background = new THREE.Color(0xffffff);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555a60, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 3.4);
    sun.position.set(7, 14, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  resize() {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width === 0 || height === 0) return; // hidden panel — the ResizeObserver fires again when shown

    const aspect = width / height;
    const baseFov = 38;
    this.camera.aspect = aspect;

    // Fit the same overhead framing on phones without changing the user's camera position.
    this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov / 2)) / Math.min(aspect, 1)));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** Called every frame. */
  update(state) {
    this.updateApparatus(state);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.endAngleDrag();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown, true);
    canvas.removeEventListener('pointermove', this.onPointerMove, true);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => canvas.removeEventListener(type, this.onPointerEnd, true));
    window.removeEventListener('blur', this.endAngleDrag);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /* ------------------------------------------------------------------------
     SPECIFIC — the force table
     ------------------------------------------------------------------------ */

  buildApparatus() {
    const mats = {
      silver: new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 1.0, roughness: 0.28, side: THREE.DoubleSide }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x1b1c1e, metalness: 0.75, roughness: 0.38 }),
      black: new THREE.MeshStandardMaterial({ color: 0x0f1011, metalness: 0.2, roughness: 0.6 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb8892e, metalness: 0.9, roughness: 0.33 }),
      bronze: new THREE.MeshStandardMaterial({ color: 0xa88650, metalness: 0.85, roughness: 0.3 })
    };
    this.mats = mats;

    const add = (parent, geometry, material, x = 0, y = 0, z = 0, shadow = true) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    this.addMesh = add;
    const unitCylinder = (radius, segments = 10) => new THREE.CylinderGeometry(radius, radius, 1, segments);

    /* ---- Table: aluminium rim, underside, graduated face ---- */
    const table = new THREE.Group();
    this.scene.add(table);
    const rimProfile = [[4.90, 0.0], [4.95, 0.07], [5.05, 0.09], [5.17, 0.07], [5.22, 0.0], [5.22, -0.5], [5.0, -0.52]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    add(table, new THREE.LatheGeometry(rimProfile, 160), mats.silver);
    const underside = add(table, new THREE.CircleGeometry(5.0, 96), mats.darkMetal, 0, -0.5, 0);
    underside.rotation.x = Math.PI / 2;
    const face = add(
      table,
      new THREE.CircleGeometry(FACE_R, 160),
      new THREE.MeshStandardMaterial({ map: this.makeFaceTexture(), roughness: 0.5, metalness: 0.25 }),
      0, 0.002, 0, false
    );
    face.rotation.x = -Math.PI / 2;
    add(table, new THREE.CylinderGeometry(0.13, 0.15, 0.04, 32), mats.silver, 0, 0.02, 0); // centre pin base
    add(table, new THREE.CylinderGeometry(0.035, 0.035, 1.05, 16), mats.silver, 0, 0.525, 0);

    /* ---- Tripod stand ---- */
    const stand = new THREE.Group();
    this.scene.add(stand);
    add(stand, new THREE.CylinderGeometry(1.1, 1.3, 0.22, 48), mats.darkMetal, 0, -0.62, 0);
    add(stand, new THREE.CylinderGeometry(0.55, 0.7, 0.45, 32), mats.black, 0, -0.95, 0);
    const legTops = [];
    const legFeet = [];
    [30, 150, 270].forEach((deg) => {
      const d = dirOf(deg);
      const top = d.clone().multiplyScalar(0.75).setY(-0.85);
      const foot = d.clone().multiplyScalar(3.5).setY(-4.5);
      legTops.push(top);
      legFeet.push(foot);
      const leg = add(stand, unitCylinder(0.12, 14), mats.darkMetal);
      this.placeCylinder(leg, top, foot);
      add(stand, new THREE.SphereGeometry(0.2, 20, 14), mats.black, top.x, top.y, top.z);
      add(stand, new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), mats.silver, foot.x, foot.y - 0.02, foot.z); // levelling screw
      add(stand, new THREE.CylinderGeometry(0.3, 0.34, 0.14, 24), mats.black, foot.x, foot.y - 0.2, foot.z);   // rubber foot
    });
    const brace = legTops.map((t, i) => t.clone().lerp(legFeet[i], 0.5));
    for (let i = 0; i < 3; i += 1) {
      const bar = add(stand, unitCylinder(0.055, 10), mats.darkMetal);
      this.placeCylinder(bar, brace[i], brace[(i + 1) % 3]);
    }

    /* ---- Central ring ("the particle") ---- */
    this.ring = new THREE.Group();
    this.scene.add(this.ring);
    const torus = add(this.ring, new THREE.TorusGeometry(RING_R, 0.045, 18, 56), mats.bronze);
    torus.rotation.x = Math.PI / 2;
    this.ring.position.set(0, RING_Y, 0);
    this.knots = FORCE_COLORS.map((color) => {
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
      knot.castShadow = true;
      this.ring.add(knot);
      return knot;
    });

    /* ---- Four pulleys, strings and hangers ---- */
    this.rigs = FORCE_COLORS.map((color, i) => this.buildRig(i, color, mats, add, unitCylinder));

    /* ---- Force vectors on the table + resultant ---- */
    this.arrows = FORCE_COLORS.map((color) => this.makeArrow(new THREE.Color(color)));
    this.resultantArrow = this.makeArrow(new THREE.Color(0xffffff), 1.5);
    [...this.arrows, this.resultantArrow].forEach((arrow) => this.scene.add(arrow));
    this.resultantLabel = this.makeLabel('R', '#ffffff');
    this.resultantLabel.visible = false;
    this.scene.add(this.resultantLabel);
  }

  /** One string + pulley + hanger assembly. Returns the handles update() needs. */
  buildRig(i, color, mats, add, unitCylinder) {
    const pulleyGroup = new THREE.Group();
    this.scene.add(pulleyGroup);
    add(pulleyGroup, new THREE.BoxGeometry(0.5, 0.4, 0.46), mats.black, 5.0, -0.1, 0);   // clamp block on the rim
    add(pulleyGroup, new THREE.BoxGeometry(0.7, 0.12, 0.26), mats.black, 5.35, 0.16, 0);
    [-1, 1].forEach((side) => add(pulleyGroup, new THREE.BoxGeometry(0.14, 0.42, 0.08), mats.silver, PULLEY_X, 0.36, side * 0.17));
    [-1, 1].forEach((side) => {
      const cheek = add(pulleyGroup, new THREE.CylinderGeometry(0.28, 0.28, 0.035, 28), mats.darkMetal, PULLEY_X, PULLEY_Y, side * 0.13);
      cheek.rotation.x = Math.PI / 2;
    });
    const axle = add(pulleyGroup, new THREE.CylinderGeometry(0.04, 0.04, 0.36, 12), mats.silver, PULLEY_X, PULLEY_Y, 0);
    axle.rotation.x = Math.PI / 2;
    const core = add(pulleyGroup, new THREE.CylinderGeometry(PULLEY_R - 0.04, PULLEY_R - 0.04, 0.1, 40), mats.black, PULLEY_X, PULLEY_Y, 0);
    core.rotation.x = Math.PI / 2;
    [-1, 1].forEach((side) => {
      const flange = add(pulleyGroup, new THREE.CylinderGeometry(PULLEY_R + 0.02, PULLEY_R + 0.02, 0.03, 40), mats.black, PULLEY_X, PULLEY_Y, side * 0.055);
      flange.rotation.x = Math.PI / 2;
    });

    // String: ring -> pulley top -> arc over the pulley -> down to the hanger
    const stringMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.65 });
    const segment = () => {
      const mesh = new THREE.Mesh(unitCylinder(0.02, 6), stringMaterial);
      mesh.castShadow = true;
      this.scene.add(mesh);
      return mesh;
    };
    const string = { toPulley: segment(), arc: Array.from({ length: 6 }, segment), down: segment() };

    // Hanger with a stack of slotted brass weights
    const hanger = new THREE.Group();
    this.scene.add(hanger);
    const hook = add(hanger, new THREE.TorusGeometry(0.06, 0.014, 8, 20), mats.silver, 0, -0.05, 0);
    hook.rotation.y = Math.PI / 2;
    add(hanger, new THREE.CylinderGeometry(0.022, 0.022, 1.35, 10), mats.silver, 0, -0.675, 0);
    add(hanger, new THREE.CylinderGeometry(0.4, 0.4, 0.04, 36), mats.silver, 0, -1.35, 0);
    const stack = new THREE.Group();
    hanger.add(stack);

    const label = this.makeLabel(i + 1, color);
    label.userData.forceIndex = i;
    // A generous invisible hit area makes small pulleys usable with mouse and touch.
    const hitArea = new THREE.Mesh(new THREE.SphereGeometry(0.58, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    hitArea.position.set(PULLEY_X, PULLEY_Y, 0);
    hitArea.userData.forceIndex = i;
    pulleyGroup.add(hitArea);
    this.pickables.push(hitArea, label);
    this.scene.add(label);
    return { pulleyGroup, string, hanger, stack, label, discs: -1 };
  }

  /** Rebuild the stack of brass discs when the mass changes (one disc per 0.1 kg). */
  setDiscs(rig, count) {
    if (rig.discs === count) return;
    rig.discs = count;
    while (rig.stack.children.length) {
      const disc = rig.stack.children[0];
      disc.geometry.dispose();
      rig.stack.remove(disc);
    }
    for (let k = 0; k < count; k += 1) {
      const y = -1.35 + 0.02 + 0.045 + k * 0.095;
      this.addMesh(rig.stack, new THREE.CylinderGeometry(0.31, 0.31, 0.088, 36), this.mats.brass, 0, y, 0);
      this.addMesh(rig.stack, new THREE.BoxGeometry(0.34, 0.03, 0.05), this.mats.darkMetal, 0.17, y, 0, false); // slot
    }
  }

  /** Orient a unit-height cylinder so that it runs from a to b. */
  placeCylinder(mesh, a, b) {
    const d = b.clone().sub(a);
    const length = d.length();
    if (length < 1e-6) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(UP, d.divideScalar(length));
  }

  /** Flat arrow (shaft + cone) lying on the table. */
  makeArrow(color, thickness = 1) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 10), material);
    const head = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18), material);
    shaft.renderOrder = 2;
    head.renderOrder = 2;
    group.add(shaft, head);
    group.userData = { shaft, head, thickness };
    group.visible = false;
    return group;
  }

  setArrow(arrow, origin, direction, length) {
    if (length < 0.08) {
      arrow.visible = false;
      return;
    }
    const { shaft, head, thickness } = arrow.userData;
    const headLength = Math.min(0.42, length * 0.38);
    const shaftLength = Math.max(length - headLength, 0.001);
    shaft.scale.set(0.045 * thickness, shaftLength, 0.045 * thickness);
    shaft.position.set(0, shaftLength / 2, 0);
    head.scale.set(0.16 * thickness, headLength, 0.16 * thickness);
    head.position.set(0, shaftLength + headLength / 2, 0);
    arrow.position.copy(origin);
    arrow.quaternion.setFromUnitVectors(UP, direction);
    arrow.visible = true;
  }

  /** "F" with a smaller subscript digit, drawn into a sprite. */
  makeLabel(index, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const g = canvas.getContext('2d');
    g.textBaseline = 'middle';
    g.lineWidth = 12;
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(10,10,12,.85)';
    g.fillStyle = color;
    g.font = 'bold 92px Arial, Helvetica, sans-serif';
    const resultant = index === 'R';
    g.strokeText(resultant ? 'R' : 'F', resultant ? 95 : 70, 62);
    g.fillText(resultant ? 'R' : 'F', resultant ? 95 : 70, 62);
    if (!resultant) {
      g.font = 'bold 62px Arial, Helvetica, sans-serif';
      g.strokeText(String(index), 132, 86);
      g.fillText(String(index), 132, 86);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.set(1.15, 0.58, 1);
    return sprite;
  }

  /** The dark graduated face: degree ticks, labels, dashed guide circles, axes. */
  makeFaceTexture() {
    const S = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = S;
    canvas.height = S;
    const g = canvas.getContext('2d');
    const c = S / 2;
    const R = S / 2;

    const base = g.createRadialGradient(c, c, 0, c, c, R);
    base.addColorStop(0, '#2d3034');
    base.addColorStop(1, '#1b1d20');
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 40000; i += 1) { // fine brushed-metal grain
      g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`;
      g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }

    const point = (deg, r) => [c + r * Math.cos(rad(deg)), c - r * Math.sin(rad(deg))];
    g.lineCap = 'round';
    g.strokeStyle = '#d4d8dd';
    g.lineWidth = 4;
    g.beginPath(); g.arc(c, c, R * 0.965, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2;
    g.beginPath(); g.arc(c, c, R * 0.885, 0, Math.PI * 2); g.stroke();

    for (let d = 0; d < 360; d += 1) { // a tick for every degree
      const major = d % 10 === 0;
      const mid = d % 5 === 0;
      const outer = R * 0.965;
      const inner = outer - R * (major ? 0.078 : mid ? 0.055 : 0.032);
      const [x0, y0] = point(d, inner);
      const [x1, y1] = point(d, outer);
      g.lineWidth = major ? 3.5 : mid ? 2.5 : 1.5;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }

    g.fillStyle = '#eceef1';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let d = 0; d < 360; d += 30) {
      const cardinal = d % 90 === 0;
      g.font = `${cardinal ? 'bold 78px' : '600 58px'} Arial, Helvetica, sans-serif`;
      const [x, y] = point(d, R * (cardinal ? 0.80 : 0.81));
      g.fillText(`${d}°`, x, y);
    }

    g.strokeStyle = 'rgba(255,255,255,.28)';
    g.lineWidth = 2.5;
    g.setLineDash([16, 14]);
    [0.58, 0.33].forEach((f) => { g.beginPath(); g.arc(c, c, R * f, 0, Math.PI * 2); g.stroke(); });
    g.strokeStyle = 'rgba(255,255,255,.4)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c - R * 0.64, c); g.lineTo(c + R * 0.64, c);
    g.moveTo(c, c - R * 0.64); g.lineTo(c, c + R * 0.64);
    g.stroke();
    g.setLineDash([]);

    g.strokeStyle = '#cfd3d8';
    g.lineWidth = 3;
    g.beginPath(); g.arc(c, c, R * 0.05, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#cfd3d8';
    g.beginPath(); g.arc(c, c, 5, 0, Math.PI * 2); g.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  /** Per-frame: move the ring, pulleys, strings, hangers and vectors from the model state. */
  updateApparatus(state) {
    const { values, parameters, toggles } = state;
    this.currentAngles = Array.from({ length: FORCE_COUNT }, (_, i) => parameters[`a${i + 1}`]);

    // Ring: model metres -> scene units (the table's y-axis points to the far side, i.e. −z)
    this.ring.position.set(values.ringX * DISPLACEMENT_SCALE, RING_Y, -values.ringY * DISPLACEMENT_SCALE);
    const ringPos = this.ring.position;

    // One common scale for all vectors keeps their lengths proportional
    const longest = Math.max(values.R, ...values.forces.map((f) => f.F), 1e-6);
    const unitsPerNewton = Math.min(ARROW_UNITS_PER_N, ARROW_MAX / longest);
    const origin = new THREE.Vector3(ringPos.x, ARROW_Y, ringPos.z);

    this.rigs.forEach((rig, i) => {
      const angle = parameters[`a${i + 1}`];
      const mass = parameters[`m${i + 1}`];
      const d = dirOf(angle);

      rig.pulleyGroup.rotation.y = rad(angle);
      this.knots[i].position.copy(d).multiplyScalar(RING_R);
      this.setDiscs(rig, Math.ceil(mass / DISC_MASS - 1e-9));

      // String path
      const start = new THREE.Vector3(ringPos.x + d.x * RING_R, RING_Y, ringPos.z + d.z * RING_R);
      const centre = d.clone().multiplyScalar(PULLEY_X).setY(PULLEY_Y);
      const top = centre.clone().addScaledVector(UP, PULLEY_R);
      this.placeCylinder(rig.string.toPulley, start, top);

      let previous = top;
      const arcSegments = rig.string.arc.length;
      rig.string.arc.forEach((mesh, k) => {
        const phi = (Math.PI / 2) * (1 - (k + 1) / arcSegments);
        const p = centre.clone().addScaledVector(d, PULLEY_R * Math.cos(phi)).addScaledVector(UP, PULLEY_R * Math.sin(phi));
        this.placeCylinder(mesh, previous, p);
        previous = p;
      });
      const hangTop = new THREE.Vector3(d.x * HANG_X, HANG_TOP, d.z * HANG_X);
      this.placeCylinder(rig.string.down, previous, hangTop);
      rig.hanger.position.copy(hangTop);

      // Labels and vectors
      rig.label.visible = toggles.labels !== false;
      rig.label.position.set(d.x * 3.2, RING_Y + 0.45, d.z * 3.2);

      const F = values.forces[i];
      const showVectors = toggles.vectors !== false;
      this.setArrow(this.arrows[i], origin, d, showVectors ? F.F * unitsPerNewton : 0);
    });

    // Resultant (white): the direction the ring will move
    const showResultant = toggles.resultant !== false && values.R >= TOLERANCE;
    if (showResultant) {
      const direction = new THREE.Vector3(values.sx, 0, -values.sy).normalize();
      const resultantOrigin = origin.clone().setY(ARROW_Y + 0.3);
      this.setArrow(this.resultantArrow, resultantOrigin, direction, values.R * unitsPerNewton);
      this.resultantLabel.position.copy(resultantOrigin).addScaledVector(direction, values.R * unitsPerNewton + 0.45);
      this.resultantLabel.position.addScaledVector(new THREE.Vector3(-direction.z, 0, direction.x), 0.55);
      this.resultantLabel.position.y += 0.45;
      this.resultantLabel.visible = toggles.labels !== false;
    } else {
      this.resultantArrow.visible = false;
      this.resultantLabel.visible = false;
    }
  }
}
