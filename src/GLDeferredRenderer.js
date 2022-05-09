/*
 * File: GLDeferredRenderer.js
 * Author: Nathan Hunter
 * Date: May 9, 2022
 *
 * Purpose: A deferred renderer along with supporting components
 *          for meshes, materials, lighting, camera, and shaders.
 *          
 *          Displays the GBuffer contents (toggle) to show
 *          scene composition.  GBuffer is composed of
 *          albedo, normal, material, and position fragment data.
 *          
 *          Final render binds the GBuffer for reading and 
 *          uses lighting information while the shader program in 
 *          'deferred.js' is used for the final render
 *          
 *          Uses PBR-Metallic workflow.  Material texture combines
 *          metallic, roughness, and AO into the RGB channels.
 */

const { mat4, mat3, vec2, vec3, vec4, quat } = glMatrix;
const M_RAD = (Math.PI / 180.0);
const repeat = (a, n) => Array(n).fill(a).flat(1);
const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

let canvas = null;
let GL = null;

class Renderer {

    constructor() {

        this.init = false;

        // Setup WebGL
        canvas = document.createElement('canvas');
        document.body.appendChild(canvas);

        try {

            GL = canvas.getContext('webgl2');
            console.log(GL.getParameter(GL.SHADING_LANGUAGE_VERSION))
            GL.getExtension('EXT_color_buffer_float');
            this.onWindowResize();
            GL.pixelStorei(GL.UNPACK_FLIP_Y_WEBGL, true);

        } catch (e) {
            alert('WebGL not available');
        }

        // Inits
        this.attributes = {
            drawGbuffer: true,
            lightAmbience: 0.5,
            lightIntensity: 0.8,

        };
        this.textures = {};
        this.materials = {};
        this.scene = new Scene();
        this.init_shaders();
        this.init_gBuffer();
        this.init_Cameras();

        // Quads for drawing final render and GBuffer attachments
        var quad = new Quad();
        this.bufferQuad = new MeshInstance(quad, this.shaders.passthrough, this.materials.gBuffer);
        this.defferedQuad = new MeshInstance(quad, this.shaders.deferred, this.materials.gBuffer);

        // Handle resizing of window
        window.addEventListener('resize', () => {
            this.onWindowResize();
            this.camera.onWindowResize();
            this.postCamera.onWindowResize();
        }, false);

        this.init = true;
    }

    init_shaders() {

        this.shaders = {
            default: new GLShader(default_shader.vertex, default_shader.fragment),
            passthrough: new GLShader(passthrough_shader.vertex, passthrough_shader.fragment),
            gBuffer: new GLShader(gbuffer_shader.vertex, gbuffer_shader.fragment),
            deferred: new GLShader(deferred_shader.vertex, deferred_shader.fragment),
        }

        this.shaders.deferred.addUniform('lights');

    }

