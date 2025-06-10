var FollowCamera = pc.createScript('followCamera');

FollowCamera.attributes.add('target', {
    type: 'entity',
    title: 'Target',
    description: 'The Entity to follow'
});

FollowCamera.attributes.add('distance', {
    type: 'number',
    default: 4,
    title: 'Distance',
    description: 'How far from the Entity should the follower be'
});

// initialize code called once per entity
FollowCamera.prototype.initialize = function() {
    this.pos = new pc.Vec3();
    this.offset = new pc.Vec3();
};

// update code called every frame
FollowCamera.prototype.postUpdate = function(dt) {
    if (!this.target) return;

    // calculate the target position to where the camera is moving
    this.offset.set(0.75, 1, 0.75).scale(this.distance);
    this.pos.copy(this.target.getPosition()).add(this.offset);

    // smoothly interpolate towards the target position
    this.pos.lerp(this.entity.getPosition(), this.pos, 0.1);

    // update the camera position
    this.entity.setPosition(this.pos);
};
