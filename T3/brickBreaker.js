import * as THREE from "three";
import {
  initRenderer,
  onWindowResize,
  SecondaryBox,
} from "../libs/util/util.js";
import { CSG } from "../libs/other/CSGMesh.js";
import { OBJLoader } from "../build/jsm/loaders/OBJLoader.js";
import { OrbitControls } from "../build/jsm/controls/OrbitControls.js";
import { TertiaryBox } from "./util.js";

let scene, renderer, camera, directionalLight;
scene = new THREE.Scene();
scene.background = new THREE.Color("black");

renderer = initRenderer();

camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const controls = new OrbitControls(camera, renderer.domElement);
window.addEventListener(
  "resize",
  function () {
    onWindowResize(camera, renderer);
  },
  false
);
controls.enabled = false;

camera.position.z = 4.2;
camera.position.y = -6.46;
const target = new THREE.Vector3(0, -2.2, -1.6); // Ponto para o qual a câmera olhará
camera.lookAt(target);

directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, -6, 4);
directionalLight.castShadow = true;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// Create auxiliary info box and listeners
window.addEventListener(
  "resize",
  function () {
    onWindowResize(camera, renderer);
  },
  false
);
window.addEventListener("mousemove", onMouseMove);

// -- Create raycaster
let raycaster = new THREE.Raycaster();
raycaster.layers.enable(0);
camera.layers.enable(0);

const objects = [];
let plane,
  planeGeometry,
  planeMaterial,
  intersectionBall,
  ballDirection,
  ballSpeed;

let initialBallSpeed = 0.05;
const maxBallSpeed = initialBallSpeed * 2;
const speedIncreaseRate = (maxBallSpeed - initialBallSpeed) / (15 * 60);

let hitter = new THREE.Mesh();
let isSimulationPaused = false;
const removedRectangles = [];
let isMouseClick = false;
let follow = true;
let levelUp = false;
let hasCollidedThisFrame = false;
let lifes = 5;

const rebatedorSound = new Audio("../assets/sounds/rebatedor.mp3");
rebatedorSound.preload = "auto";
const bloco1Sound = new Audio("../assets/sounds/bloco1.mp3");
bloco1Sound.preload = "auto";
const bloco2Sound = new Audio("../assets/sounds/bloco2.mp3");
bloco2Sound.preload = "auto";

let powerUp = new THREE.Mesh(
  new THREE.CylinderGeometry(0.26, 0.26, 0.2, 20),
  new THREE.MeshPhongMaterial({ color: 0x8103a0 })
);
powerUp.castShadow = true;
scene.add(powerUp);
powerUp.visible = false;

const textureLoader = new THREE.TextureLoader();
const brickTexture = textureLoader.load(
  "../assets/textures/stone.jpg",
  function (texture) {
    // Callback chamado quando a textura é carregada com sucesso
    console.log("Textura carregada com sucesso!");
  },
  undefined,
  function (error) {
    // Callback chamado se houver um erro no carregamento da textura
    console.error("Erro ao carregar a textura:", error);
  }
);
const fighterTexture = textureLoader.load(
  "../assets/fighter_texture.jpg",
  function (texture) {
    // Callback chamado quando a textura é carregada com sucesso
    console.log("Textura carregada com sucesso!");
  },
  undefined,
  function (error) {
    // Callback chamado se houver um erro no carregamento da textura
    console.error("Erro ao carregar a textura:", error);
  }
);

let currentPhase = 1;

const infoMessage = new SecondaryBox();
const lifeBar = new TertiaryBox();

document.addEventListener("mousedown", () => {
  isMouseClick = true;
  follow = false;
});

document.addEventListener("keydown", (event) => {
  const key = event.key;

  switch (key) {
    case "r":
      lifes = 5;
      rebuildInitialState();
      break;
    case " ":
      controlPauseSimulation();
      break;
    case "Enter":
      alternarModoFullscreen();
      break;
    case "g":
      currentPhase = currentPhase === 1 ? 2 : currentPhase === 2 ? 3 : 1;
      buildRectanglesForPhase();
      levelUp = true;
      break;
    case "o":
      controlPauseSimulation();
      orbitControl();
      break;
    default:
      break;
  }
});
const builtRectangles = [];

