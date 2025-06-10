// camera-orbiter.js
var CameraOrbiter = pc.createScript('cameraOrbiter');

// --- Atributos del Editor ---
CameraOrbiter.attributes.add('maxYaw', { type: 'number', default: 15, title: 'Ángulo Máx. Yaw (°)' });
CameraOrbiter.attributes.add('maxPitch', { type: 'number', default: 10, title: 'Ángulo Máx. Pitch (°)' });
CameraOrbiter.attributes.add('smoothFactor', { type: 'number', default: 0.1, title: 'Suavizado (0-1)' });
CameraOrbiter.attributes.add('targetName', { type: 'string', default: 'CameraTarget', title: 'Nombre del target' });

/*
// FIX: Comentado para que la cámara no se reposicione automáticamente.
CameraOrbiter.attributes.add('distance', {
    type: 'number',
    default: 5,
    title: 'Distancia al Target (m)',
    description: 'La distancia que mantendrá la cámara con respecto a su objetivo.'
});
*/

CameraOrbiter.attributes.add('enableOrbit', {
    type: 'boolean',
    default: true,
    title: 'Habilitar Órbita',
    description: 'Habilita o deshabilita el movimiento orbital con el ratón.'
});

// FIX: Añadido el atributo para invertir el eje X.
CameraOrbiter.attributes.add('invertX', {
    type: 'boolean',
    default: false,
    title: 'Invertir Eje X',
    description: 'Invierte el control horizontal del ratón.'
});

CameraOrbiter.attributes.add('invertY', {
    type: 'boolean',
    default: false,
    title: 'Invertir Eje Y',
    description: 'Invierte el control vertical del ratón. Por defecto, mover arriba mira hacia arriba.'
});


CameraOrbiter.prototype.initialize = function() {
    this.target = this.app.root.findByName(this.targetName);

    if (!this.target) {
        console.error("CameraOrbiter: No se encontró el target con el nombre: " + this.targetName);
        return;
    }

    // Variables para el cálculo de la rotación
    this.currentYaw = 0;
    this.currentPitch = 0;
    this.desiredYaw = 0;
    this.desiredPitch = 0;

    // Vectores y cuaterniones para reutilizar en 'update'
    this.rotation = new pc.Quat();
    // FIX: Vectores para la lógica de solo-rotación.
    this.direction = new pc.Vec3();
    this.lookAtPosition = new pc.Vec3();

    this.app.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);

    // Nos aseguramos de que la cámara mire al target al iniciar
    this.entity.lookAt(this.target.getPosition());
};

/**
 * Gestiona el evento de movimiento del ratón.
 * @param {pc.MouseEvent} evt - El evento del ratón.
 */
CameraOrbiter.prototype.onMouseMove = function(evt) {
    if (!this.enableOrbit) {
        return;
    }

    var xN = (evt.x / this.app.graphicsDevice.width - 0.5) * 2;
    var yN = (evt.y / this.app.graphicsDevice.height - 0.5) * 2;

    // FIX: Se utilizan los atributos 'invertX' e 'invertY' para decidir la dirección.
    var xInvert = this.invertX ? -1 : 1;
    var yInvert = this.invertY ? -1 : 1;

    this.desiredYaw = xN * this.maxYaw * xInvert;
    this.desiredPitch = -yN * this.maxPitch * yInvert;
};


CameraOrbiter.prototype.update = function(dt) {
    if (!this.target || !this.enableOrbit) {
        return;
    }

    // 1) Suavizamos los ángulos usando interpolación lineal (lerp)
    this.currentYaw += (this.desiredYaw - this.currentYaw) * this.smoothFactor;
    this.currentPitch += (this.desiredPitch - this.currentPitch) * this.smoothFactor;

    // FIX: La lógica ha sido cambiada a solo rotación. La cámara no cambiará
    // su posición, solo hacia dónde mira, basado en la posición del target.

    // 2) Obtenemos la posición actual de la cámara y del objetivo
    var camPos = this.entity.getPosition();
    var tgtPos = this.target.getPosition();

    // 3) Calculamos la dirección base desde la cámara hacia el target
    this.direction.sub2(tgtPos, camPos).normalize();

    // 4) Creamos un cuaternión de rotación a partir de los ángulos del ratón
    this.rotation.setFromEulerAngles(this.currentPitch, -this.currentYaw, 0);

    // 5) Transformamos (rotamos) la dirección base con la rotación del ratón
    this.rotation.transformVector(this.direction, this.direction);

    // 6) Calculamos el punto final al que mirar, sumando la dirección a la posición de la cámara
    this.lookAtPosition.add2(camPos, this.direction);

    // 7) Apuntamos la cámara a la nueva posición
    this.entity.lookAt(this.lookAtPosition, pc.Vec3.UP);
};
