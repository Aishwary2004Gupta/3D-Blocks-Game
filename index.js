window.focus(); // Capture keys right away (by default focus is on editor)

let camera, scene, renderer; // ThreeJS globals
let world; // CannonJs world
let lastTime; // Last timestamp of animation
let stack; // Parts that stay solid on top of each other
let overhangs; // Overhanging parts that fall down
const boxHeight = 1; // Height of each layer
const originalBoxSize = 3; // Original width and height of a box
let autopilot = true; // Set autopilot to true initially so the game doesn't start
let gameEnded;
let robotPrecision; // Determines how precise the game is on autopilot

const scoreElement = document.getElementById("score");
const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");

init();

function setRobotPrecision() {
  robotPrecision = Math.random() * 1 - 0.5;
}

function init() {
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];
  setRobotPrecision();

  // Initialize CannonJS
  world = new CANNON.World();
  world.gravity.set(0, -10, 0); // Gravity pulls things down
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 40;

  // Initialize ThreeJs
  const aspect = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspect;

  camera = new THREE.OrthographicCamera(
    width / -2, // left
    width / 2, // right
    height / 2, // top
    height / -2, // bottom
    0, // near plane
    100 // far plane
  );

  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);

  scene = new THREE.Scene();

  // Foundation (initial block with light red color)
  addLayer(0, 0, originalBoxSize, originalBoxSize, "x", true);

  // First layer
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

  // Set up lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 0);
  scene.add(dirLight);

  // Set up renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Render the initial scene
  renderer.render(scene, camera);

  // Show instructions
  if (instructionsElement) instructionsElement.style.display = "block";
}

function startGame() {
  autopilot = false;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];

  // Hide instructions and results when the game starts
  if (instructionsElement) instructionsElement.style.display = "none";
  if (resultsElement) resultsElement.style.display = "none";
  if (scoreElement) scoreElement.innerText = 0;

  if (world) {
    // Remove every object from world
    while (world.bodies.length > 0) {
      world.remove(world.bodies[0]);
    }
  }

  if (scene) {
    // Remove every Mesh from the scene
    while (scene.children.find((c) => c.type == "Mesh")) {
      const mesh = scene.children.find((c) => c.type == "Mesh");
      scene.remove(mesh);
    }

    // Foundation (initial block with light red color)
    addLayer(0, 0, originalBoxSize, originalBoxSize, "x", true);

    // First layer
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");
  }

  if (camera) {
    // Reset camera positions
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);
  }

  // Start the animation loop
  renderer.setAnimationLoop(animation);
}

function endGame() {
  gameEnded = true;
  renderer.setAnimationLoop(null); // Stop the animation loop

  // Show instructions and results when the game ends
  if (instructionsElement) instructionsElement.style.display = "block";
  if (resultsElement) resultsElement.style.display = "block";
}

function addLayer(x, z, width, depth, direction, isInitial = false) {
  const y = boxHeight * stack.length; // Add the new box one layer higher
  const layer = generateBox(x, y, z, width, depth, false, isInitial);
  layer.direction = direction;
  stack.push(layer);
}

function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1); // Add the new box one layer higher
  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}

// Create a box
function generateBox(x, y, z, width, depth, falls, isInitial = false) {
  // ThreeJS
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

  // Set color based on whether it's the initial block
  const color = new THREE.Color(`hsl(${100 + stack.length * 4}, 100%, 50%)`);  
  const material = new THREE.MeshLambertMaterial({ color });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // CannonJS
  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  );
  let mass = falls ? 5 : 0;
  mass *= width / originalBoxSize; // Reduce mass proportionately by size
  mass *= depth / originalBoxSize; // Reduce mass proportionately by size
  const body = new CANNON.Body({ mass, shape });
  body.position.set(x, y, z);
  world.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth,
  };
}