const objPath = "../assets/fighter.obj";
const texturePath = "../assets/fighter_texture.jpg";

buildSkybox();
buildPlane();
buildWalls();
buildHitter();
buildBall();
buildRectanglesForPhase();
startBallMovement();

//-- Functions --------------------------------------------------------------

function buildSkybox() {
  const path = "../assets/";
  const format = ".png";
  const urls = [
    path + "sp2_ft" + format,
    path + "sp2_bk" + format,
    path + "sp2_up" + format,
    path + "sp2_dn" + format,
    path + "sp2_rt" + format,
    path + "sp2_lf" + format,
  ];
  // Setting the two cube maps, one for refraction and one for reflection
  let cubeMapTexture = new THREE.CubeTextureLoader().load(urls);

  // Create the main scene and Set its background as a cubemap (using a CubeTexture)
  scene.background = cubeMapTexture;

  //render();
}

function buildRectanglesForPhase() {
  // Remove existing rectangles from the scene and reset the arrays
  for (const rectangle of builtRectangles) {
    scene.remove(rectangle);
  }
  builtRectangles.length = 0;
  removedRectangles.length = 0;

  if (currentPhase === 1) {
    const numRows = 6;
    const numColumns = 11;
    const rectangleSpacing = 0.03;

    const colors = ["gray", "red", "blue", "yellow", "pink", "green"];

    const rectangleWidth = 0.5;
    const rectangleHeight = 0.3;

    for (let row = 0; row < numRows; row++) {
      for (let column = 0; column < numColumns; column++) {
        // Determine the color of the rectangle and the hit count
        const rectangleColor = colors[row];
        const hitCount = rectangleColor === "gray" ? 2 : 1;
        const soundToPlay = rectangleColor === "gray" ? "2" : "1";
        const material = new THREE.MeshLambertMaterial({
          color: rectangleColor,
        });
        let rectangle = null;

        if (rectangleColor === "gray") {
          rectangle = new THREE.Mesh(
            new THREE.BoxGeometry(rectangleWidth, rectangleHeight, 0.2),
            new THREE.MeshLambertMaterial({
              map: brickTexture, // Aplica a textura ao material do bloco
            })
          );
        } else {
          rectangle = new THREE.Mesh(
            new THREE.BoxGeometry(rectangleWidth, rectangleHeight, 0.2),
            material
          );
        }

        // Calculate the position of the rectangle and set user data
        const offsetX =
          column * (rectangleWidth + rectangleSpacing) -
          ((numColumns - 1) * (rectangleWidth + rectangleSpacing)) / 2;
        const offsetY =
          (numRows / 2 - row - 1) * (rectangleHeight + rectangleSpacing) +
          rectangleHeight / 4;

        rectangle.userData = { hitCount, soundToPlay };

        rectangle.position.set(offsetX, offsetY, 0.02);
        rectangle.castShadow = true;
        scene.add(rectangle);
        builtRectangles.push(rectangle);
      }
    }
  } else if (currentPhase === 2) {
    const numRows = 14;
    const numColumns = 4;
    const spacing = 0.1;

    const rectangleWidth = 0.52;
    const rectangleHeight = 0.29;

    const colors = ["gray", "red", "blue", "yellow", "pink", "green"];
    const usedColors = new Set();

    for (let grid = 0; grid < 2; grid++) {
      for (let row = 0; row < numRows; row++) {
        for (let column = 0; column < numColumns; column++) {
          // Select a color for the rectangle, ensuring variety
          let availableColors = colors.filter(
            (color) => !usedColors.has(color)
          );

          if (availableColors.length === 0) {
            usedColors.clear();
            availableColors = colors;
          }

          const randomColorIndex = Math.floor(
            Math.random() * availableColors.length
          );
          const rectangleColor = availableColors[randomColorIndex];
          usedColors.add(rectangleColor);

          // Determine the hit count and create the rectangle
          const hitCount = rectangleColor === "gray" ? 2 : 1;
          const soundToPlay = rectangleColor === "gray" ? "2" : "1";
          let rectangle = null;

          if (rectangleColor === "gray") {
            rectangle = new THREE.Mesh(
              new THREE.BoxGeometry(rectangleWidth, rectangleHeight, 0.2),
              new THREE.MeshLambertMaterial({
                map: brickTexture, // Aplica a textura ao material do bloco
              })
            );
          } else {
            rectangle = new THREE.Mesh(
              new THREE.BoxGeometry(rectangleWidth, rectangleHeight, 0.2),
              new THREE.MeshLambertMaterial({ color: rectangleColor })
            );
          }

          rectangle.castShadow = true;

          // Calculate the position of the rectangle based on the grid
          const offsetX =
            column * (rectangleWidth + spacing) -
            ((numColumns - 1) * (rectangleWidth + spacing)) / 2;
          const offsetY =
            (numRows / 2 - row - 1) * (rectangleHeight + spacing) +
            rectangleHeight / 4;

          if (grid === 0) {
            rectangle.position.set(offsetX - 2.0, offsetY, 0.2);
          } else {
            rectangle.position.set(offsetX + 2.0, offsetY, 0.2);
          }

          rectangle.userData = { hitCount, soundToPlay };

          scene.add(rectangle);
          builtRectangles.push(rectangle);
        }
      }
    }
  } else if (currentPhase === 3) {
    const layoutHelper = [
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "#", "p", "#", "p", "#", "p", "#", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
      ["b", " ", "#", " ", "#", " ", "#", " ", "#", " ", "b"],
      ["b", " ", "r", " ", "g", " ", "g", " ", "r", " ", "b"],
    ];

    const numRows = layoutHelper.length;
    const numColumns = layoutHelper[0].length;
    const rectangleWidth = 0.5;
    const rectangleHeight = 0.3;
    const spacing = 0.1;

    const colorsMap = {
      b: "blue",
      r: "red",
      g: "green",
      p: "pink",
      "#": "gold",
    };

    for (let row = 0; row < numRows; row++) {
      for (let column = 0; column < numColumns; column++) {
        const layoutCell = layoutHelper[row][column];
        const rectangleColor = colorsMap[layoutCell] || "transparent";

        if (layoutCell !== " ") {
          const hitCount = rectangleColor === "gold" ? -1 : 1;
          const soundToPlay = rectangleColor === "gold" ? "2" : "1";
          const material = new THREE.MeshLambertMaterial({
            color: rectangleColor,
          });
          const rectangle = new THREE.Mesh(
            new THREE.BoxGeometry(rectangleWidth, rectangleHeight, 0.2),
            material
          );

          const offsetX =
            column * (rectangleWidth + spacing) -
            ((numColumns - 1) * (rectangleWidth + spacing)) / 2;
          const offsetY =
            (numRows / 2 - row - 1) * (rectangleHeight + spacing) +
            rectangleHeight / 4;

          rectangle.userData = { hitCount, soundToPlay };

          rectangle.position.set(offsetX, offsetY, 0.02);
          rectangle.castShadow = true;
          scene.add(rectangle);
          builtRectangles.push(rectangle);
        }
      }
    }
  }
}