    init_gBuffer() {

        // Texture buffers
        var w = window.innerWidth, h = window.innerHeight;
        var tex = this.textures;
        tex['gbuff_position'] = new Texture('buffer', w, h);
        tex['gbuff_albedo'] = new Texture('buffer', w, h);
        tex['gbuff_normal'] = new Texture('buffer', w, h);
        tex['gbuff_material'] = new Texture('buffer', w, h);

        // Uses a material just to group the buffers if needed later
        var gMat = new Material(tex.gbuff_albedo, tex.gbuff_normal, tex.gbuff_material);
        gMat.addTexture(tex.gbuff_position, 'base');
        gMat.addTexture(tex.gbuff_position, 'position');
        this.materials['gBuffer'] = gMat;

        // Depth
        var _depth = GL.createRenderbuffer();
        GL.bindRenderbuffer(GL.RENDERBUFFER, _depth);
        GL.renderbufferStorage(GL.RENDERBUFFER, GL.DEPTH_COMPONENT24, window.innerWidth, window.innerHeight);
        GL.bindRenderbuffer(GL.RENDERBUFFER, null);

        // Framebuffer
        var tex = gMat.textures;
        var _FBO = GL.createFramebuffer();
        GL.bindFramebuffer(GL.FRAMEBUFFER, _FBO);
        GL.framebufferRenderbuffer(GL.FRAMEBUFFER, GL.DEPTH_ATTACHMENT, GL.RENDERBUFFER, _depth);
        GL.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT0, GL.TEXTURE_2D, tex.base.index, 0);
        GL.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT1, GL.TEXTURE_2D, tex.albedo.index, 0);
        GL.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT2, GL.TEXTURE_2D, tex.normal.index, 0);
        GL.framebufferTexture2D(GL.DRAW_FRAMEBUFFER, GL.COLOR_ATTACHMENT3, GL.TEXTURE_2D, tex.material.index, 0);

        this.gBuffer = {

            FBO: _FBO,
            material: gMat,
            depth: _depth,
            buffers: [GL.COLOR_ATTACHMENT0, GL.COLOR_ATTACHMENT1, GL.COLOR_ATTACHMENT2, GL.COLOR_ATTACHMENT3],

            bind: function () {

                GL.bindFramebuffer(GL.FRAMEBUFFER, this.FBO);
                GL.drawBuffers(this.buffers);

            }

        }

        GL.bindFramebuffer(GL.FRAMEBUFFER, null);

    }

    init_Cameras() {

        // Default camera is perspective
        this.camera = new PerspectiveCamera(60, 0.1, 16000);
        this.camera.setPosition(0, 0, 0);
        this.camera.update(this.attributes);

        // Used for rendering quads and the fullscreen deferred scene
        this.postCamera = new OrthographicCamera(window.innerWidth, window.innerHeight);
    }

    createMaterial(albedo, normal, material, name) {

        // Useful to always store the textures when creating a material for possible reuse
        var atex = new Texture(albedo), ntex = new Texture(normal), mtex = new Texture(material);
        var mat = new Material(atex, ntex, mtex);

        this.textures[albedo] = atex;
        this.textures[normal] = ntex;
        this.textures[material] = mtex;
        this.materials[name] = mat;

        return mat;
    }

    onWindowResize() {

        // Resize the canvas and viewport
        var w = window.innerWidth, h = window.innerHeight;
        canvas.width = w;
        canvas.height = h;
        GL.viewport(0, 0, w, h);

        if (!this.init) return;

        // Resize the GBuffer 
        var tex = this.gBuffer.material.textures;
        GL.bindRenderbuffer(GL.RENDERBUFFER, this.gBuffer.depth);
        GL.renderbufferStorage(GL.RENDERBUFFER, GL.DEPTH_COMPONENT24, w, h);
        GL.bindRenderbuffer(GL.RENDERBUFFER, null);

        for (const t in tex) {
            GL.bindTexture(GL.TEXTURE_2D, tex[t].index);
            GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, w, h, 0, GL.RGBA, GL.FLOAT, null);
        }

        GL.bindTexture(GL.TEXTURE_2D, null);

    }

    renderScene(delta) {

        const att = this.attributes;
        const tex = this.materials.gBuffer.textures;

        // Setup gbuffer 
        this.gBuffer.bind();
        GL.clearColor(0.0, 0.0, 0.0, 1.0);
        GL.enable(GL.DEPTH_TEST);
        GL.enable(GL.CULL_FACE);
        GL.cullFace(GL.BACK);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
        this.camera.update(att);

        // Render to gbuffer
        const meshes = this.scene.meshes;
        for (let m in meshes) {
            const mesh = meshes[m];
            if (!mesh.visible) continue;
            mesh.bind(att);
            mesh.draw();
        }

        // Setup default FBO
        GL.bindFramebuffer(GL.FRAMEBUFFER, null);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
        GL.disable(GL.DEPTH_TEST);
        GL.disable(GL.CULL_FACE);

        // Orthographic camera for 2D rendering
        this.postCamera.update(att);
        att['cameraPosition'] = this.camera.position;
        var winW = window.innerWidth, winH = window.innerHeight;

        // Create light array for uniform
        const lights = this.scene.lights;
        var count = 0;
        var lightArr = [0, Math.pow(att.lightAmbience * 0.1 * 4, 2), (1 - att.lightIntensity) * 0.1 + 0.001];
        for (let l in lights) count += lights[l].addToArray(lightArr);
        lightArr[0] = count * 3;

        // Finale scene render
        this.defferedQuad.setScale(winW, winH, 1);
        this.defferedQuad.setPosition(0, 0, 0);
        this.defferedQuad.bind(att);
        this.shaders.deferred.setUniformFloat3(lightArr, 'lights');
        this.defferedQuad.draw();

        // Show gbuffer components
        if (att.drawGbuffer) {

            var height = winH / 4, width = height * (winW / winH),
                dx = (winW / -2) + width / 2, dy = (winH / 2) - height / 2;

            var q = this.bufferQuad;
            q.setScale(width, height, 1);

            for (const t in tex) {
                if (t == 'base') continue;
                q.setBaseTexture(tex[t]);
                q.setPosition(dx, dy, 0);
                q.bind(att);
                q.draw();
                dy -= height;
            }

        }

    }

}

