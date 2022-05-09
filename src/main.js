/*
 * File: main.js
 * Author: Nathan Hunter
 * Date: May 9, 2022
 *
 * Purpose: Creates a renderer instance and loads materials into it.
 *          Then creates various meshes with those materials assigned
 *          along with lights which are added to a scene the renderer renders.  
 *          Animates the texture cubes and spheres with a rotation and 
 *          has a GUI to adjust lights animation.
 */

let renderer = new Renderer();
let scene = renderer.scene;
renderer.camera.addOrbitController(canvas, 300);

// *** Create materials *** //

renderer.createMaterial('res/panel_albedo.png', 'res/panel_normal.png', 'res/panel_material.png', 'panel');
renderer.createMaterial('res/celtic_albedo.png', 'res/celtic_normal.png', 'res/celtic_material.png', 'celtic');
renderer.createMaterial('res/stone_albedo.png', 'res/stone_normal.png', 'res/stone_material.png', 'stone');
renderer.createMaterial('res/lava_albedo.png', 'res/lava_normal.png', 'res/lava_material.png', 'lava');
renderer.createMaterial('res/pirate_albedo.png', 'res/pirate_normal.png', 'res/pirate_material.png', 'pirate');
renderer.createMaterial('res/wood_albedo.png', 'res/wood_normal.png', 'res/wood_material.png', 'wood');
renderer.createMaterial('res/helmet_albedo.png', 'res/helmet_normal.png', 'res/helmet_material.png', 'helmet');
renderer.createMaterial('res/bball_albedo.png', 'res/bball_normal.png', 'res/bball_material.png', 'bball');
renderer.createMaterial('res/mug_albedo.png', 'res/mug_normal.png', 'res/mug_material.png', 'mug');
renderer.createMaterial('res/mjolnir_albedo.png', 'res/mjolnir_normal.png', 'res/mjolnir_material.png', 'mjolnir');

// *** Create geometry *** //

var cubeMesh = new Mesh();
cubeMesh.addBuffer(cubeVerts('position', 1), 'position', 3);
cubeMesh.addBuffer(cubeVerts('normal'), 'normal', 3);
cubeMesh.addBuffer(cubeVerts('uv'), 'uv', 2);
cubeMesh.addBuffer(cubeVerts('tangent'), 'tangent', 3);

var sphereData = loadOBJ(sphere_obj), sphereMesh = new Mesh();
sphereMesh.addBuffer(sphereData.position, 'position', 3);
sphereMesh.addBuffer(sphereData.normal, 'normal', 3);
sphereMesh.addBuffer(sphereData.uv, 'uv', 2);
sphereMesh.addBuffer(sphereData.tangent, 'tangent', 3);

var helmetData = loadOBJ(helmet_obj), helmetMesh = new Mesh();
helmetMesh.addBuffer(helmetData.position, 'position', 3);
helmetMesh.addBuffer(helmetData.normal, 'normal', 3);
helmetMesh.addBuffer(helmetData.uv, 'uv', 2);
helmetMesh.addBuffer(helmetData.tangent, 'tangent', 3);

var bballData = loadOBJ(bball_obj), bballMesh = new Mesh();
bballMesh.addBuffer(bballData.position, 'position', 3);
bballMesh.addBuffer(bballData.normal, 'normal', 3);
bballMesh.addBuffer(bballData.uv, 'uv', 2);
bballMesh.addBuffer(bballData.tangent, 'tangent', 3);

var mugData = loadOBJ(mug_obj), mugMesh = new Mesh();
mugMesh.addBuffer(mugData.position, 'position', 3);
mugMesh.addBuffer(mugData.normal, 'normal', 3);
mugMesh.addBuffer(mugData.uv, 'uv', 2);
mugMesh.addBuffer(mugData.tangent, 'tangent', 3);

var mjolnirData = loadOBJ(mjolnir_obj), mjolnirMesh = new Mesh();
mjolnirMesh.addBuffer(mjolnirData.position, 'position', 3);
mjolnirMesh.addBuffer(mjolnirData.normal, 'normal', 3);
mjolnirMesh.addBuffer(mjolnirData.uv, 'uv', 2);
mjolnirMesh.addBuffer(mjolnirData.tangent, 'tangent', 3);

// *** Create add meshes to scene *** //