function checkIfGameIsOver() {
  if (builtRectangles.length === removedRectangles.length) {
    currentPhase = currentPhase === 1 ? 2 : 1;
    buildRectanglesForPhase();
    levelUp = true;
  }
}

function rebuildInitialState() {
  intersectionBall.position.set(0, -4.7, 0);
  follow = true;
  isMouseClick = false;
  ballDirection = new THREE.Vector3(); // Direção inicial da bola
  ballDirection.set(Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0); // Define a direção inicial da bolinha

  for (const rectangle of removedRectangles) {
    scene.add(rectangle);
  }

  removedRectangles.length = 0;
}

function controlPauseSimulation() {
  if (isSimulationPaused) {
    isSimulationPaused = false;
    window.addEventListener("mousemove", onMouseMove);
  } else {
    isSimulationPaused = true;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mousedown", onMouseDown);
  }
}

function onMouseDown() {
  if (!isSimulationPaused) {
    isMouseClick = true;
    follow = false;
  }
}

function orbitControl() {
  if (controls.enabled) {
    controls.enabled = false;

    camera.position.z = 4.2;
    camera.position.y = -6.46;
    camera.position.x = 0;
    const target = new THREE.Vector3(0, -2.2, -1.6); // Ponto para o qual a câmera olhará
    camera.lookAt(target);
  } else {
    controls.enabled = true;
  }
}

