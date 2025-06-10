var Teleporter = pc.createScript('teleporter');

Teleporter.attributes.add('target', {
    type: 'entity',
    title: 'Target Entity',
    description: 'The target entity where we are going to teleport'
});

Teleporter.attributes.add('entityToTeleport', {
    type: 'entity',
    title: 'Entity to Teleport',
    description: 'Only this entity will be teleported when colliding'
});

// initialize code called once per entity
Teleporter.prototype.initialize = function() {
    const onTriggerEnter = (otherEntity) => {
        // Check if the entering entity is the specific one we want to teleport
        if (otherEntity === this.entityToTeleport) {
            // Teleport that entity to the target entity
            const targetPos = this.target.getPosition().clone();
            targetPos.y += 0.5;
            
            // Check if the entity has movement script or just set position directly
            if (otherEntity.script && otherEntity.script.movement) {
                otherEntity.script.movement.teleport(targetPos);
            } else {
                otherEntity.setPosition(targetPos);
            }
        }
    };

    // Subscribe to the triggerenter event
    this.entity.collision.on('triggerenter', onTriggerEnter);

    // Unsubscribe if the teleporter is destroyed
    this.on('destroy', () => {
        this.entity.collision.off('triggerenter', onTriggerEnter);
    });
};