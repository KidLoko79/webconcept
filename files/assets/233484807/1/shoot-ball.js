// shoot-ball.js

var ShootBall = pc.createScript('shootBall');

// ———————— ATRIBUTOS EXPUESTOS ————————
// 1) spawnPosition: pc.Vec3. Posición fija (x, y, z) desde la que sale la bola.
//    Por defecto [0, 1.5, 5]. Puedes mover ese punto en el Inspector.
// 2) forceAmount: número (float). Intensidad del impulso. Por defecto 100.
// 3) angleVariance: número (float). Desviación máxima en grados (±angleVariance). Por defecto 5.
// 4) ballSize: número (float). Diámetro de la bola en metros. Por defecto 0.10 (=10 cm).

ShootBall.attributes.add('spawnPosition', {
    type: 'vec3',
    title: 'Posición de lanzamiento',
    default: [0, 1.5, 5]
});

ShootBall.attributes.add('forceAmount', {
    type: 'number',
    title: 'Fuerza de disparo',
    default: 100
});

ShootBall.attributes.add('angleVariance', {
    type: 'number',
    title: 'Variabilidad ángulo (grados)',
    default: 5
});

ShootBall.attributes.add('ballSize', {
    type: 'number',
    title: 'Diámetro de la bola (m)',
    default: 0.10
});

// ———————— initialize ————————
// Se suscribe onButtonClick al evento 'click' del Button.
// También configura el cursor en “pointer” al hacer hover sobre el botón.
ShootBall.prototype.initialize = function() {
    if (!this.entity.button || !this.entity.element) {
        console.error('ShootBall: Debes añadir este script sobre una entidad que tenga Button y Element.');
        return;
    }

    this.entity.element.useInput = true;

    this.entity.button.on('click', this.onButtonClick, this);

    // Forzar cursor en forma de mano:
    this.entity.element.on('mouseenter', function () {
        document.body.style.cursor = 'pointer';
    }, this);

    this.entity.element.on('mouseleave', function () {
        document.body.style.cursor = 'auto';
    }, this);
};


// ———————— onButtonClick ————————
// Cada vez que pulsas el botón, creamos una entidad “padre” ball que lleva la colisión
// y el rigidbody, y dentro de ella un hijo con el modelo (esfera) escalado a ballSize.
// Luego aplicamos un applyImpulse de fuerza forceAmount en –Z (con dispersión).
ShootBall.prototype.onButtonClick = function() {
    var app = this.app;

    // 1) Obtenemos la posición absoluta de spawnPosition (pc.Vec3)
    var spawnPos = this.spawnPosition.clone();

    // 2) Dirección base en –Z mundo
    var baseDir = new pc.Vec3(0, 0, -1);

    // 3) Calcular dispersión aleatoria en grados:
    var varianceDeg = this.angleVariance;
    var randomPitch = (Math.random() * 2 - 1) * varianceDeg; // rotación en X (pitch)
    var randomYaw   = (Math.random() * 2 - 1) * varianceDeg; // rotación en Y (yaw)

    // 4) Construir cuaternión a partir de (pitch, yaw, 0)
    var rotQuat = new pc.Quat();
    rotQuat.setFromEulerAngles(randomPitch, randomYaw, 0);

    // 5) Rotar baseDir para obtener shootDir final
    var shootDir = rotQuat.transformVector(baseDir).normalize();

    // 6) Crear la entidad “padre” ball
    var ball = new pc.Entity();

    // 6.1) Componente Collision (esfera) con radio = ballSize / 2
    ball.addComponent('collision', {
        type: 'sphere',
        radius: this.ballSize / 2
    });

    // 6.2) Componente RigidBody (dinámico)
    ball.addComponent('rigidbody', {
        type: 'dynamic',
        mass: 0.5  // ajusta la masa a tu gusto
    });
    ball.rigidbody.restitution = 0.1; // poco rebote, opcional

    // 6.3) Posicionar la entidad ball en spawnPos
    ball.setPosition(spawnPos);

    // 7) Crear la entidad “hijo” ballVisual que llevará el modelo y el material amarillo.
    var ballVisual = new pc.Entity();
    ballVisual.addComponent('model', { type: 'sphere' });

    // 7.1) Material amarillo
    var yellowMaterial = new pc.StandardMaterial();
    yellowMaterial.diffuse = new pc.Color(1, 1, 0); // amarillo puro
    yellowMaterial.update();
    ballVisual.model.material = yellowMaterial;

    // 7.2) Escalar el hijo para que mida ballSize metros de diámetro
    ballVisual.setLocalScale(this.ballSize, this.ballSize, this.ballSize);

    // 8) Anidar ballVisual dentro de ball
    ball.addChild(ballVisual);

    // 9) Añadir la entidad padre ball a la escena
    app.root.addChild(ball);

    // 10) Aplicar impulso en shootDir:
    var impulseVec = shootDir.scale(this.forceAmount);
    ball.rigidbody.applyImpulse(impulseVec);
};