function alternarModoFullscreen() {
  const element = document.documentElement;

  if (
    !document.fullscreenElement &&
    !document.mozFullScreenElement &&
    !document.webkitFullscreenElement
  ) {
    if (element.requestFullscreen) {
      element.requestFullscreen();
    } else if (element.mozRequestFullScreen) {
      element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}

function buildPlane() {
  planeGeometry = new THREE.PlaneGeometry(7.8, 13.7);
  planeMaterial = new THREE.MeshLambertMaterial();
  planeMaterial.side = THREE.DoubleSide;
  planeMaterial.transparent = true;
  planeMaterial.opacity = 0.9;
  plane = new THREE.Mesh(planeGeometry, planeMaterial);
  scene.add(plane);
  objects.push(plane); // List of objects to be checked by raycaster

  plane = objects[0];
  plane.position.set(0, 0, 0);
  plane.receiveShadow = true;
  plane.layers.set(0);
  plane.material.color.set("#2e2e2e");
}

function buildWalls() {
  var geometryS = new THREE.BoxGeometry(0.2, 13.7, 0.2);
  var geometryT = new THREE.BoxGeometry(7.6, 0.2, 0.2);
  const leftWall = new THREE.Mesh(
    geometryS,
    new THREE.MeshPhongMaterial({ color: "white" })
  );
  leftWall.castShadow = true;
  leftWall.receiveShadow = false;
  plane.add(leftWall);
  leftWall.position.set(-3.7, 0, 0.2);

  const rightWall = new THREE.Mesh(
    geometryS,
    new THREE.MeshPhongMaterial({ color: "white" })
  );
  rightWall.castShadow = true;
  plane.add(rightWall);
  rightWall.position.set(3.7, 0, 0.2);

  const topWall = new THREE.Mesh(
    geometryT,
    new THREE.MeshPhongMaterial({ color: "white" })
  );
  topWall.castShadow = true;
  plane.add(topWall);
  topWall.position.set(0, 6.8, 0.2);
}

function buildHitter() {
  let auxMat = new THREE.Matrix4();

  let cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2.3));
  let cylinderMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 0.3, 25)
  );

  let csgObject, cubeCSG, cylinderCSG;

  // Object hitter - Cylinder SUBTRACT Cube
  cubeMesh.position.set(1, -0.5, 0.5);
  updateObject(cubeMesh);
  cubeCSG = CSG.fromMesh(cubeMesh);
  cylinderCSG = CSG.fromMesh(cylinderMesh);
  csgObject = cylinderCSG.subtract(cubeCSG);
  hitter = CSG.toMesh(csgObject, auxMat);
  hitter.material = new THREE.MeshLambertMaterial({ map: fighterTexture });
  hitter.position.set(0, -6, 0.2);
  hitter.rotation.x = Math.PI / 2;

  scene.add(hitter);
  hitter.castShadow = true;
  hitter.receiveShadow = true;

  //////////////////////////////////////

  const objLoader = new OBJLoader();
  objLoader.load(
    objPath,
    (spaceship) => {
      // O objeto foi carregado com sucesso

      // Função para aplicar a textura ao objeto
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        texturePath,
        (texture) => {
          const material = new THREE.MeshBasicMaterial({ map: texture });

          // Aplicando o material ao objeto carregado
          spaceship.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = material;
            }
          });

          // Definindo a posição do objeto no espaço 3D
          spaceship.position.set(0, -0.1, -0.2); // Substitua pelos valores desejados
          spaceship.scale.set(0.5, 0.5, 0.5);
          spaceship.rotation.x = Math.PI / 2;
          spaceship.rotation.y = Math.PI;

          hitter.add(spaceship);
          spaceship.castShadow = true;
          spaceship.receiveShadow = true;

          // Função de animação para renderizar a cena (como nos exemplos anteriores)
          function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
          }

          // Chamada inicial da função de animação
          animate();
        },
        undefined,
        (error) => {
          // Tratamento de erros ao carregar a textura
          console.error("Erro ao carregar a textura", error);
        }
      );
    },
    undefined,
    (error) => {
      // Tratamento de erros, caso ocorra algum durante o carregamento
      console.error("Erro ao carregar o objeto 3D", error);
    }
  );
}

