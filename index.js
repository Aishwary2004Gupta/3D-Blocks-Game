window.focus(); 

window.addEventListener("touchstart", handleTouchStart);
window.addEventListener("touchend", handleTouchEnd);

let touchStartTime;
let cloudsAdded = false;
let cloudGroup;

let camera, scene, renderer; // ThreeJS globals
let world; // CannonJs world
let lastTime; 
let stack; // Parts that stay solid on top of each other
let overhangs; // Overhanging parts that fall down
const boxHeight = 0.7; 
const originalBoxSize = 2.8; 
let autopilot = true; // Set autopilot to true initially so the game doesn't start
let gameEnded;
let robotPrecision; 
let floor;

let bestScore = localStorage.getItem("bestScore") || 0;
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("bestScore");
const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");

function handleTouchStart(event) {
  touchStartTime = new Date().getTime();
}

function handleTouchEnd(event) {
  const touchEndTime = new Date().getTime();
  const touchDuration = touchEndTime - touchStartTime;

  // Prevent accidental touches
  if (touchDuration < 300) {
    if (autopilot) {
      startGame();
    } else {
      placeLayer();
    }
  }
}

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

  // Foundation
  addLayer(0, 0, originalBoxSize, originalBoxSize, "x", true);

  // First layer
  addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

  // lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 0);
  scene.add(dirLight);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  addTransparentFloor();

  // initial scene
  renderer.render(scene, camera);

  // Show instructions
  if (instructionsElement) instructionsElement.style.display = "block";
  
  // current best score
  bestScoreElement.innerText = `Best Score: ${bestScore}`;
}

function addTransparentFloor() {
  // Check if clouds have already been added
  if (cloudsAdded) return; // Exit the function if clouds are already added

  const floorSize = originalBoxSize * 2.3;
  const floorHeight = -0.9;
  const floorPosition = -1.2;

  // Create a cloud-like shape
  const cloudGeometry = new THREE.SphereGeometry(floorSize / 6, 32, 32);
  const cloudMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.2,
    transparent: true,
    opacity: 0.8
  });

  // Create cloud puffs
  cloudGroup = new THREE.Group(); // Use the global cloudGroup variable
  const numPuffs = 60;

  for (let i = 0; i < numPuffs; i++) {
    const cloudPuff = new THREE.Mesh(cloudGeometry, cloudMaterial);
    
    const angle = (i / numPuffs) * Math.PI * 2;
    const radius = floorSize / 3 * (Math.random() * 3);
    cloudPuff.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * floorHeight * 0.5,
      Math.sin(angle) * radius
    );
    
    const puffScale = 1.5 + Math.random() * 0.5;
    cloudPuff.scale.set(puffScale, puffScale * 0.6, puffScale);
    
    // Store the initial radius for later use in animation
    cloudPuff.userData.initialRadius = radius;
    
    cloudGroup.add(cloudPuff);
  }

  cloudGroup.position.set(0, floorPosition, 0);
  scene.add(cloudGroup);

  // CannonJS (invisible physics floor)
  const shape = new CANNON.Box(new CANNON.Vec3(floorSize / 2, 0.1, floorSize / 2));
  const body = new CANNON.Body({ mass: 0, shape: shape });
  body.position.set(0, floorPosition - 0.5, 0);
  world.addBody(body);

  // Store the cloud group for potential future updates
  floor = cloudGroup;

  // Mark clouds as added
  cloudsAdded = true;
}

function animateClouds(time) {
  if (cloudGroup) {
    cloudGroup.rotation.y = time * 0.0001; // Slow, constant rotation
    
    // Rotate each cloud puff around its initial position
    cloudGroup.children.forEach((puff, index) => {
      const angle = time * 0.0002 + (index * Math.PI * 2 / cloudGroup.children.length);
      const radius = puff.userData.initialRadius || 1;
      puff.position.x = Math.cos(angle) * radius;
      puff.position.z = Math.sin(angle) * radius;
    });
  }
}

