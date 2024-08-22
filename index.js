import * as THREE from "three";

const scene = new THREE.Scene();

//cube 
const geometry = new THREE.BoxGeometry(4, 1, 4);
const material = new THREE.MeshLambertMaterial({ color: 0x00fD00 });
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 0, 0);
scene.add(mesh);

//lights
const ambient = new THREE.AmbientLight(0xfffff, 0.6);
scene.add(ambient);

const directional = new THREE.DirectionalLight(0xfffff, 0.6);
directional.position.set(10, 15, 0); //y direction is the brightest
scene.add(directional); //acts like the sun

//camera (orthographic projections)
const width = 10;
const height = width / (window.innerWidth / window.innerHeight);
const camera = new THREE.OrthographicCamera(
  width / -2,
  width / 2,
  height / 2,
  height / -2,
  1, //near
  1000 //far
);

camera.position.set(10, 10, 10);
camera.lookAt(0, 0, 0); //not the position but the direction that matters here

//renderer
const renderer = new THREE.WebGLRenderer( {antialias: true} );
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.render(scene, camera)

//adding it to the HTML
document.body.appendChild(renderer.domElement);