function updateObject(mesh) {
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
}

function buildBall() {
  intersectionBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 20, 20),
    new THREE.MeshPhongMaterial({ color: "blue" })
  );
  intersectionBall.castShadow = true;
  scene.add(intersectionBall);
  intersectionBall.position.set(0, -5, 0.2);
}

function followHitter() {
  const posicaoDestino = new THREE.Vector3();
  posicaoDestino.copy(hitter.position);
  intersectionBall.position.copy(posicaoDestino);
  intersectionBall.position.y += 1.2;
}

function onMouseMove(event) {
  let pointer = new THREE.Vector2();
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  let intersects = raycaster.intersectObjects(objects);

  if (intersects.length > 0) {
    let point = intersects[0].point;
    hitter.visible = true;
    if (point.x < -2.9) {
      hitter.position.x = -2.9;
    } else if (point.x > 2.9) {
      hitter.position.x = 2.9;
    } else {
      hitter.position.set(point.x, -6, 0.2);
    }
  }
}

function startBallMovement() {
  ballSpeed = initialBallSpeed;
  ballDirection = new THREE.Vector3(); // Direção inicial da bola
  ballDirection.set(Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0);
  intersectionBall.position.set(0, -4, 0.2); // Posição inicial da bola
  render();
}

function checkBallPosition() {
  if (ballSpeed < maxBallSpeed) ballSpeed += speedIncreaseRate;

  const ballGeometry = intersectionBall.geometry;
  const ballRadius = ballGeometry.parameters.radius;
  if (intersectionBall.position.y <= -7 + ballRadius || levelUp) {
    scene.remove(intersectionBall);
    buildBall();
    isMouseClick = false;
    follow = true;
    ballDirection.set(Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0);
    ballSpeed = initialBallSpeed;
    levelUp = false;
    lifes--;
  }
}

function updateBallPosition() {
  intersectionBall.position.lerp(
    intersectionBall.position.clone().add(ballDirection),
    ballSpeed
  );
}

function checkWallCollisions() {
  const ballGeometry = intersectionBall.geometry;
  const ballRadius = ballGeometry.parameters.radius;
  if (
    intersectionBall.position.x <= -3.49 + ballRadius ||
    intersectionBall.position.x >= 3.49 - ballRadius
  ) {
    ballDirection.x *= -1; // Inverter a direção na colisão com as paredes laterais
  }

  if (intersectionBall.position.y >= 6.6 - ballRadius) {
    ballDirection.y *= -1; // Inverter a direção na colisão com a parede superior
  }
}

function checkHitterCollisions() {
  const ballBoundingSphere = new THREE.Sphere(intersectionBall.position, 0.15);
  const hitterBoundingSphere = new THREE.Sphere(hitter.position, 0.8);

  const distance = ballBoundingSphere.center.distanceTo(
    hitterBoundingSphere.center
  );
  const sumRad = ballBoundingSphere.radius + hitterBoundingSphere.radius;

  if (distance <= sumRad) {
    const normal = new THREE.Vector3()
      .subVectors(ballBoundingSphere.center, hitterBoundingSphere.center)
      .normalize();

    const reflectionVector = new THREE.Vector3()
      .copy(ballDirection)
      .reflect(normal);

    ballDirection.copy(reflectionVector).normalize();
    rebatedorSound.currentTime = 0;
    rebatedorSound
      .play()
      .catch((error) => console.error("Erro ao reproduzir o som:", error));

    const penetrationDepth = sumRad - distance;
    const correctionVector = normal.clone().multiplyScalar(penetrationDepth);
    intersectionBall.position.add(correctionVector);

    updateBallPosition();
  }
}