class Scene {

    // A storage container for meshes and lights

    constructor() {
        this.meshes = [];
        this.lights = [];
    }

    addLight(color) {
        var light = new Light(color);
        this.lights.push(light);
        return light;
    }

    addMesh(geometry, shader, material, name) {
        var mesh = new MeshInstance(geometry, shader, material, name)
        this.meshes.push(mesh);
        return mesh;
    }

}

class Material {

    // Composition of textures and assigned shader

    constructor(albedoTex, normalTex, materialTex) {

        this.textures = {
            albedo: albedoTex,
            normal: normalTex,
            material: materialTex,
        }

    }

    addTexture(tex, name) {
        this.textures[name] = tex;
    }

    bind(shader) {

        var position = 0;
        for (const t in this.textures) {
            var tex = this.textures[t];
            tex.bind(position);
            GL.uniform1i(shader.uniforms[t], position);
            position++;
        }

    }

}

class Texture {

    constructor(source, width, height) {

        this.name = source;
        this.index = GL.createTexture();
        GL.bindTexture(GL.TEXTURE_2D, this.index);


        // Boilerplate code for making either a normal texture or FBO attachement
        if (source == 'buffer') {
            GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA32F, width, height, 0, GL.RGBA, GL.FLOAT, null);
            GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.NEAREST);
            GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.NEAREST);
            GL.bindTexture(GL.TEXTURE_2D, null);
        }
        else {
            GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, 1, 1, 0, GL.RGBA, GL.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
            const img = new Image();
            img.src = source;
            img.onload = () => {
                GL.bindTexture(GL.TEXTURE_2D, this.index);
                GL.texImage2D(GL.TEXTURE_2D, 0, GL.RGBA, GL.RGBA, GL.UNSIGNED_BYTE, img);
                GL.generateMipmap(GL.TEXTURE_2D);
                GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MIN_FILTER, GL.LINEAR_MIPMAP_LINEAR);
                GL.texParameteri(GL.TEXTURE_2D, GL.TEXTURE_MAG_FILTER, GL.LINEAR);
                GL.bindTexture(GL.TEXTURE_2D, null);
            };
        }

    }

    bind(position) {

        GL.activeTexture(GL.TEXTURE0 + position);
        GL.bindTexture(GL.TEXTURE_2D, this.index);

    }

}

class Mesh {

    // Store vertex buffers of geometric data

    constructor() {
        this.buffers = {};
    }

    addBuffer(vertices, name, size) {

        var buff = GL.createBuffer();

        // Check if this buffer uses draw elements or array
        if (name == 'index') {
            GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, buff);
            GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertices), GL.STATIC_DRAW);
        } else {
            GL.bindBuffer(GL.ARRAY_BUFFER, buff);
            GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(vertices), GL.STATIC_DRAW);
        }

        buff.itemSize = size;
        buff.numItems = vertices.length / size;
        this.buffers[name] = buff;

    }

    draw() {
        GL.drawArrays(GL.TRIANGLES, 0, this.buffers.position.numItems);
    }

}

class Quad extends Mesh {

    // Useful for drawing fullscreen image or the Gbuffer contents

    constructor() {

        super();

        this.addBuffer(
            [
                -0.5, -0.5, 1.0,
                0.5, -0.5, 1.0,
                0.5, 0.5, 1.0,
                -0.5, 0.5, 1.0,
            ], 'position', 3);

        this.addBuffer(
            [
                0.0, 0.0,
                1.0, 0.0,
                1.0, 1.0,
                0.0, 1.0,
            ], 'uv', 2);

        this.addBuffer(
            [
                0, 1, 2,
                0, 2, 3,
            ], 'index', 1);

    }

    draw() {
        GL.drawElements(GL.TRIANGLES, this.buffers.index.numItems, GL.UNSIGNED_SHORT, 0);
    }

}

