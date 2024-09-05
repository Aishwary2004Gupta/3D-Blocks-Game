window.focus(); // Capture keys right away 

let camera, scene, renderer; // ThreeJS globals
let world; // CannonJs world
let lastTime; // Last timestamp of animation
let stack; // Parts that stay solid on top of each other
let overhangs; // Overhanging parts that fall down
const boxHeight = 0.8; // Height of each layer
const originalBoxSize = 2.8; // Original width and height of a box
let autopilot = true; // Set autopilot to true initially so the game doesn't start
let gameEnded;
let robotPrecision; // Determines how precise the game is on autopilot

let bestScore = localStorage.getItem("bestScore") || 0;
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("bestScore");
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
  
  // Display the current best score
  bestScoreElement.innerText = `Best Score: ${bestScore}`;
}

function startGame() {
  autopilot = false;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];

  // Disable scrolling when the game starts
  disableScroll();

  // Hide instructions and results when the game starts
  if (instructionsElement) instructionsElement.style.display = "none";
  if (resultsElement) resultsElement.style.display = "none";
  const resetScoreElement = document.getElementById("resetScore");
  if (resetScoreElement) resetScoreElement.style.display = "none";
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

  // Enable scrolling
  enableScroll(); 

  // Show instructions and results when the game ends
  if (resultsElement) resultsElement.style.display = "block";
  const resetScoreElement = document.getElementById("resetScore");
  if (resetScoreElement) resetScoreElement.style.display = "block";
}

function addOverhang(x, z, width, depth) {
  const y = boxHeight * (stack.length - 1); // Add the new box one layer higher
  const overhang = generateBox(x, y, z, width, depth, true);
  overhangs.push(overhang);
}

function addLayer(x, z, width, depth, direction, isInitial = false) {
  const y = boxHeight * stack.length; // Add the new box one layer higher
  const layer = generateBox(x, y, z, width, depth, false, isInitial);
  layer.direction = direction;
  stack.push(layer);
}


function generateBox(x, y, z, width, depth, falls, isInitial = false) {
  // ThreeJS
  const geometry = new THREE.BoxGeometry(width, boxHeight, depth);

  // Set color based on whether it's the initial block
  const color = new THREE.Color(`hsl(${170 + stack.length * 7}, 100%, 50%)`);  
  const material = new THREE.MeshLambertMaterial({ color });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // Add black border
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
  const edges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
  mesh.add(edges);

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
    const speed = 0.006;

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
  }
  lastTime = time;
}

function updatePhysics(timePassed) {
  world.step(timePassed / 1000); // Step the physics world

  // Copy coordinates from Cannon.js to Three.js
  overhangs.forEach((element) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);
  });
}

// Whenever the player presses the space key or clicks with the mouse
function placeLayer() {
  if (autopilot || gameEnded) return;

  const topLayer = stack[stack.length - 1];
  const previousLayer = stack[stack.length - 2];

  const direction = topLayer.direction;

  const size = direction == "x" ? topLayer.width : topLayer.depth;
  const delta =
    topLayer.threejs.position[direction] -
    previousLayer.threejs.position[direction];
  const overhangSize = Math.abs(delta);
  const overlap = size - overhangSize;

  if (overlap > 0) {
    cutBox(topLayer, overlap, size, delta);

    // Overhang
    const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
    const overhangX = direction == "x" ? topLayer.threejs.position.x + overhangShift : topLayer.threejs.position.x;
    const overhangZ = direction == "z" ? topLayer.threejs.position.z + overhangShift : topLayer.threejs.position.z;
    const overhangWidth = direction == "x" ? overhangSize : topLayer.width;
    const overhangDepth = direction == "z" ? overhangSize : topLayer.depth;

    addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

    // Next layer
    const nextX = direction == "x" ? topLayer.threejs.position.x : -10;
    const nextZ = direction == "z" ? topLayer.threejs.position.z : -10;
    // New layer has the same size as the cut top layer
    const newWidth = topLayer.width; 
    const newDepth = topLayer.depth; 
    const nextDirection = direction == "x" ? "z" : "x";

    addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);

    // Update score correctly
    const score = stack.length - 2;
    scoreElement.innerText = score;

  } else {
    missedTheSpot();
  }
}

function missedTheSpot() {
  const topLayer = stack[stack.length - 1];

  // Turn the top layer into an overhang and let it fall down
  addOverhang(
    topLayer.threejs.position.x,
    topLayer.threejs.position.z,
    topLayer.width,
    topLayer.depth
  );
  world.remove(topLayer.cannonjs);
  scene.remove(topLayer.threejs);
  stack.pop();

  // Update best score if the current score is higher
  const currentScore = stack.length - 1;
  if (currentScore > bestScore) {
    bestScore = currentScore;
    localStorage.setItem("bestScore", bestScore);
    bestScoreElement.innerText = `Best Score: ${bestScore}`;
  }

  endGame();
}

// Handle keyboard inputs
window.addEventListener("keydown", (event) => {
  if (event.key == " ") {
    if (autopilot) {
      startGame();
    } else {
      placeLayer();
    }
  } else if (event.key == "r" || event.key == "R") {
    startGame();
  } else if (event.key.toLowerCase() == "b") {
    bestScore = 0;
    localStorage.setItem("bestScore", bestScore);
    bestScoreElement.innerText = `Best Score: ${bestScore}`;
  }
});

// Handle mouse clicks
// window.addEventListener("click", () => {
//   if (autopilot) {
//     startGame();
//   } else {
//     placeLayer();
//   }
// });

window.addEventListener("resize", () => {
  
  const aspect = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspect;

  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.updateProjectionMatrix();
});

function enableScroll() {
  window.addEventListener("wheel", onScroll);
  window.addEventListener("keydown", onArrowKey);
}

function disableScroll() {
  window.removeEventListener("wheel", onScroll);
  window.removeEventListener("keydown", onArrowKey);
}

function onScroll(event) {
  if (!gameEnded) return;

  // Adjust camera position based on scroll direction
  const scrollAmount = event.deltaY * 0.05; // Adjust this multiplier to control scroll speed
  camera.position.y -= scrollAmount;

  // Restrict camera's vertical movement within reasonable bounds
  camera.position.y = Math.max(4, Math.min(stack.length * boxHeight + 4, camera.position.y));

  renderer.render(scene, camera);
}

function onArrowKey(event) {
  if (!gameEnded) return;

  let scrollAmount = 1; // Adjust the amount moved by arrow keys
  if (event.key === "ArrowUp") {
    camera.position.y += scrollAmount;
  } else if (event.key === "ArrowDown") {
    camera.position.y -= scrollAmount;
  }

  // Restrict camera's vertical movement within reasonable bounds
  camera.position.y = Math.max(4, Math.min(stack.length * boxHeight + 4, camera.position.y));

  renderer.render(scene, camera);
}
