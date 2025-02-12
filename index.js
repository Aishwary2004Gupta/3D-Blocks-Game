window.focus();
window.addEventListener("touchstart", handleTouchStart);
window.addEventListener("touchend", handleTouchEnd);

let touchStartTime;
let cloudsAdded = false;
let cloudGroup;
let isPaused = false;

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

//mobile
let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
// let touchStartTime;
let touchStartX = 0;
let touchStartY = 0;
let cameraStartY = 4;

let bestScore = localStorage.getItem("bestScore") || 0;
const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("bestScore");
const instructionsElement = document.getElementById("instructions");
const resultsElement = document.getElementById("results");

// Initialize touch controls
function initTouchControls() {
  if (isMobile) {
    const pauseBtn = document.getElementById('mobile-pause');
    const restartBtn = document.getElementById('mobile-restart');

    // Add touch event listeners with proper prevention
    pauseBtn.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      togglePause();
    }, { passive: false });

    restartBtn.addEventListener('touchend', function(e) {
      e.preventDefault();
      e.stopPropagation();
      startGame();
    }, { passive: false });
  }
}

function handleTouchStart(event) {
  touchStartTime = new Date().getTime();
}

function handleTouchEnd(e) {
  const touchDuration = Date.now() - touchStartTime;
  const indicator = document.getElementById('touch-indicator');
  indicator.style.display = 'none';

  // Prevent multiple taps during game start
  if (autopilot) {
    startGame();
    return;
  }

  if (gameEnded) {
    startGame();
    return;
  }

  if (touchDuration < 300 && !autopilot && !gameEnded && !isPaused) {
    placeLayer();
  }
}

init();

function setRobotPrecision() {
  robotPrecision = Math.random() * 1 - 0.5;
}

function init() {
  autopilot = true;
  gameEnded = false;
  isPaused = false;
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

  camera.position.set(isMobile ? 6 : 4, isMobile ? 6 : 4, isMobile ? 6 : 4); // Better view for mobile

  camera.position.set(4, 4, 4);
  camera.lookAt(0, 0, 0);

  if (isMobile) {
    world.gravity.set(0, -8, 0); // Reduced gravity for mobile
    world.solver.iterations = 60; // More accurate collisions
  }

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

  updateBestScore();
  bestScoreElement.innerText = `Best Score: ${bestScore}`;
  updateRendererSize();
  initTouchControls(); // Add this line
  updateInstructionsForMobile();
  // setupBuyMeACoffeeButton();
}

// Update instructions for mobile
function updateInstructionsForMobile() {
  if (isMobile) {
    document.getElementById('instructions').innerHTML = `
      <p>Tap to start</p>
      <p>Tap to stack</p>
    `;
    
    document.getElementById('results').innerHTML = `
      <span class="dela-gothic-one-regular">Game Over!</span>
      <p><span class="white-text">Tap ↻ restart</span>
    `;
  }
}

// Modify camera controls
function enableScroll() {
  if (!isMobile) {
    window.addEventListener('wheel', onScroll);
    window.addEventListener('keydown', onArrowKey);
  }
}

function disableScroll() {
  if (!isMobile) {
    window.removeEventListener('wheel', onScroll);
    window.removeEventListener('keydown', onArrowKey);
  }
}


function addTransparentFloor() {
  if (cloudsAdded) return;

  const floorSize = originalBoxSize * 2.4;
  const floorHeight = -0.6;
  const floorPosition = -1.4;

  // Create a cloud-like shape
  const cloudGeometry = new THREE.SphereGeometry(floorSize / 6, 32, 32);
  const cloudMaterial = new THREE.MeshPhongMaterial({
    color: 0xcccccc,
    emissive: 0x222222,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.6
  });

  cloudGroup = new THREE.Group();
  const numPuffs = 95;

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
    cloudPuff.scale.set(puffScale, puffScale * 0.5, puffScale);

    // Store the initial radius for later use in animation
    cloudPuff.userData.initialRadius = radius;
    cloudGroup.add(cloudPuff);
  }

  cloudGroup.position.set(0, floorPosition, 0);
  scene.add(cloudGroup);

  //Floor
  const shape = new CANNON.Box(new CANNON.Vec3(floorSize / 2, 0.1, floorSize / 2));
  const body = new CANNON.Body({ mass: 0, shape: shape });
  body.position.set(0, floorPosition - 0.5, 0);
  world.addBody(body);

  // Store the cloud group for potential future updates
  floor = cloudGroup;
  cloudsAdded = true;
}