class MeshInstance {

    // Composition of mesh, shader, and material for rendering
    // Reusing the same mesh when possible saves on resources

    constructor(mesh, shader, material, name) {

        this.mesh = mesh;
        this.material = material;
        this.shader = shader;
        this.position = vec3.create();
        this.scale = vec3.fromValues(1, 1, 1);
        this.rotation = quat.create();
        this.visible = true;
        this.name = name;

    }

    setBaseTexture(tex) {
        this.material.textures.base = tex;
    }

    setPosition(x, y, z) {
        vec3.set(this.position, x, y, z);
    }

    translate(x, y, z) {
        this.position[0] += x;
        this.position[1] += y;
        this.position[2] += z;
    }

    translateX(x) {
        this.position[0] += x;
    }

    translateY(y) {
        this.position[1] += y;
    }

    translateX(z) {
        this.position[2] += z;
    }

    rotateX(rad) {
        quat.rotateX(this.rotation, this.rotation, rad);
    }

    rotateY(rad) {
        quat.rotateY(this.rotation, this.rotation, rad);
    }

    rotateZ(rad) {
        quat.rotateZ(this.rotation, this.rotation, rad);
    }

    setScale(x, y, z) {
        vec3.set(this.scale, x, y, z);
    }

    bind(attributes) {

        // Calculate transform matrices
        const modelMatrix = mat4.create();
        mat4.fromRotationTranslationScale(modelMatrix, this.rotation, this.position, this.scale);
        const viewMatrix = attributes.viewMatrix;
        const modelViewMatrix = mat4.create();
        mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);

        // Set shader and uniforms
        this.shader.bind(this.mesh.buffers);
        this.shader.setMatrices(attributes.projectionMatrix, modelMatrix, modelViewMatrix);
        this.shader.setUniformFloat3(attributes.cameraPosition, 'cameraPosition');
        this.material.bind(this.shader);

    }

    draw() {
        this.mesh.draw();
    }

}

class Light {

    // Simple point light

    constructor(color) {
        this.color = color;
        this.position = [0.0, 0.0, 0.0];
        this.attenuation = [0.05, 0.02, 0.01];
        this.visible = true;
    }

    setColor(color) {
        this.color = color;
    }

    setPosition(x, y, z) {
        this.position = [x, y, z];
    }

    setAttenuation(constant, linear, quadratic) {
        this.attenuation = [constant, linear, quadratic];
    }

    addToArray(arr) {

        // Places its attributes sequentially into a flattened array

        if (this.visible) {
            arr.push(...this.position, ...this.color, ...this.attenuation);
            return 1;
        }

        return 0;
    }

}

class GLShader {

    constructor(vertSource, fragSource) {
        this.init(vertSource, fragSource);
    }

    init(vertSource, fragSource) {

        // Compile shaders
        const vertShader = this.load(vertSource, GL.VERTEX_SHADER);
        const fragShader = this.load(fragSource, GL.FRAGMENT_SHADER);

        this.program = GL.createProgram();
        GL.attachShader(this.program, vertShader);
        GL.attachShader(this.program, fragShader);
        GL.linkProgram(this.program);

        if (!GL.getProgramParameter(this.program, GL.LINK_STATUS)) {
            console.log("Failed to compile shader");
        }

        // Try to get some common attribute and uniforms, not found = -1

        this.locations = {

            position: GL.getAttribLocation(this.program, 'aPosition'),
            normal: GL.getAttribLocation(this.program, 'aNormal'),
            tangent: GL.getAttribLocation(this.program, 'aTangent'),
            uv: GL.getAttribLocation(this.program, 'aUV'),
            colour: GL.getAttribLocation(this.program, 'aColour'),

        }

        this.uniforms = {

            projectionMatrix: GL.getUniformLocation(this.program, 'projection'),
            modelMatrix: GL.getUniformLocation(this.program, 'model'),
            modelViewMatrix: GL.getUniformLocation(this.program, 'modelView'),
            cameraPosition: GL.getUniformLocation(this.program, 'cameraPosition'),
            albedo: GL.getUniformLocation(this.program, 'albedoTexture'),
            normal: GL.getUniformLocation(this.program, 'normalTexture'),
            material: GL.getUniformLocation(this.program, 'materialTexture'),
            base: GL.getUniformLocation(this.program, 'baseTexture'),
            position: GL.getUniformLocation(this.program, 'positionTexture'),

        }

    }