function checkRectangleCollisions() {
  const rectangleWidth = 0.5;
  const rectangleHeight = 0.2;
  const ballGeometry = intersectionBall.geometry;
  const ballRadius = ballGeometry.parameters.radius;

  scene.children.forEach((object) => {
    if (
      object.type === "Mesh" &&
      object !== plane &&
      object !== intersectionBall &&
      object !== hitter &&
      object !== powerUp
    ) {
      const rectPosition = object.position.clone();
      const rectHalfWidth = rectangleWidth / 2;
      const rectHalfHeight = rectangleHeight / 2;

      // Calcula a distância entre o centro do retangulo e a bola nas direções X e Y
      const dx = Math.abs(intersectionBall.position.x - rectPosition.x);
      const dy = Math.abs(intersectionBall.position.y - rectPosition.y);

      // Calcula a soma dos raios da bola e do retangulo
      const combinedRadius =
        ballRadius + Math.max(rectHalfWidth, rectHalfHeight);

      // Verifica se houve uma colisão e se não houve outra colisão neste frame
      if (
        dx <= combinedRadius &&
        dy <= combinedRadius &&
        !hasCollidedThisFrame
      ) {
        // Determina a direção da colisão
        const overlapX = combinedRadius - dx;
        const overlapY = combinedRadius - dy;

        if (overlapX > overlapY) {
          // Colisão vertical (cima ou baixo)
          if (intersectionBall.position.y < rectPosition.y) {
            ballDirection.y = -Math.abs(ballDirection.y);
            intersectionBall.position.y = rectPosition.y - combinedRadius;
          } else {
            ballDirection.y = Math.abs(ballDirection.y);
            intersectionBall.position.y = rectPosition.y + combinedRadius;
          }
        } else {
          // Colisão horizontal (esquerda ou direita)
          if (intersectionBall.position.x < rectPosition.x) {
            ballDirection.x = -Math.abs(ballDirection.x);
            intersectionBall.position.x = rectPosition.x - combinedRadius;
          } else {
            ballDirection.x = Math.abs(ballDirection.x);
            intersectionBall.position.x = rectPosition.x + combinedRadius;
          }
        }

        if (object.userData.hitCount > 1) {
          object.material.map = null;
          object.material.needsUpdate = true;
          object.userData.hitCount -= 1;
        } else if (object.userData.hitCount === 1) {
          scene.remove(object);
          removedRectangles.push(object);
          if (removedRectangles.length % 10 == 0) {
            criaPowerUp();
          }
        }

        if (object.userData.soundToPlay === "1") {
          bloco1Sound.currentTime = 0;
          bloco1Sound
            .play()
            .catch((error) =>
              console.error("Erro ao reproduzir o som:", error)
            );
        } else if (object.userData.soundToPlay === "2") {
          bloco2Sound.currentTime = 0;
          bloco2Sound
            .play()
            .catch((error) =>
              console.error("Erro ao reproduzir o som:", error)
            );
        }

        hasCollidedThisFrame = true;
      }
    }
  });

  checkIfGameIsOver();

  // Redefine a variável de controle para o próximo frame
  hasCollidedThisFrame = false;
}

function criaPowerUp() {
  powerUp.position.set(0, -1, 0.3);
  powerUp.rotation.z = Math.PI / 9;
  powerUp.rotation.y = Math.PI / 2;
  powerUp.visible = true;
  movimentaPowerUp();
}

function movimentaPowerUp() {
  requestAnimationFrame(movimentaPowerUp);

  powerUp.position.y -= 0.01;

  if (
    (powerUp.position.y < hitter.position.y + 1.4 &&
      powerUp.position.x < hitter.position.x + 1 &&
      powerUp.position.x > hitter.position.x - 1) ||
    powerUp.position.y < -7
  ) {
    powerUp.visible = false;
    powerUp.position.y = -5;
  }
}

function checkLife() {
  if (lifes === 0) {
    lifes = 5;
    rebuildInitialState();
  }
}

function render() {
  if (isSimulationPaused) {
    requestAnimationFrame(render);
    renderer.render(scene, camera);
    return;
  }

  if (follow) followHitter();

  if (isMouseClick) {
    follow = false;
    checkBallPosition();
    updateBallPosition();
    checkWallCollisions();
    checkHitterCollisions();
    checkRectangleCollisions();
    checkLife();
  }

  infoMessage.changeMessage(`Ball speed: ${ballSpeed.toFixed(4)}`);
  lifeBar.changeMessage("\u2764\uFE0F".repeat(lifes));

  requestAnimationFrame(render);
  renderer.render(scene, camera);
}
