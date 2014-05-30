'use strict';

var glm = require('gl-matrix');
var vec3 = glm.vec3;
var createBasicCamera = require('basic-camera');

module.exports = function(game, opts) {
  return new CameraPlugin(game, opts);
}
module.exports.pluginInfo = {
  //clientOnly: true // TODO: server-side support for storing camera location, without rendering?
};

function CameraPlugin(game, opts) {
  this.game = game;
  this.shell = game.shell;

  opts = opts || {};
  this.enableFlight = opts.enableFlight !== undefined ? opts.enableFlight : true;

  this.camera = createBasicCamera();
  this.camera.lookAt = function(eye, center, up) { console.log(eye, center, up); }; // TODO: add to basic-camera, as in orbit-camera (https://github.com/hughsk/basic-camera/issues/5)
  this.camera.position.set(opts.position || [0,0,0]);
  this.camera.rotationX = opts.rotationX || 0.0;
  this.camera.rotationY = opts.rotationY || 0.0;
  this.camera.rotationZ = opts.rotationZ || 0.0;

  this.max_dpitch = Math.PI / 2;
  this.max_dyaw = Math.PI / 2;
  this.scale = 0.0002;
  this.speed = 1.0;
  this.cameraVector = vec3.create();

  this.scratch0 = vec3.create();
  this.y_axis = vec3.fromValues(0, 1, 0);

  this.player = {
    position: {x:0, y:0, z:0},
    rotation: {x:0, y:0, z:0},
    translateX: function(dx) { this.position.x += dx; },
    translateY: function(dy) { this.position.y += dy; },
    translateZ: function(dz) { this.position.z += dz; },
  };

  this.enablePhysics = opts.enablePhysics !== undefined ? opts.enablePhysics : false;

  this.enable();
}


CameraPlugin.prototype.enable = function() {
  this.shell.bind('left', 'left', 'A');
  this.shell.bind('right', 'right', 'D');
  this.shell.bind('forward', 'up', 'W');
  this.shell.bind('backward', 'down', 'S');
  this.shell.bind('jump', 'space');
  this.shell.bind('crouch', 'shift');
  this.shell.on('tick', this.onTick = this.tick.bind(this));

  this.physics = this.game.makePhysical(this.player); // voxel-physical
  this.game.addItem(this.physics);
  this.physics.yaw = this.player;
  this.physics.pitch = this.player;//.head;
  this.physics.subjectTo(this.game.gravity);
  this.physics.blocksCreation = true;

  this.game.control(game.physics);
};

CameraPlugin.prototype.disable = function() {
  this.shell.removeListener('tick', this.onTick);
  this.shell.unbind('left');
  this.shell.unbind('right');
  this.shell.unbind('forward');
  this.shell.unbind('backward');
  this.shell.unbind('jump');
  this.shell.unbind('crouch');
};

CameraPlugin.prototype.view = function(out) {
  return this.camera.view(out);
};

CameraPlugin.prototype.getPosition = function(out) {
  // Negate since basic-camera consider -Y up (etc.), but we use +Y for up
  // and swap X,Z due to differing conventions
  out[0] = -this.camera.position[2];
  out[1] = -this.camera.position[1];
  out[2] = -this.camera.position[0];
};

CameraPlugin.prototype.tick = function() {
  if (this.enablePhysics) {
    // hook up voxel-physical to camera
    this.camera.position[0] = -this.player.position.x;
    this.camera.position[1] = -this.player.position.y;
    this.camera.position[2] = -this.player.position.z;
  }


  if (!this.shell.pointerLock) {
    return;
  }

  // TODO XXX: remove these direct controls, go through voxel-control (pipe interact events to its stream)

  // movement relative to camera
  this.camera.getCameraVector(this.cameraVector);
  if (this.shell.wasDown('forward')) {
    vec3.scaleAndAdd(this.camera.position, this.camera.position, this.cameraVector, this.speed);
  }
  if (this.shell.wasDown('backward')) {
    vec3.scaleAndAdd(this.camera.position, this.camera.position, this.cameraVector, -this.speed);
  }
  if (this.shell.wasDown('right')) {
    vec3.cross(this.scratch0, this.cameraVector, this.y_axis);
    vec3.scaleAndAdd(this.camera.position, this.camera.position, this.scratch0, this.speed);
  }
  if (this.shell.wasDown('left')) {
    vec3.cross(this.scratch0, this.cameraVector, this.y_axis);
    vec3.scaleAndAdd(this.camera.position, this.camera.position, this.scratch0, -this.speed);
  }

  // fly straight up or down
  if (this.enableFlight) {
    if (this.shell.wasDown('jump')) {
      this.camera.position[1] -= 1;
    }
    if (this.shell.wasDown('crouch')) {
      this.camera.position[1] += 1;
    }
  }


  // mouselook
  var dx = this.shell.mouseX - this.shell.prevMouseX;
  var dy = this.shell.mouseY - this.shell.prevMouseY;
  var dt = this.shell.frameTime;
  //console.log(dx,dy,dt);

  var dpitch = dy / dt * this.scale;
  var dyaw = dx / dt * this.scale;

  if (dpitch > this.max_dpitch) dpitch = this.max_dpitch;
  if (dpitch < -this.max_dpitch) dpitch = -this.max_dpitch;
  if (dyaw > this.max_dyaw) dyaw = this.max_dyaw;
  if (dyaw < -this.max_dyaw) dyaw = -this.max_dyaw;

  //console.log(dpitch,dyaw);

  this.camera.rotateX(dpitch);
  this.camera.rotateY(dyaw);
};