    load(source, type) {
        
        // Compiles a shader
        const shader = GL.createShader(type);
        GL.shaderSource(shader, source);
        GL.compileShader(shader);

        if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
            console.log(GL.getShaderInfoLog(shader));
            GL.deleteShader(shader);
            return null;
        }

        return shader;
    }

    addUniform(name) {
        // Add other uniforms not define in defaults above
        this.uniforms[name] = GL.getUniformLocation(this.program, name);
    }

    setMatrices(projection, model, modelView) {
        // Prior to draw call
        GL.uniformMatrix4fv(this.uniforms.projectionMatrix, false, projection);
        GL.uniformMatrix4fv(this.uniforms.modelMatrix, false, model);
        GL.uniformMatrix4fv(this.uniforms.modelViewMatrix, false, modelView);
    }

    setUniformFloat3(value, name) {
        GL.uniform3fv(this.uniforms[name], value);
    }

    setUniformFloat4(value, name) {
        GL.uniform4fv(this.uniforms[name], value);
    }

    setAttribPosition(buffer) {
        GL.vertexAttribPointer(this.attribs.position, buffer.itemSize, GL.FLOAT, false, 0, 0);
        GL.vertexAttribPointer(this.attribs.uv, buffer.itemSize, GL.FLOAT, false, 0, 0);
    }

    bind(buffers) {

        // Bind buffers and set uniforms before the calling instance uses draw call
        for (const b in buffers) {

            if (b == 'index') {
                GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, buffers[b]);
                continue;
            }

            var loc = this.locations[b];
            if (loc == -1) continue;

            var buff = buffers[b];

            GL.bindBuffer(GL.ARRAY_BUFFER, buff);
            GL.vertexAttribPointer(loc, buff.itemSize, GL.FLOAT, false, 0, 0);
            GL.enableVertexAttribArray(loc);

        }

        GL.useProgram(this.program);

    }

}

class Camera {

    // Abstract camera class which perspective and orthographic use

    constructor() {

        this.position = vec3.create();
        this.lookAt = vec3.create();
        this.viewMatrix = mat4.create();
        this.cameraMatrix = mat4.create();
        this.projectionMatrix = mat4.create();

    }

    setPosition(x, y, z) {
        vec3.set(this.position, x, y, z);
    }

    setLookAt(x, y, z) {
        vec3.set(this.lookAt, x, y, z);
    }

    update(attributes) {

        mat4.lookAt(this.viewMatrix, this.position, this.lookAt, vec3.fromValues(0, 1, 0));
        mat4.invert(this.cameraMatrix, this.viewMatrix);

        attributes['projectionMatrix'] = this.projectionMatrix;
        attributes['viewMatrix'] = this.viewMatrix;
        attributes['cameraMatrix'] = this.cameraMatrix;
        attributes['cameraPosition'] = this.position;

    }

}

class PerspectiveCamera extends Camera {

    // Typical perspective camera with optional orbit controller

    constructor(fov, zNear, zFar) {

        super();
        this.aspect = window.innerWidth / window.innerHeight;
        this.setPerspective(fov, zNear, zFar)

    }

    addOrbitController(canvas, boomLength) {

        this.orbit = new OrbitController(canvas, boomLength);
        this.update = function (attributes) {

            this.viewMatrix = this.orbit.getViewMatrix();
            mat4.invert(this.cameraMatrix, this.viewMatrix);
            vec3.set(this.position, this.cameraMatrix[12], this.cameraMatrix[13], this.cameraMatrix[14]);

            attributes['projectionMatrix'] = this.projectionMatrix;
            attributes['viewMatrix'] = this.viewMatrix;
            attributes['cameraMatrix'] = this.cameraMatrix;
            attributes['cameraPosition'] = this.position;

        }

    }

    setPerspective(fov, zNear, zFar) {

        this.fov = fov;
        this.zNear = zNear;
        this.zFar = zFar;
        mat4.perspective(this.projectionMatrix, fov * M_RAD, this.aspect, zNear, zFar);

    }

    onWindowResize() {
        this.aspect = window.innerWidth / window.innerHeight;
        mat4.perspective(this.projectionMatrix, this.fov * M_RAD, this.aspect, this.zNear, this.zFar);
    }