function animateClouds(time) {
  if (cloudGroup) {
    cloudGroup.rotation.y = time * 0.0001;
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
  isPaused = false;
  lastTime = 0;
  stack = [];
  overhangs = [];

  disableScroll();

   // Reset camera position
   camera.position.set(4, 4, 4);
   camera.lookAt(0, 0, 0);

  // Reset pause button state
  if (isMobile) {
    document.getElementById('mobile-pause').textContent = '⏸';
  }
   // First layer
   addLayer(isMobile ? -5 : -10, 0, originalBoxSize, originalBoxSize, "x"); // Closer starting position for mobile

  // Hide instructions and results
  if (instructionsElement) instructionsElement.style.display = "none";
  if (resultsElement) resultsElement.style.display = "none";
  const resetScoreElement = document.getElementById("resetScore");
  if (resetScoreElement) resetScoreElement.style.display = "none";
  if (scoreElement) scoreElement.innerText = "0";

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

  bestScore = localStorage.getItem("bestScore") || 0;
  bestScoreElement.innerText = `Best Score: ${bestScore}`;

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

  if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'flex';
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
  updatePhysics(16);
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
  const y = boxHeight * stack.length;
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

  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
  );
  let mass = falls ? 5 : 0;
  mass *= width / originalBoxSize; // Reduce mass proportionately by size
  mass *= depth / originalBoxSize; // Reduce mass proportionately by size
  const body = new CANNON.Body({ mass, shape });

  // Set angular velocity to zero to prevent random tilting
  body.angularVelocity.set(0, 0, 0);

  // Increase friction to help blocks settle
  body.material = new CANNON.Material();
  body.friction = 0.8; // Adjust friction as needed
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
  // Use the same hue as the block
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
    const speed = isMobile ? 0.003 : 0.005; // Slower speed for mobile

    const topLayer = stack[stack.length - 1];

    // The top level box should move if the game has not ended AND
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
      if (autopilot) {
        placeLayer();
        setRobotPrecision();
      }
    }

    // 4 is the initial camera height
    const cameraSpeed = 0.0015;
    if (camera.position.y < boxHeight * (stack.length - 2) + 4) {
      camera.position.y += cameraSpeed * timePassed;
    }
    animateClouds(time);

    updatePhysics(timePassed);
    renderer.render(scene, camera);
  }
  lastTime = time;
}

