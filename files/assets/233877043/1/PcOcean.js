// PcOceanScript.js – PlayCanvas point‑cloud ocean (no camera controls)
// Attach this script to an entity; its local transform defines the ocean’s
// position/orientation. Requires a camera entity reference for pointer casting.

var PcOcean = pc.createScript('pcOcean');

/*────────────────────────  ATTRIBUTES  ────────────────────────*/
PcOcean.attributes.add('camera', { type: 'entity', title: 'Camera' });
PcOcean.attributes.add('planeWidth',  { type: 'number', default: 120, min: 10 });
PcOcean.attributes.add('planeDepth',  { type: 'number', default: 120, min: 10 });
PcOcean.attributes.add('segments',    { type: 'number', default: 240, min: 8  });

PcOcean.attributes.add('amplitude',   { type: 'number', default: 2.2, step: 0.1 });
PcOcean.attributes.add('wavelength',  { type: 'number', default: 12,  step: 0.1 });
PcOcean.attributes.add('speed',       { type: 'number', default: 0.6, step: 0.01 });

PcOcean.attributes.add('pointerRadius',   { type: 'number', default: 18 });
PcOcean.attributes.add('pointerStrength', { type: 'number', default: 5 });
PcOcean.attributes.add('pointSize',       { type: 'number', default: 4 });
PcOcean.attributes.add('autoRotate',      { type: 'boolean', default: false });

PcOcean.attributes.add('colorLow',  { type: 'rgba', default: [18, 102, 212, 255] });
PcOcean.attributes.add('colorMid',  { type: 'rgba', default: [34, 170, 255, 255] });
PcOcean.attributes.add('colorHigh', { type: 'rgba', default: [225, 243, 255, 255] });

/*────────────────────────  HELPERS  ───────────────────────────*/
function lerpColor(a, b, t) {
    return new pc.Color(
        pc.math.lerp(a.r, b.r, t),
        pc.math.lerp(a.g, b.g, t),
        pc.math.lerp(a.b, b.b, t)
    );
}

/*────────────────────────  INITIALIZE  ────────────────────────*/
PcOcean.prototype.initialize = function () {
    const app = this.app;
    const device = app.graphicsDevice;

    /* Build vertex buffer */
    const seg = this.segments;
    this._vertsPerSide = seg + 1;
    const numVerts = this._vertsPerSide * this._vertsPerSide;

    // Keep base positions for wave calc
    this._base = new Float32Array(numVerts * 3);

    const format = new pc.VertexFormat(device, [
        { semantic: pc.SEMANTIC_POSITION, components: 3, type: pc.TYPE_FLOAT32 },
        { semantic: pc.SEMANTIC_COLOR,    components: 3, type: pc.TYPE_FLOAT32 }
    ]);
    this._vb = new pc.VertexBuffer(device, format, numVerts, true);

    const it = new pc.VertexIterator(this._vb);
    const deepC = this._rgbaToColor(this.colorLow);

    let i = 0;
    for (let z = 0; z <= seg; z++) {
        for (let x = 0; x <= seg; x++) {
            const u = x / seg;
            const v = z / seg;
            const px = (u - 0.5) * this.planeWidth;
            const pz = (v - 0.5) * this.planeDepth;

            it.element.position.set(px, 0, pz);
            it.element.color.set(deepC.r, deepC.g, deepC.b);

            const i3 = i * 3;
            this._base[i3]     = px;
            this._base[i3 + 1] = 0;
            this._base[i3 + 2] = pz;

            it.next();
            i++;
        }
    }
    it.end();

    /* Build mesh & material */
    const mesh = new pc.Mesh(device);
    mesh.vertexBuffer = this._vb;
    mesh.primitive[0] = { type: pc.PRIMITIVE_POINTS, base: 0, count: numVerts, indexed: false };

    const mat = new pc.StandardMaterial();
    mat.useVertexColors = true;
    mat.chunks.baseVS = mat.chunks.baseVS + '\nvoid setPointSize(){gl_PointSize=' + this.pointSize.toFixed(1) + ';}';
    mat.update();

    /* Attach Render component if missing */
    if (!this.entity.render) this.entity.addComponent('render');
    this.entity.render.meshInstances = [new pc.MeshInstance(mesh, mat, this.entity)];

    /* Mouse pointer tracking */
    this._pointer = new pc.Vec2(NaN, NaN);
    if (app.mouse) {
        app.mouse.on(pc.EVENT_MOUSEMOVE, (e) => this._pointer.set(e.x, e.y));
        app.mouse.on(pc.EVENT_MOUSELEAVE, () => this._pointer.set(NaN, NaN));
    }

    this._time = 0;
};

/*────────────────────────  UPDATE  ────────────────────────────*/
PcOcean.prototype.update = function (dt) {
    const app = this.app;
    this._time += dt;

    /* Early‑out if no camera */
    if (!this.camera || !this.camera.camera) return;

    /* Pointer world on plane Y = entity.y */
    let pLocal = null;
    if (!isNaN(this._pointer.x)) {
        const cam = this.camera.camera;
        const from = cam.screenToWorld(this._pointer.x, this._pointer.y, cam.nearClip);
        const to   = cam.screenToWorld(this._pointer.x, this._pointer.y, cam.farClip);
        const dir  = to.clone().sub(from).normalize();
        const planeY = this.entity.getPosition().y;
        const t = (planeY - from.y) / dir.y;
        if (t > 0) {
            const hit = from.add(dir.mulScalar(t));
            pLocal = this.entity.worldToLocal(hit);
        }
    }

    /* Colors */
    const cLow  = this._rgbaToColor(this.colorLow);
    const cMid  = this._rgbaToColor(this.colorMid);
    const cHigh = this._rgbaToColor(this.colorHigh);

    /* Iterate vertices */
    const it = new pc.VertexIterator(this._vb);
    const seg = this.segments;
    const amp = this.amplitude;
    const wl  = this.wavelength;
    const spd = this.speed * 10;

    let idx = 0;
    for (let z = 0; z <= seg; z++) {
        for (let x = 0; x <= seg; x++) {
            const i3 = idx * 3;
            const px = this._base[i3];
            const pz = this._base[i3 + 2];

            let y = (Math.sin((px + this._time * spd) / wl) + Math.cos((pz + this._time * spd) / wl)) * amp;

            if (pLocal) {
                const dx = pLocal.x - px;
                const dz = pLocal.z - pz;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < this.pointerRadius) {
                    const u = dist / this.pointerRadius;
                    y += 0.5 * this.pointerStrength * (1 + Math.cos(Math.PI * u));
                }
            }

            it.element.position.y = y;

            const hNorm = pc.math.clamp((y + amp + this.pointerStrength) / (2 * amp + this.pointerStrength), 0, 1);
            const col = hNorm < 0.5 ? lerpColor(cLow, cMid, hNorm / 0.5) : lerpColor(cMid, cHigh, (hNorm - 0.5) / 0.5);
            it.element.color.set(col.r, col.g, col.b);

            it.next();
            idx++;
        }
    }
    it.end();

    if (this.autoRotate) this.entity.rotateLocal(0, dt * 10, 0);
};

/*────────────────────────  HELPERS  ───────────────────────────*/
PcOcean.prototype._rgbaToColor = function (rgba) {
    return new pc.Color(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255);
};

/*────────────────────────  CLEANUP  ───────────────────────────*/
PcOcean.prototype.destroy = function () {
    if (this._vb) this._vb.destroy();
    if (this.app.mouse) {
        this.app.mouse.off(pc.EVENT_MOUSEMOVE);
        this.app.mouse.off(pc.EVENT_MOUSELEAVE);
    }
};