    getUpVector() {

        const up = vec4.fromValues(0, 0, 1, 0);
        vec4.transformMat4(up, up, this.cameraMatrix);
        return up;
    }

    getRightVector() {

        const right = vec4.fromValues(1, 0, 0, 0);
        vec4.transformMat4(right, right, this.cameraMatrix);
        return right;

    }

}

class OrthographicCamera extends Camera {

    // Basic orthographic camera, useful for 2D rendering

    constructor(width, height) {

        super();
        this.position[2] = 100;
        this.setOrthographic(width, height);

    }

    setOrthographic(width, height) {

        this.width = width;
        this.height = height;

        var winW = window.innerWidth, winH = window.innerHeight, aspect = 1;

        if (winW > winH) {
            aspect = winH / winW;
            height = width * aspect;
        } else {
            aspect = winW / winH;
            width = height * aspect;
        }

        width *= 0.5;
        height *= 0.5;

        this.left = -width;
        this.right = width;
        this.bottom = -height;
        this.top = height;

    }

    setPosition(x, y, z) {
        vec3.set(this.position, x, y, 100);
        this.setLookAt(x, y, 0);
    }

    onWindowResize() {
        this.setOrthographic(window.innerWidth, window.innerHeight);
    }

    update(attributes) {
        var pos = this.position;
        mat4.ortho(this.projectionMatrix,
            pos[0] + this.left,
            pos[0] + this.right,
            pos[1] + this.bottom,
            pos[1] + this.top,
            0.1, 16000
        );
        super.update(attributes);

    }

}

class OrbitController {

    // Sets up mouse/touch listeners to orbit a camera position around the origin

    constructor(canvas, boomLength) {

        canvas.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        canvas.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        canvas.onwheel = this.handleZoom.bind(this);

        this.canvas = canvas;
        this.pitch = 0;
        this.pitchRot = 0;
        this.pitchSpd = 0.2;
        this.pitchMax = 89;
        this.yaw = 0;
        this.yawRot = 0;
        this.yawSpd = 0.2;
        this.boomLength = boomLength;
        this.rotationCenter = [0, 0, 0];
        this.mouseHeld = false;
        this.touchStarted = false;

    }

    setPitchMax(limitInDegrees) {
        this.pitchMax = Math.min(89, Math.max(0, limitInDegrees));
    }

    setSpeed(pitchSpeed, yawSpeed) {
        this.pitchSpd = pitchSpeed;
        this.yawSpd = yawSpeed;
    }

    setRotationCenter(x, y, z) {
        this.rotationCenter = [x, y, z];
    }

    setRotations(pitch, yaw) {
        this.pitch = clamp(pitch, -this.pitch, this.pitch);
        this.yaw = yaw;
    }

    setBoomLength(boomLength) {
        this.boomLength = boomLength;
    }

    getViewMatrix() {

        // Rotate the camera point around the look at location
        // and compose a transform matrix to view from that resulting location
        var radX = this.pitch * M_RAD, radY = this.yaw * M_RAD,
            cosX = Math.cos(radX), sinX = Math.sin(radX),
            cosY = Math.cos(radY), sinY = Math.sin(radY);

        var view = [cosY, sinX * sinY, -cosX * sinY, 0,
            0, cosX, sinX, 0,
            sinY, -sinX * cosY, cosX * cosY, 0,
            0, 0, 0, 1];

        var c = this.rotationCenter;
        view[12] = c[0] - view[0] * c[0] - view[4] * c[1] - view[8] * c[2];
        view[13] = c[1] - view[1] * c[0] - view[5] * c[1] - view[9] * c[2];
        view[14] = (c[2] - view[2] * c[0] - view[6] * c[1] - view[10] * c[2]) - this.boomLength;

        return view;
    }

    // The 'handle' and 'on' functions are self explainatory based on name

    handleZoom(event) {
        this.boomLength = Math.min(Math.max(80, this.boomLength + event.deltaY * 0.2), 500);
    }

    handleRotate(vx, vy) {

        this.pitch = clamp(this.pitch + this.pitchSpd * (vy - this.yawRot), -this.pitchMax, this.pitchMax);
        this.yaw = this.yaw + this.yawSpd * (vx - this.pitchRot);
        this.pitchRot = vx;
        this.yawRot = vy;

    }