var shd = renderer.shaders.gBuffer, mats = renderer.materials;
let pirate = scene.addMesh(cubeMesh, shd, mats.pirate, 'Pirate'),
    stone = scene.addMesh(sphereMesh, shd, mats.stone, 'Stone'),
    panel = scene.addMesh(cubeMesh, shd, mats.panel, 'Panel'),
    celtic = scene.addMesh(cubeMesh, shd, mats.celtic, 'Celtic'),
    lava = scene.addMesh(sphereMesh, shd, mats.lava, 'Lava'),
    wood = scene.addMesh(sphereMesh, shd, mats.wood, 'Wood'),
    helmet = scene.addMesh(helmetMesh, shd, mats.helmet, 'Helmet'),
    bball = scene.addMesh(bballMesh, shd, mats.bball, 'Basketball'),
    mug = scene.addMesh(mugMesh, shd, mats.mug, 'Mug'),
    mjolnir = scene.addMesh(mjolnirMesh, shd, mats.mjolnir, 'Mjolnir');


var yOff = 60; // Rows of objects on y-axis

// Cubes
var cs = 20; // cube size
pirate.translate(100, yOff, 0);
pirate.setScale(cs, cs, cs);

panel.translate(0, yOff, 0);
panel.setScale(cs, cs, cs);

celtic.translate(-100, yOff, 0);
celtic.setScale(cs, cs, cs);

// Spheres
var ss = 60; // sphere size
stone.translate(0, -yOff, 0);
stone.setScale(ss, ss, ss);

lava.translate(100, -yOff, 0);
lava.setScale(ss, ss, ss);

wood.translate(-100, -yOff, 0);
wood.setScale(ss, ss, ss);

// OBJ
bball.translate(150, 0, 0);
bball.setScale(200, 200, 200);

helmet.translate(-50, 0, 0);
helmet.setScale(3, 3, 3);

mug.translate(-150, -20, 0);
mug.setScale(12, 12, 12);

mjolnir.translate(50, -20, 0);
mjolnir.setScale(300, 300, 300);

// *** Setup lighting *** //

let lights = [
    scene.addLight([255, 255, 255]),
    scene.addLight([255, 0, 0]),
    scene.addLight([0, 255, 0]),
    scene.addLight([0, 0, 255])
];

lights[0].setPosition(0, 50, 100);
lights[1].setPosition(-50, 0, 0);
lights[2].setPosition(0, 0, 50);
lights[3].setPosition(50, 0, 0);


// ** Setup GUI *** //

let controls = {

    animateOn: true,
    animateSpeed: 1,
    lightAmbience: 0.5,
    lightIntensity: 0.8,

}

var attributes = renderer.attributes, meshes = scene.meshes;
const gui = new dat.GUI();
gui.add(attributes, 'drawGbuffer').name('G-Buffer');

const folderAnimate = gui.addFolder('Animation');
folderAnimate.add(controls, 'animateOn').name('On');
folderAnimate.add(controls, 'animateSpeed', 0.1, 2.0).name('Speed');
folderAnimate.open();

const folderLight = gui.addFolder('Lighting');
folderLight.add(attributes, 'lightAmbience', 0.1, 1.0).name('Ambience');
folderLight.add(attributes, 'lightIntensity', 0.1, 1.0).name('Intensity');
folderLight.open();

for (let l in lights) {
    const light = lights[l];
    folderLight.add(light, 'visible');
    folderLight.addColor(light, 'color');
}
folderLight.open();

const folderMesh = gui.addFolder('Objects');
for (let m in meshes) {
    const mesh = meshes[m];
    folderMesh.add(mesh, 'visible').name(mesh.name);
}
folderMesh.open();

class Animator {

    constructor() {

        this.deltaPrev = 0;
        this.theta = 0;
        this.animate(0);

    }

    animate(timeStamp) {

        const delta = (timeStamp - this.deltaPrev) * 0.001 * controls.animateSpeed * controls.animateOn;

        // Animations
        var rot = delta * M_RAD;
        this.theta += rot * 100;
        rot *= 90; // 90 degrees per second

        // Rotate spheres and cubes
        pirate.rotateY(rot);
        panel.rotateY(rot);
        celtic.rotateY(rot);
        stone.rotateY(-rot);
        lava.rotateY(-rot);
        wood.rotateY(-rot);

        // Orbiting lights
        var t = this.theta, d = 200;
        lights[1].setPosition(d * Math.cos(t), 50, d * Math.sin(t));
        lights[2].setPosition(0, d * Math.cos(t), d * Math.sin(t));
        lights[3].setPosition(d * Math.cos(-t), -50, d * Math.sin(-t));

        // Call renderer and request frame callback
        renderer.renderScene(delta);
        this.deltaPrev = timeStamp;
        requestAnimationFrame(this.animate.bind(this));

    }

}

// Launch renderer
let run = null;
window.addEventListener('DOMContentLoaded', () => {
    run = new Animator();
});