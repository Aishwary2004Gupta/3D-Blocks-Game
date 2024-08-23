import * as THREE from "three";

let camera, scene, renderer;
const originalBoxSize = 2;
const boxHeight = 0.6;
let stack = [];
let overhangs = [];
let gameStarted = false;
let stackedCount = 0; // Initialize the count

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

    // Add stacked count display
    const countDisplay = document.createElement("div");
    countDisplay.id = "stackedCount";
    countDisplay.style.position = "absolute";
    countDisplay.style.top = "10px";
    countDisplay.style.left = "10px";
    countDisplay.style.color = "white";
    countDisplay.style.fontSize = "24px";
    countDisplay.style.fontFamily = "Arial, sans-serif";
    countDisplay.textContent = `Stacked Boxes: ${stackedCount}`;
    document.body.appendChild(countDisplay);
}

function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length;

    const layer = generateBox(x, y, z, width, depth);
    layer.direction = direction;

    stack.push(layer);
}

//overhanging parts do not have directions and we dont want to simulate gravity by ourselves. Therefore we will use Cannon js to simulate physics

function addOverhang(x, z, width, depth) {
    const y = boxHeight * (stack.length - 1);
    const overhang = generateBox(x, y, z, width, depth);
    overhangs.push(overhang);
} 

function generateBox(x, y, z, width, depth) {
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

    const color = new THREE.Color(`hsl(${60 + stack.length * 4}, 100%, 50%)`);
    const material = new THREE.MeshLambertMaterial({ color });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    return {
        threejs: mesh,
        width,
        depth,
        // direction: null
    };
}

window.addEventListener("click", () => {
    if (!gameStarted) {
        renderer.setAnimationLoop(animation);
        gameStarted = true;
    } else {
        const topLayer = stack[stack.length - 1];
        const previousLayer = stack[stack.length - 2];

        const direction = topLayer.direction;

        const delta = //can be +ve or -ve
            topLayer.threejs.position[direction] -
            previousLayer.threejs.position[direction];

        const overhangSize = Math.abs(delta);
        const size = direction == "x" ? topLayer.width : topLayer.depth;
        const overlap = size - overhangSize;

        if (overlap > 0){

            //cutting the layer
            const newWidth = direction == "x" ? overlap : topLayer.width;
            const newDepth = direction == "z" ? overlap : topLayer.depth;

            //only one would change out of them
            topLayer.width = newWidth;
            topLayer.depth = newDepth;

            // update ThreeJS model
            topLayer.threejs.scale[direction] = overlap / size; //scaling the mesh
            topLayer.threejs.position[direction] -= delta / 2;

            //overhang
            const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta); //sign returns -1/1 or 0 depending on the situation
            const overhangX = 
                direction === "x" 
                ? topLayer.threejs.position.x + overhangShift 
                : topLayer.threejs.position.x;
            const overhangZ =
                direction === "z"
                ? topLayer.threejs.position.z + overhangShift
                : topLayer.threejs.position.z;
            const overhangWidth = direction == "x" ? overhangShift : newWidth;
            const overhangDepth = direction == "z" ? overhangShift : newDepth;

            addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

            //next layer
            const nextX = direction === "x" ? topLayer.threejs.position.x : -10;
            const nextZ = direction === "z" ? topLayer.threejs.position.z : -10;
            const nextDirection = direction === "x" ? "z" : "x"; //switching the direction everytime
            
            addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
        }

        //not stopping the layer just adding the next box on the top

        // Prepare the next layer
        const nextX = direction === "x" ? 0 : -10;
        const nextZ = direction === "z" ? 0 : -10;
        const newWidth = originalBoxSize;
        const newDepth = originalBoxSize;
        const nextDirection = direction === "x" ? "z" : "x"; //switching the direction everytime

        addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);
        
        // Increment the stacked count
        stackedCount++;
        document.getElementById("stackedCount").textContent = `Stacked Boxes: ${stackedCount}`;
    }
});

function animation() {
    const speed = 0.12;

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