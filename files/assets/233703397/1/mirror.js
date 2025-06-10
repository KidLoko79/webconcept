var Mirror = pc.createScript('mirror');

Mirror.attributes.add('primitive', { type: 'boolean' });
Mirror.attributes.add('density', { type: 'number' });
Mirror.attributes.add('onlyTag', { type: 'string' });

Mirror.attributes.add('shaderPS', { type: 'asset', assetType: 'shader' });

var world2reflMirror;
var tmpView = new pc.Mat4();
var tmpView2 = new pc.Mat4();
var tmpView3 = new pc.Mat4();
var planeQ = new pc.Vec4();
var planeV = new pc.Vec4();
var planePosV = new pc.Vec3();
var planeNormalV = new pc.Vec3();
var planePosWM, planeNormalWM;
var planeAV, planeBV, planeCV, planeDV;
var projInv = new pc.Mat4();
var pointsV = [new pc.Vec4(), new pc.Vec4(), new pc.Vec4(), new pc.Vec4()];
var prevGlobalMatrix = new pc.Mat4();
var tmpQuat = new pc.Quat();
var mirrorLookAt = new pc.Vec3();
var localPlayerPos = new pc.Vec3();
var afterTransitionPos = new pc.Vec3();
var reflectedCamPos = new pc.Vec3();
var reflectedCamDir = new pc.Vec3();
var invPortalPlane = new pc.Vec3();
var activeMirror = null;
var mirrorFrustum = new pc.Frustum();
var tempSphereMirror = {center:null, radius:0};

var mirrorBit = 0;
var atf = {};

var MAX3D_SCALE = 1;

var MIRRORSTATE_FAR = 0;
var MIRRORSTATE_NEAR = 1;
var MIRRORSTATE_TOUCH = 2;
var MIRRORSTATE_SWITCH = 3;
var MIRRORSTATE_POST = 4;
var MIRRORSTATE_OFF = 5;

var mirrorTransition = 0;
var mirrorDefaultFov = 0;

function reflectionMatrix(a,b,c,d) {
    var m = new pc.Mat4();
    
    m.data[0] = 1.0 - 2*a*a;
    m.data[1] = -2*a*b;
    m.data[2] = -2*a*c;
    m.data[3] = -2*a*d;
    
    m.data[4] = -2*a*b;
    m.data[5] = 1.0 - 2*b*b;
    m.data[6] = -2*b*c;
    m.data[7] = -2*b*d;
    
    m.data[8] = -2*a*c;
    m.data[9] = -2*b*c;
    m.data[10] = 1.0 - 2*c*c;
    m.data[11] = -2*c*d;
    
    m.data[12] = 0;
    m.data[13] = 0;
    m.data[14] = 0;
    m.data[15] = 1;
    
    m.transpose();

    return m;
}

function customTransformFuncMirror(mat, mode) {
    var pos = this.node.getPosition();
    var rot = this.node.getRotation();
    mat.setTRS(pos, rot, pc.Vec3.ONE);
    mat.mul2(world2reflMirror, mat);
}

function customProjFuncMirror(mat, mode) {
    if (this.projection === pc.PROJECTION_PERSPECTIVE) {
        mat.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip, this.horizontalFov);
    } else {
        // var y = this.orthoHeight;
        var y  = 0;
        var x = y * this.aspectRatio;
        mat.setOrtho(-x, x, -y, y, this.nearClip, this.farClip);
    }
    
    // Transform world space plane to view space
    var pos = this.node.getPosition();
    var rot = this.node.getRotation();
    tmpView.setTRS(pos, rot, pc.Vec3.ONE).invert();
    tmpView.transformPoint(planePosWM, planePosV);
    tmpView.transformVector(planeNormalWM, planeNormalV).normalize();
    planeAV = planeNormalV.x;
    planeBV = planeNormalV.y;
    planeCV = planeNormalV.z;
    planeDV = -planePosV.dot(planeNormalV);
    planeV.set(planeAV, planeBV, planeCV, planeDV);
    
    // Apply oblique transform
    projInv.copy(mat).invert();
    planeQ.set(sgn(planeAV), sgn(planeBV), 1.0, 1.0);
    projInv.transformVec4(planeQ, planeQ);
    planeV.scale( 2.0 / planeV.dot(planeQ) );    
    // third row = clip plane - fourth row
    var projection = mat.data;
    projection[2] = planeV.x - projection[3];
    projection[6] = planeV.y - projection[7];
    projection[10] = planeV.z - projection[11];
    projection[14] = planeV.w - projection[15];

    //this._projMatDirty = true;
    
    //return this._projMat;
}

function sgn(a) {
    if (a > 0.0) return 1.0;
    if (a < 0.0) return -1.0;
    return 0.0;
}