function cutBox(topLayer, overlap, size, delta) {
  const direction = topLayer.direction;
  const newWidth = direction == "x" ? overlap : topLayer.width;
  const newDepth = direction == "z" ? overlap : topLayer.depth;

  // Update metadata
  topLayer.width = newWidth;
  topLayer.depth = newDepth;

  // Update ThreeJS model
  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  // Update CannonJS model
  topLayer.cannonjs.position[direction] -= delta / 2;

  // Replace shape to a smaller one (in CannonJS you can't simply scale a shape)
  const shape = new CANNON.Box(
    new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
  );
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);
}

function animation(time) {
  if (lastTime) {
    const timePassed = time - lastTime;
    const speed = 0.008;

    const topLayer = stack[stack.length - 1];

    // The top level box should move if the game has not ended AND
    // it's either NOT in autopilot or it is in autopilot and the box did not yet reach the robot position
    const boxShouldMove =
      !gameEnded &&
      (!autopilot ||
        (autopilot && topLayer.threejs.position[topLayer.direction] < robotPrecision));

    if (boxShouldMove) {
      // Keep the position visible on UI
      topLayer.threejs.position[topLayer.direction] += speed * timePassed;
      topLayer.cannonjs.position[topLayer.direction] += speed * timePassed;

      // If the box went beyond the stack then show up the fail screen
      if (topLayer.threejs.position[topLayer.direction] > 10) {
        missedTheSpot();
      }
    } else {
      // If it shouldn't move then is the player or autopilot that should place it
      // (if the game is not over)
      if (autopilot) {
        placeLayer();
        setRobotPrecision();
      }
    }

    // 4 is the initial camera height
    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
      camera.position.y += speed * timePassed;
    }

    updatePhysics(timePassed);
    renderer.render(scene, camera);

    if (instructionsElement) instructionsElement.style.display = "block";
  }
  lastTime = time;
}

// When the player missed the spot
function missedTheSpot() {
  const topLayer = stack[stack.length - 1];

  // Stop the game
  if (topLayer.threejs.position[topLayer.direction] > 10) {
    gameEnded = true;
    if (resultsElement) resultsElement.style.display = "flex";
  }
}

// Set the top layer in place
function placeLayer() {
  const topLayer = stack[stack.length - 1];
  const previousLayer = stack[stack.length - 2];

  const direction = topLayer.direction;

  const delta =
    topLayer.threejs.position[direction] -
    previousLayer.threejs.position[direction];
  const overhangSize = Math.abs(delta);
  const size = direction == "x" ? topLayer.width : topLayer.depth;
  const overlap = size - overhangSize;

  if (overlap > 0) {
    cutBox(topLayer, overlap, size, delta);

    // Overhang
    const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
    const overhangX =
      direction == "x"
        ? topLayer.threejs.position.x + overhangShift
        : topLayer.threejs.position.x;
    const overhangZ =
      direction == "z"
        ? topLayer.threejs.position.z + overhangShift
        : topLayer.threejs.position.z;
    const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
    const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

    addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

    // Next layer
    const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
    const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
    const newWidth = topLayer.width;
    const newDepth = topLayer.depth;

    if (scoreElement) scoreElement.innerText = stack.length - 1;
    addLayer(nextX, nextZ, newWidth, newDepth, direction == "x" ? "z" : "x");
  } else {
    missedTheSpot();
  }
}

function updatePhysics(timePassed) {
  world.step(timePassed / 1000); // Step the physics world

  // Copy coordinates from Cannon.js to Three.js
  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

window.addEventListener("resize", () => {
  const aspect = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspect;

  camera.top = height / 2;
  camera.bottom = height / -2;

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function missedTheSpot() {
  const topLayer = stack[stack.length - 1];

  // Stop the game
  if (topLayer.threejs.position[topLayer.direction] > 10) {
    gameEnded = true;
    if (resultsElement) resultsElement.style.display = "flex";
    if (instructionsElement) instructionsElement.style.display = "block"; // Show instructions when game ends
  }
}

window.addEventListener("click", () => {
  if (autopilot || gameEnded) startGame();
  else placeLayer();
});

window.addEventListener("keydown", (event) => {
  if (event.key == " ") {
    if (autopilot || gameEnded) startGame();
    else placeLayer();
  } else if (event.key.toLowerCase() == "r") {
    startGame();
  }
});