function startGame() {
  autopilot = false;
  gameEnded = false;
  lastTime = 0;
  stack = [];
  overhangs = [];

  disableScroll();

  // Hide instructions and results
  if (instructionsElement) instructionsElement.style.display = "none";
  if (resultsElement) resultsElement.style.display = "none";
  const resetScoreElement = document.getElementById("resetScore");
  if (resetScoreElement) resetScoreElement.style.display = "none";
  if (scoreElement) scoreElement.innerText = 0;

  // hide scroll message
  const scrollMessage = document.getElementById("scrollMessage");
  if (scrollMessage) scrollMessage.style.display = "none";

  if (world) {
    // Remove every object from world
    while (world.bodies.length > 0) {
      world.remove(world.bodies[0]);
    }
    // Recreate the world
    world = new CANNON.World();
    world.gravity.set(0, -10, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;
  }

  if (scene) {
    // Remove every Mesh from the scene
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const child = scene.children[i];
      if (child.type === "Mesh" && child !== floor) {
        scene.remove(child);
      }
    }

    // Foundation
    addLayer(0, 0, originalBoxSize, originalBoxSize, "x", true);

    // First layer
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");
  }
  addTransparentFloor();

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

  // Make the last block fall
  const lastBlock = stack[stack.length - 1];
  if (lastBlock) {
    const lastBlockBody = lastBlock.cannonjs;
    lastBlockBody.mass = 5; // Give it mass so it falls
    lastBlockBody.updateMassProperties();
    
    // Remove it from the stack and add to overhangs
    stack.pop();
    overhangs.push(lastBlock);
  }

  // Continue rendering to show falling blocks and moving clouds
  renderer.setAnimationLoop(endGameAnimation);

  enableScroll(); 

  // Show instructions and results when the game ends
  if (resultsElement) resultsElement.style.display = "block";
  const resetScoreElement = document.getElementById("resetScore");
  if (resetScoreElement) resetScoreElement.style.display = "block";

  // scroll message
  const scrollMessage = document.getElementById("scrollMessage");
  if (scrollMessage) scrollMessage.style.display = "block";
}

function endGameAnimation(time) {
  updatePhysics(16); // Update physics at 60fps
  animateClouds(time);
  renderer.render(scene, camera);

  // Check if all overhangs have fallen below a certain point
  const allBlocksFallen = overhangs.every(block => block.threejs.position.y < -20);
  if (allBlocksFallen) {
    renderer.setAnimationLoop(null);
  }
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

  // Set block color (use HSL color for easy manipulation)
  const blockHue = (170 + stack.length * 7) % 360; // Cycle through hues for the blocks
  const blockColor = new THREE.Color(`hsl(${blockHue}, 100%, 50%)`);
  
  const material = new THREE.MeshLambertMaterial({ color: blockColor });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene.add(mesh);

  // Add black border for visibility
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

  // Update the background color based on the block color
  updateBackgroundColor(blockHue);

  return {
    threejs: mesh,
    cannonjs: body,
    width,
    depth,
  };
}

function updateBackgroundColor(blockHue) {
  // Use the same hue as the block, but make it lighter
  const backgroundColor = new THREE.Color(`hsl(${blockHue}, 50%, 80%)`);

  // Apply the background color to the scene
  scene.background = backgroundColor;
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
    const speed = 0.005;

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
    animateClouds(time);

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
    const newWidth = topLayer.width; 
    const newDepth = topLayer.depth; 
    const nextDirection = direction == "x" ? "z" : "x";

    addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);

    // Update score
    const score = stack.length - 2;
    scoreElement.innerText = score;

    // Play the stack sound
    const stackSound = document.getElementById("stackSound");
    stackSound.play(); // Trigger the sound

  } else {
    missedTheSpot();
  }
}


function missedTheSpot() {
  const topLayer = stack[stack.length - 1];
  const currentScore = stack.length - 2;

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
  
  if (currentScore > bestScore) {
    bestScore = currentScore;
    localStorage.setItem("bestScore", bestScore);
    bestScoreElement.innerText = `Best Score: ${bestScore}`;
    // Show confetti
    showConfetti();
  }

  endGame();
}

// Handle keyboard inputs
window.addEventListener("keydown", handleInput);

function handleInput(event) {
  if (event.key == " " || event.type == "touchend") {
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
}

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
  window.addEventListener("touchmove", onTouchMove, { passive: false });
}

function disableScroll() {
  window.removeEventListener("wheel", onScroll);
  window.removeEventListener("keydown", onArrowKey);
  window.removeEventListener("touchmove", onTouchMove);
}

function onTouchMove(event) {
  if (!gameEnded) {
    event.preventDefault();
    return;
  }

  const touch = event.touches[0];
  const moveAmount = (touch.pageY - touch.target.offsetTop) * 0.05;
  camera.position.y -= moveAmount;

  // Restrict camera's vertical movement within reasonable bounds
  camera.position.y = Math.max(4, Math.min(stack.length * boxHeight + 4, camera.position.y));

  renderer.render(scene, camera);
}

function onScroll(event) {
  if (!gameEnded) return;

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

function showConfetti() {
  confetti({
    particleCount: 200,
    spread: 160,
    origin: { y: 0.6 },
    colors: ['#B8860B', '#D2691E', '#8B0000', '#006400', '#00008B', '#DAA520'],
    ticks: 300,
    gravity: 0.8,
    shapes: ['circle', 'square'],
    zIndex: 9999
  });
}