var Movement = pc.createScript('movement');

Movement.attributes.add('speed', {
    type: 'number',
    default: 0.1,
    min: 0.05,
    max: 0.5,
    precision: 2,
    description: 'Controls the movement speed'
});

// Initialize code called once per entity
Movement.prototype.initialize = function() {
    this.force = new pc.Vec3();
    this.spawnPos = this.entity.getPosition().clone();
};

// Update code called every frame
Movement.prototype.update = function(dt) {
    // If the player falls off a platform, teleport to the last location.
    const pos = this.entity.getPosition();
    if (pos.y < -1) {
        this.teleport(this.spawnPos);
        return;
    }

    const keyboard = this.app.keyboard;
    let forceX = 0;
    let forceZ = 0;

    // Calculate force based on pressed keys
    if (keyboard.isPressed(pc.KEY_LEFT) || keyboard.isPressed(pc.KEY_A)) {
        forceX = -this.speed;
    }

    if (keyboard.isPressed(pc.KEY_RIGHT) || keyboard.isPressed(pc.KEY_D)) {
        forceX += this.speed;
    }

    if (keyboard.isPressed(pc.KEY_UP) || keyboard.isPressed(pc.KEY_W)) {
        forceZ = -this.speed;
    }

    if (keyboard.isPressed(pc.KEY_DOWN) || keyboard.isPressed(pc.KEY_S)) {
        forceZ += this.speed;
    }

    // Añadido por mi
    if (keyboard.wasPressed(pc.KEY_SPACE) || keyboard.wasPressed(pc.KEY_E)) {
        this.entity.rigidbody.applyForce(0,500,0);
    }

    this.force.set(forceX, 0, forceZ);

    // If we have some non-zero force
    if (this.force.lengthSq() > 0) {

        // Normalize the force vector
        this.force.normalize().scale(this.speed);

        // Apply rotation to the force vector
        //const angle = -Math.PI * 0.25;  // 45 degrees in radians
        //const rx = Math.cos(angle);
        //const rz = Math.sin(angle);
        //const forceX = this.force.x * rx - this.force.z * rz;
        //const forceZ = this.force.z * rx + this.force.x * rz;

        //this.force.set(forceX, 0, forceZ);
    }

    // Apply impulse to move the entity
    this.entity.rigidbody.applyImpulse(this.force);
};

Movement.prototype.teleport = function(pos) {
    // move ball to that point
    this.entity.rigidbody.teleport(pos);
    this.spawnPos.copy(pos);

    // need to reset angular and linear forces
    this.entity.rigidbody.linearVelocity = pc.Vec3.ZERO;
    this.entity.rigidbody.angularVelocity = pc.Vec3.ZERO;            
};