    onMouseDown(event) {

        if (this.mouseHeld) return;

        var bounds = this.canvas.getBoundingClientRect();
        this.pitchRot = event.clientX - bounds.left;
        this.yawRot = event.clientY - bounds.top;
        this.mouseHeld = true;

        this.canvas.addEventListener('mousemove', this.onMouseDrag.bind(this), false);
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this), false);

    }

    onMouseDrag(event) {

        if (!this.mouseHeld) return;

        var bounds = this.canvas.getBoundingClientRect();
        this.handleRotate(event.clientX - bounds.left, event.clientY - bounds.top);

    }

    onMouseUp(event) {

        if (!this.mouseHeld) return;

        this.mouseHeld = false;
        this.canvas.removeEventListener('mousemove', this.onMouseDrag, false);
        this.canvas.removeEventListener('mouseup', this.onMouseUp, false);

    }

    onTouchStart(event) {

        if (event.touches.length != 1) {
            this.onTouchCancel();
            return;
        }

        event.preventDefault();
        var bounds = this.canvas.getBoundingClientRect();
        this.pitchRot = event.touches[0].clientX - bounds.left;
        this.yawRot = event.touches[0].clientY - bounds.top;

        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), false);
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), false);
        this.canvas.addEventListener('touchcancel', this.onTouchCancel.bind(this), false);
        this.touchStarted = true;
    }

    onTouchMove(event) {

        if (event.touches.length != 1 || !this.touchStarted) {
            this.onTouchCancel();
            return;
        }

        event.preventDefault();
        var bounds = this.canvas.getBoundingClientRect();
        this.handleRotate(event.touches[0].clientX - bounds.left, event.touches[0].clientY - bounds.top);

    }

    onTouchEnd(event) {
        this.onTouchCancel();
    }

    onTouchCancel() {

        if (this.touchStarted) {

            this.touchStarted = false;
            this.canvas.removeEventListener('touchmove', this.onTouchMove, false);
            this.canvas.removeEventListener('touchend', this.onTouchEnd, false);
            this.canvas.removeEventListener('touchcancel', this.onTouchCancel, false);

        }

    }

}

function cubeVerts(type, size) {

    // Returns vertex data of chosen type with sizable position data

    if (type == 'position')
        return [

            // North
            size, -size, size, size, size, size, -size, size, size,
            size, -size, size, -size, size, size, -size, -size, size,

            // South 
            -size, -size, -size, -size, size, -size, size, size, -size,
            -size, -size, -size, size, size, -size, size, -size, -size,

            // East
            size, -size, -size, size, size, -size, size, size, size,
            size, -size, -size, size, size, size, size, -size, size,

            // West
            -size, -size, size, -size, size, size, -size, size, -size,
            -size, -size, size, -size, size, -size, - size, -size, -size,

            // Top
            -size, size, -size, -size, size, size, size, size, size,
            -size, size, -size, size, size, size, size, size, -size,

            // Bottom
            size, -size, size, -size, -size, size, -size, -size, -size,
            size, -size, size, -size, -size, -size, size, -size, -size

        ];

    if (type == 'uv')
        return [

            1, 0, 1, 1, 0, 1,
            1, 0, 0, 1, 0, 0,

            1, 0, 1, 1, 0, 1,
            1, 0, 0, 1, 0, 0,

            1, 0, 1, 1, 0, 1,
            1, 0, 0, 1, 0, 0,

            1, 0, 1, 1, 0, 1,
            1, 0, 0, 1, 0, 0,

            1, 0, 1, 1, 0, 1,
            1, 0, 0, 1, 0, 0,

            1, 0, 1, 1, 0, 1,
            1, 0, 0, 1, 0, 0,

        ];

    if (type == 'normal')
        return [

            0, 0, 1, 0, 0, 1, 0, 0, 1,
            0, 0, 1, 0, 0, 1, 0, 0, 1,

            0, 0, -1, 0, 0, -1, 0, 0, -1,
            0, 0, -1, 0, 0, -1, 0, 0, -1,

            1, 0, 0, 1, 0, 0, 1, 0, 0,
            1, 0, 0, 1, 0, 0, 1, 0, 0,

            -1, 0, 0, -1, 0, 0, -1, 0, 0,
            -1, 0, 0, -1, 0, 0, -1, 0, 0,

            0, 1, 0, 0, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 0, 0, 1, 0,

            0, -1, 0, 0, -1, 0, 0, -1, 0,
            0, -1, 0, 0, -1, 0, 0, -1, 0,

        ];

    if (type == 'tangent')
        return [

            -1, 0, 0, -1, 0, 0, -1, 0, 0,
            -1, 0, 0, -1, 0, 0, -1, 0, 0,

            0, 1, 0, 0, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 0, 0, 1, 0,

            0, 1, 0, 0, 1, 0, 0, 1, 0,
            0, 1, 0, 0, 1, 0, 0, 1, 0,

            0, 0, -1, 0, 0, -1, 0, 0, -1,
            0, 0, -1, 0, 0, -1, 0, 0, -1,

            0, 0, 1, 0, 0, 1, 0, 0, 1,
            0, 0, 1, 0, 0, 1, 0, 0, 1,

            -1, 0, 0, -1, 0, 0, -1, 0, 0,
            -1, 0, 0, -1, 0, 0, -1, 0, 0,

        ];

}