function updatePhysics(timePassed) {
  world.step(timePassed / 1000);

  const cloudRotationSpeed = 0.0001; // Constant rotation speed
  const cloudRadius = originalBoxSize * 1.9;

  overhangs.forEach((element, index) => {
    element.threejs.position.copy(element.cannonjs.position);
    element.threejs.quaternion.copy(element.cannonjs.quaternion);

    // Check if the block is within the cloud range
    const distanceFromCenter = Math.sqrt(
      element.threejs.position.x ** 2 + element.threejs.position.z ** 2
    );

    if (element.threejs.position.y < -0.4 && distanceFromCenter <= cloudRadius) {
      element.threejs.position.y = -0.4;
      element.cannonjs.position.y = -0.4;

      element.cannonjs.velocity.set(0, 0, 0);
      element.cannonjs.angularVelocity.set(0, 0, 0);

      // Use the time passed to calculate rotation
      const rotationAngle = cloudRotationSpeed * timePassed;

      // Rotate the position around the y-axis
      const x = element.threejs.position.x;
      const z = element.threejs.position.z;
      const cos = Math.cos(rotationAngle);
      const sin = Math.sin(rotationAngle);

      element.threejs.position.x = x * cos - z * sin;
      element.threejs.position.z = x * sin + z * cos;

      // Update the CannonJS body position
      element.cannonjs.position.copy(element.threejs.position);
    } else if (element.threejs.position.y < -20) {
      // Remove the block if it falls too far
      world.remove(element.cannonjs);
      scene.remove(element.threejs);
      overhangs.splice(index, 1);
    }
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
    const score = stack.length - 3;
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
  const currentScore = stack.length - 3;

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
    const isFirstGame = bestScore === 0;
    bestScore = currentScore;
    localStorage.setItem("bestScore", bestScore);
    bestScoreElement.innerText = `Best Score: ${bestScore}`;

    // Show confetti for all high scores
    showConfetti();

    // Highlight the best score text
    highlightBestScore(isFirstGame);
  }

  endGame();
}

// Handle keyboard inputs
window.addEventListener("keydown", handleInput);

let inputCooldown = false;

function handleInput(event) {
  if (inputCooldown) return;
  if (event.key === ' ' || event.type === 'touchend') {
    if (autopilot) {
      startGame();
    } else if (!isPaused) {
      placeLayer();
    }
  } else if (event.key === 'p' || event.key === 'P') {
    togglePause();
  } else if (event.key === 'r' || event.key === 'R') {
    startGame();
  } else if (event.key.toLowerCase() === 'b') {
    if (autopilot || gameEnded) {
      bestScore = 0;
      localStorage.setItem("bestScore", bestScore);
      bestScoreElement.innerText = `Best Score: ${bestScore}`;
      updateBestScore();
    }
  }

  if (isMobile && event.type !== 'touchend') return;

  // Set cooldown for mobile
  if (isMobile) {
    inputCooldown = true;
    setTimeout(() => {
      inputCooldown = false;
    }, 200);
  }
}

function handleTouchStart(e) {
  touchStartTime = Date.now();
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  cameraStartY = camera.position.y;
  
  // Show touch indicator
  const indicator = document.getElementById('touch-indicator');
  indicator.style.display = 'block';
  indicator.style.left = `${touchStartX}px`;
  indicator.style.top = `${touchStartY}px`;
}

function handleTouchEnd(e) {
  const touchDuration = Date.now() - touchStartTime;
  if (touchDuration < 300) { // Consider short touch as tap
    handleInput({ type: 'touchend' });
  }
  
  // Hide touch indicator
  document.getElementById('touch-indicator').style.display = 'none';
}

function handleTouchMove(e) {
  if (!gameEnded) return;
  
  const touch = e.touches[0];
  const deltaY = touch.clientY - touchStartY;
  camera.position.y = cameraStartY + (deltaY * 0.02);
  
  // Constrain camera movement
  camera.position.y = Math.max(4, Math.min(stack.length * boxHeight + 4, camera.position.y));
  
  e.preventDefault();
  renderer.render(scene, camera);
}

function togglePause() {
  if (gameEnded || autopilot) return;

  isPaused = !isPaused;
  const pauseBtn = document.getElementById('mobile-pause');
  
  // Immediate visual feedback
  if (isPaused) {
    pauseBtn.textContent = '▶';
    disableScroll();
    renderer.setAnimationLoop(null);
  } else {
    pauseBtn.textContent = '⏸';
    enableScroll();
    lastTime = performance.now();
    renderer.setAnimationLoop(animation);
  }
  
  // Force immediate UI update
  void pauseBtn.offsetWidth;
}

function updateBestScore() {
  bestScore = parseInt(localStorage.getItem("bestScore")) || 0;
}

function updateRendererSize() {
  const aspect = window.innerWidth / window.innerHeight;
  const width = 10;
  const height = width / aspect;

  camera.left = width / -2;
  camera.right = width / 2;
  camera.top = height / 2;
  camera.bottom = height / -2;

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener("resize", updateRendererSize);

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

  const scrollAmount = event.deltaY * 0.05;
  camera.position.y -= scrollAmount;

  // Restrict camera's vertical movement within reasonable bounds
  camera.position.y = Math.max(4, Math.min(stack.length * boxHeight + 4, camera.position.y));

  renderer.render(scene, camera);
}

function onArrowKey(event) {
  if (!gameEnded) return;

  let scrollAmount = 0.5;
  if (event.key === "ArrowUp") {
    camera.position.y += scrollAmount;
  } else if (event.key === "ArrowDown") {
    camera.position.y -= scrollAmount;
  }

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
    shapes: ['circle', 'square', 'star'],
    zIndex: 9999
  });
}

function highlightBestScore(isFirstGame) {
  const highlightDuration = 3000; // Duration in milliseconds (3 seconds)

  bestScoreElement.style.transition = 'all 0.3s ease-in-out';
  bestScoreElement.style.transform = 'scale(1.2)';
  bestScoreElement.style.color = '#FFD700'; // Gold color
  bestScoreElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';

  if (isFirstGame) {
    bestScoreElement.textContent = 'Best Score: ' + bestScore;
  } else {
    bestScoreElement.textContent = 'New Best Score: ' + bestScore;
  }

  setTimeout(() => {
    bestScoreElement.style.transition = 'all 0.3s ease-in-out';
    bestScoreElement.style.transform = 'scale(1)';
    bestScoreElement.style.color = ''; // Reset to default color
    bestScoreElement.style.textShadow = '';
    bestScoreElement.textContent = 'Best Score: ' + bestScore;
  }, highlightDuration);
}
