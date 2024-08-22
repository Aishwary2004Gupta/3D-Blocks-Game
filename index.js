import * as THREE from "three";

const scene = new THREE.Scene();

//cube 
const geometry = new THREE.BoxGeometry(4, 1, 4);
const material = new THREE.MeshLambertMaterial({ color: 0x00fD00 });
const mesh = new THREE.Mesh(geometry, material);
mesh.position.set(0, 0, 0);
scene.add(mesh);

//lights


