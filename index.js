import * as THREE from "three";

let camera, scene, renderer;
const originalBoxSize = 2;
const boxHeight = 0.6;
let stack = [];
let gameStarted = false;

function init() {
    scene = new THREE.Scene();

    // Start with two layers
    addLayer(0, 0, originalBoxSize, originalBoxSize);
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

    // Lights
    const ambient = new THREE.AmbientLight(0xfffff, 0.6);
    scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xfffff, 0.6);
    directional.position.set(10, 15, 0);
    scene.add(directional);

    // Camera (orthographic projections)
    const width = 10;
    const height = width * (window.innerHeight / window.innerWidth);
    camera = new THREE.OrthographicCamera(
        width / -2,
        width / 2,
        height / 2,
        height / -2,
        1,
        100
    );
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    renderer.render(scene, camera);
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length;

    const layer = generateBox(x, y, z, width, depth);
    layer.direction = direction;

    stack.push(layer);
}

function generateBox(x, y, z, width, depth) {
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

    const color = new THREE.Color(`hsl(${50 + stack.length * 4}, 100%, 50%)`);
    const material = new THREE.MeshLambertMaterial({ color });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    return {
        threejs: mesh,
        width,
        depth,
        direction: null
    };
}

window.addEventListener("click", () => {
    if (!gameStarted) {
        renderer.setAnimationLoop(animation);
        gameStarted = true;
    } else {
        const topLayer = stack[stack.length - 1];
        const direction = topLayer.direction;

        // Stop the current layer
        // topLayer.direction = null;

        // Prepare the next layer
        const nextX = direction === "x" ? 0 : -10;
        const nextZ = direction === "z" ? 0 : -10;
        const newWidth = originalBoxSize;
        const newDepth = originalBoxSize;
        const nextDirection = direction === "x" ? "z" : "x";

        addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
    }
});

function animation() {
    const speed = 0.15;

    const topLayer = stack[stack.length - 1];
    if (topLayer.direction) {
        topLayer.threejs.position[topLayer.direction] += speed;
    }

    // Raise the camera as the stack grows
    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
        camera.position.y += speed;
    }

    renderer.render(scene, camera);
}

init();