function loadOBJ(OBJString) {

    /* A very minimal function that parses an OBJ file 
     * returning arrays for each piece of vertex data.
     * Assumes triangulated faces with position, normal, and UV.
     */

    const lines = OBJString.split("\n");

    // *** Parse through the string array for indices and faces *** //
    const vertexData = [[0, 0, 0]], uvData = [[0, 0]], normalData = [[0, 0, 0]], faces = [];
    const VERT = /^v\s/, NORM = /^vn\s/, UV = /^vt\s/, FACE = /^f\s/, WHITESPACE = /\s+/;
    var polyCount = 0;
    for (let line of lines) {

        line = line.trim();
        if (!line || line.startsWith("#")) continue;

        const tokens = line.split(WHITESPACE);
        tokens.shift(); // Remove first token

        if (VERT.test(line)) vertexData.push(tokens.map(str => { return Number(str); }));
        else if (NORM.test(line)) normalData.push(tokens.map(str => { return Number(str); }));
        else if (UV.test(line)) uvData.push(tokens.map(str => { return Number(str); }));
        else if (FACE.test(line)) {
            polyCount++;
            faces.push(tokens);
        }

    }

    // **** Construct arrays that define the OBJ **** //
    const vertexArr = [], uvArr = [], normalArr = [], tangentArr = [];
    for (let face of faces) {

        /* Face format for a triangle ABC: vertex_index/texture_index/normal_index 
         * Note: If quad faces are allowed this is where a "D" vertice would be 
         * checked for and then an extra triangle face could be added as ACD,
         * i.e., if (face.length > 3) ... trianglate a new face
         */

        const A = face[0].split("/").map(str => { return Number(str); }),
            B = face[1].split("/").map(str => { return Number(str); }),
            C = face[2].split("/").map(str => { return Number(str); });

        // Retrieve data from parsed indices
        const v0 = vertexData[A[0]], v1 = vertexData[B[0]], v2 = vertexData[C[0]],
            u0 = uvData[A[1]], u1 = uvData[B[1]], u2 = uvData[C[1]],
            n0 = normalData[A[2]], n1 = normalData[B[2]], n2 = normalData[C[2]];

        // Add to arrays
        vertexArr.push(...v0, ...v1, ...v2);
        uvArr.push(...u0, ...u1, ...u2);
        normalArr.push(...n0, ...n1, ...n2);

        // Calculate tangents
        const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]],
            edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]],
            uv1 = [u1[0] - u0[0], u1[1] - u0[1]],
            uv2 = [u2[0] - u0[0], u2[1] - u0[1]];

        const inv = 1.0 / (uv1[0] * uv2[1] - uv2[0] * uv1[1]);

        // Push 
        for (let n = 0; n < 3; n++) {
            tangentArr.push(inv * (uv2[1] * edge1[0] - uv1[1] * edge2[0]));
            tangentArr.push(inv * (uv2[1] * edge1[1] - uv1[1] * edge2[1]));
            tangentArr.push(inv * (uv2[1] * edge1[2] - uv1[1] * edge2[2]));
        }

    }

    // Returned values can be used to create a vertex buffer
    return {
        position: vertexArr,
        normal: normalArr,
        uv: uvArr,
        tangent: tangentArr,
        count: polyCount,
    }

}