Mirror.prototype.isVisible = function (camera) {
    var frustum = camera.frustum;
    var bp = this.pointsW;
    var outside, plane, point;

    var projMat = camera.projectionMatrix;
    frustum.setFromMat4(projMat);
    
    for(plane=0; plane<6; plane++) {
        outside = (frustum.planes[plane][0] * bp[0].x +
                 frustum.planes[plane][1] * bp[0].y +
                 frustum.planes[plane][2] * bp[0].z +
                 frustum.planes[plane][3] <= 0);
        //console.log(plane+" "+outside);
        if (outside) {
            for(point=1; point<4; point++) {
                if (frustum.planes[plane][0] * bp[point].x +
                     frustum.planes[plane][1] * bp[point].y +
                     frustum.planes[plane][2] * bp[point].z +
                     frustum.planes[plane][3] > 0) {
                        outside = false;
                        break;
                }
            }
        }
        if (outside) return false;
    }

    return true;
};

// initialize code called once per entity
Mirror.prototype.initialize = function() {
    var app = this.app;
    var device = app.graphicsDevice;
    var chunks = pc.shaderChunks;

    this.cam = app.root.findByName("Camera").camera;
    
    var planeAW, planeBW, planeCW, planeDW;
    
    this.nearDist = 3.0;
    
    var rt = atf.mirrorRt;
    if (!rt) {
        var material = this.entity.model.model.meshInstances[0].material;
        material.customFragmentShader = this.shaderPS.resource;
        material.blendType = pc.BLEND_NORMAL;
        material.update();
        pc.mirrorMaterial = material;
        
        pc.fallbackMirrorMaterial = material.clone();
        this.setSky( 2 ); // sky quality
        
        var texFormat = pc.PIXELFORMAT_R8_G8_B8_A8;
        if (device.webgl2 && device.extTextureFloatRenderable) {
            texFormat = pc.PIXELFORMAT_111110F;
        } else if (device.extTextureHalfFloatRenderable && device.extTextureHalfFloatLinear) {
            texFormat = pc.PIXELFORMAT_RGBA16F;
        }
        
        var tex = new pc.Texture(device, {
            width: device.width,
            height: device.height,
            format: texFormat,
            autoMipmap: false
        });
        tex.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        tex.magFilter = pc.FILTER_LINEAR;
        tex.minFilter = pc.FILTER_LINEAR;
        atf.mirrorRt = rt = new pc.RenderTarget({
            colorBuffer: tex,
            samples: 4,
            depth: true,
            stencil: true
        });
        device.scope.resolve("mirrorTex").setValue(tex);

    }
    this.rt = rt;
    
    this.entity.model.model.meshInstances[0].setParameter("mirrorDepthOffset", 0.0);
    this.entity.model.model.meshInstances[0].setParameter("mirrorDensity", this.density===0.0? 1.0 : this.density);
    
    var ENTITY = this.primitive? this.entity : this.entity.children[0].children[0];
    
    this.planePosW = ENTITY.getPosition();
    this.planeNormalW = ENTITY.forward;//.clone().scale(-1);
    this.planeRightW = ENTITY.right;
    this.planeNormalWOrig = this.planeNormalW.clone();
    planeAW = this.planeNormalW.x;
    planeBW = this.planeNormalW.y;
    planeCW = this.planeNormalW.z;
    planeDW = -this.planePosW.dot(this.planeNormalW);
    this.world2refl = reflectionMatrix(planeAW, planeBW, planeCW, planeDW);
    //planeDW = -0.1; // move clipplane up to prevent gaps
    this.planeDW = planeDW;
    
    this.maxXdiff = ENTITY.getLocalScale().x*0.5 * MAX3D_SCALE;
    
    var dips = app.scene.drawCalls;
    this.dipsReflect = []; // scene dips - off + on
    this.dipsReflect2 = []; // scene dips
    var i;
    var aabb;
    var me = this.entity.model.model.meshInstances[0].material;
    var offtag = this.entity.name+"_off";
    var offtag2 = "DontMirror";
    var onlyTag = this.onlyTag;
    var useOnlyTag = (onlyTag!==undefined && onlyTag!=="" && onlyTag!==null);
    
    for(i=0; i<dips.length; i++) {
        if (dips[i].node) {
            
            if (dips[i].material===me) continue;
            var parent = dips[i].node;
            var hastag = false;
            var hastag2 = false;
            var hastag3 = false;
            while(parent) {
                if (parent.tags && parent.tags.has(offtag)) {
                    hastag = true;
                    //break;
                }
                if (parent.tags && parent.tags.has(offtag2)) {
                    hastag2 = true;
                    //break;
                }
                if (useOnlyTag && parent.tags && parent.tags.has(onlyTag)) {
                    hastag3 = true;
                    //break;
                }
                // parent = parent.getParent();
                parent = parent.parent;
            }
            //if (hastag) {
              //  this.dipsOff.push(dips[i]);
                //continue;
            //}
            
            dips[i].node.getWorldTransform(); 
            aabb = dips[i].aabb;
            // if (aabbInFrontOfPlane(aabb, planeAW, planeBW, planeCW, -planeDW)) {
            
            if (useOnlyTag) {
                if (hastag3 || dips[i].command) {
                    this.dipsReflect.push(dips[i]);
                }
            } else {
                if (!hastag && !hastag2) this.dipsReflect.push(dips[i]);
                this.dipsReflect2.push(dips[i]);
            }
        } else {
            //console.log(dips[i]);
        }
    }
    
    /*var dynSky = this.app.scene.dynSkybox;
    if (dynSky) {
        this.dipsReflect.push(dynSky.model.meshInstances[0]);
    }*/
    
    var self = this;
    
    var addAsyncEntity = function(entity) {
        var id = entity.model.asset;
        if (! id) return;

        var asset = app.assets.get(id);
        if (! asset) return;
        
        asset.once('load', function() {
            meshes = entity.model.model.meshInstances;
            for(j=0; j<meshes.length; j++) {
                self.dipsReflect.push(meshes[j]);
                self.dipsReflect2.push(meshes[j]);
            }
        });
        
        app.assets.load(asset);
    };
    
    //var tagged = app.root.findByTag("ReflectInMirrors");
    var tagged = app.root.findByTag("MirrorOnly");
    var j;
    var meshes;
    for(i=0; i<tagged.length; i++) {
        if (!tagged[i].enabled) continue;
        
        if (tagged[i].model.model) {
            meshes = tagged[i].model.model.meshInstances;
            for(j=0; j<meshes.length; j++) {
                this.dipsReflect.push(meshes[j]);
                this.dipsReflect2.push(meshes[j]);
            }
        } else {
            addAsyncEntity(tagged[i]);
        }
    }
    tagged = app.root.findByTag(this.entity.name+"_on");
    for(i=0; i<tagged.length; i++) {
        if (!tagged[i].enabled) continue;
        meshes = tagged[i].model.model.meshInstances;
        for(j=0; j<meshes.length; j++) {
            this.dipsReflect.push(meshes[j]);
        }
    }
    this.objectsOn = tagged;
    this.objectsOff = app.root.findByTag(offtag);
       
    this.init = false;
    
    if (!pc.mirrorCount) {
        pc.mirrorCount = 0;
        pc.mirrorsToRender = 0;
        pc.mirrorList = [];
        pc.dipsMirror = [];
        pc.distortionNearFade = 1;
        pc.isMirrorClose = false;
        pc.mirrorsDrawn = 0;
        this.first = true;
    } else {
        this.first = false;
    }
    pc.mirrorCount++;
    pc.mirrorList.push(this);
    
    var instance = this.entity.model.model.meshInstances[0];
    var markerMat = new pc.BasicMaterial();// instance.material.clone();
    markerMat.redWrite = false;
    markerMat.greenWrite = false;
    markerMat.blueWrite = false;
    markerMat.alphaWrite = false;
    markerMat.depthWrite = false;
    markerMat.depthTest = false;
    //markerMat.blendType = pc.BLEND_NONE;
    markerMat.stencilBack = markerMat.stencilFront = new pc.StencilParameters({
        zpass: pc.STENCILOP_REPLACE,
        ref: pc.mirrorCount
    });
    var marker = new pc.MeshInstance(instance.node, instance.mesh, markerMat);
    //this.dipsMirror = [marker];
    pc.dipsMirror.push(marker);
    this.bit = pc.mirrorCount;
    
    this.srect = {x:0, y:0, width:1, height:1};
    this.pointsW = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
    var halfExtents = ENTITY.getLocalScale();
    var right = ENTITY.right;
    var up = ENTITY.up;
    var tmp = new pc.Vec3();

    // tr
    this.pointsW[0].copy(right).scale(halfExtents.x * 0.5 * MAX3D_SCALE);
    tmp.copy(up).scale(halfExtents.y * 0.5 * MAX3D_SCALE);
    this.pointsW[0].add(tmp).add(this.planePosW);
    
    // bl
    this.pointsW[1].copy(right).scale(halfExtents.x * -0.5 * MAX3D_SCALE);
    tmp.copy(up).scale(halfExtents.y * -0.5 * MAX3D_SCALE);
    this.pointsW[1].add(tmp).add(this.planePosW);
    
    // tl
    this.pointsW[2].copy(right).scale(halfExtents.x * -0.5 * MAX3D_SCALE);
    tmp.copy(up).scale(halfExtents.y * 0.5 * MAX3D_SCALE);
    this.pointsW[2].add(tmp).add(this.planePosW);
    
    // br
    this.pointsW[3].copy(up).scale(halfExtents.y * -0.5 * MAX3D_SCALE);
    tmp.copy(right).scale(halfExtents.x * 0.5 * MAX3D_SCALE);
    this.pointsW[3].add(tmp).add(this.planePosW);
    
    this.pointsW4 = [new pc.Vec4(), new pc.Vec4(), new pc.Vec4(), new pc.Vec4()];
    for(i=0; i<4; i++) {
        this.pointsW4[i].x = this.pointsW[i].x;
        this.pointsW4[i].y = this.pointsW[i].y;
        this.pointsW4[i].z = this.pointsW[i].z;
        this.pointsW4[i].w = 1.0;
    }

    this.clear = {
            //depth: 1.0,
            flags: 0//pc.CLEARFLAG_DEPTH
    };
    
    this.clearFirst = {
            color: [1, 0, 0, 1],
            depth: 1.0,
            stencil: 0,
            flags: pc.CLEARFLAG_DEPTH | pc.CLEARFLAG_STENCIL// | pc.CLEARFLAG_COLOR;
    };
  
    this.state = MIRRORSTATE_FAR;
    this.constDist = device.scope.resolve("distortionNearFade");
    this.constTrans = device.scope.resolve("mirrorTransition");
    
    var bmin = instance.aabb.getMin();
    var bmax = instance._aabb.getMax();
    var bp = [new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3(), new pc.Vec3()];
    bp[0].set(bmin.x, bmin.y, bmin.z);
    bp[1].set(bmax.x, bmin.y, bmin.z);
    bp[2].set(bmax.x, bmax.y, bmin.z);
    bp[3].set(bmin.x, bmax.y, bmin.z);

    bp[4].set(bmin.x, bmin.y, bmax.z);
    bp[5].set(bmax.x, bmin.y, bmax.z);
    bp[6].set(bmax.x, bmax.y, bmax.z);
    bp[7].set(bmin.x, bmax.y, bmax.z);
    this.bp = bp;
    
    this.mConst = this.app.graphicsDevice.scope.resolve("world2refl");
    
    //this.entity.setLocalScale(10,10,10);
    
    
    var cam = this.cam;
    var comp = this.app.scene.layers;
    var reflectionLayer = comp.getLayerByName("Mirror");
    var mirrorLayers = [reflectionLayer];
    
    var preFunction = function() {
        // Apply reflected camera transformation before rendering
        planePosWM = self.planePosW;
        planeNormalWM = self.planeNormalW;
        world2reflMirror = self.world2refl;
        cam.calculateTransform = customTransformFuncMirror;
        cam.calculateProjection = customProjFuncMirror;
        cam.flipFaces = true;
        self.app.renderer.updateCameraFrustum(cam.camera);
    };

    var postFunction = function() {
        // Revert reflected camera transformation
        cam.calculateTransform = null;
        cam.calculateProjection = null;
        cam.flipFaces = false;
        self.app.renderer.updateCameraFrustum(cam.camera);
    };
    
    for(i=0; i<mirrorLayers.length; i++) {
        mirrorLayers[i].renderTarget = this.rt;
        mirrorLayers[i].onPreCull = mirrorLayers[i].onPreRender = preFunction;
        mirrorLayers[i].onPostCull = mirrorLayers[i].onPostRender = postFunction;
        mirrorLayers[i].enabled = true;
    }
    this.mirrorLayers = mirrorLayers;
    
    // reflectionLayer.addMeshInstances(self.app.scene.skyboxModel.meshInstances);
    
    this.app.scene.on("set:skybox", function() {
        reflectionLayer.addMeshInstances(self.app.scene.skyboxModel.meshInstances);
    });
    this.wasVisible = true;
    
    this.app.graphicsDevice.on('resizecanvas', function() {
        atf = {};
        this._init = false;
    }, this); 
};

// update code called every frame
Mirror.prototype.update = function(dt) {
    
    if (!this._init) {
        this._init = 1;
        return;
    } else if (this._init===1) {
        this.initialize();
        this._init = 2;
    }
    
    var visible = this.isVisible(this.cam);
    if (visible !== this.wasVisible) {
        for(var i=0; i<this.mirrorLayers.length; i++) {
            this.mirrorLayers[i].enabled = visible;
        }
        this.wasVisible = visible;
    }
};

Mirror.prototype.setSky = function(val) {
    this.skyIsOn = val;
    if (pc.fallbackMirrorMaterial) {
        pc.fallbackMirrorMaterial.customFragmentShader = 
            (val? "#define SKY\n" : "") + 
            "#define SIMPLE\n" + pc.shaderChunks.rgbmPS + this.shaderPS.resource;
        pc.fallbackMirrorMaterial.update();
    }
};
