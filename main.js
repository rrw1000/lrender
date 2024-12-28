import * as THREE from 'three'

var globalScene = undefined;
const canvas = document.querySelector('#c');
const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);

var DEPTH = 5;
var CURVE = "hilbert";
var ROTATION_SPEED = 0.005;
var ISTHREED = true;
var ZOOM = 1.0;
//var RULES = {}
var RULE_SET = {
  "hilbert": { "S": "A",  "B": "-AF+BFB+FA-", "A": "+BF-AFA-FB+", "C" : "+F+F+F+" },
  "cantor": { "S": "A", "A" : "AFBFA", "B": "BFBFBF" },
  "koch" : { "S": "A", "A" : "FA+FA-FA-FA+FA" },
  "sierpinski": { "S": "A",  "A" : "AF-BF+AF+BF-AF", "B": "BFBF" },
  "simple" : {"S": "A+A+A", "A": "FA-FA+FA" }
}


function setCompiledExpression(expr) {
  var textArea = document.querySelector("#compiled");
  textArea.value = expr
}

function changeCurve(val) {
  var textArea = document.querySelector("#rules")
  if (val == "USER") {
    console.log(textArea.innerText);
    try {
      RULE_SET["user"] = JSON.parse(textArea.value);
      CURVE = "user"
      renderCurve();
    } catch (e) {
      alert(`Cannot load user rules - ${e}`);
    }
  } else {
    CURVE = val;
    textArea.value = JSON.stringify(RULE_SET[CURVE]);
    renderCurve();
  }
}

// Wire up the UI
var curves = document.querySelectorAll(".set-curve");
for (var elem of curves) {
  elem.addEventListener("change", (event) => {
    console.log(event.target.value)
    changeCurve(event.target.value);
  });
}

var load = document.querySelector("#load-button");
load.addEventListener("click", (event) => {
  console.log("User mode");
  changeCurve("USER");
});

var recursionElem = document.querySelector("#recursion-depth");
recursionElem.addEventListener("input", (event) => {
  var recursionValue = parseInt(event.target.value)
  if (!isNaN(recursionValue)) {
    DEPTH = recursionValue;
    renderCurve();
  }
});

var rotationElem = document.querySelector("#rotation-speed");
rotationElem.addEventListener("input", (event) => {
  var rotationValue = parseFloat(event.target.value);
  if (!isNaN(rotationValue)) {
    ROTATION_SPEED = rotationValue;
  }
});

var threedElem = document.querySelector("#threed");
threedElem.addEventListener("change", () => {
  ISTHREED = threedElem.checked;
  renderCurve();
})

var anglesElem= document.querySelector("#angles");
anglesElem.addEventListener("input", (event) => {
  var angles = event.target.value.split(",");
  try {
    if (angles.length == 3) {
      var x = parseFloat(angles[0]);
      var y = parseFloat(angles[1]);
      var z = parseFloat(angles[2]);
      console.log(`Angles  ${x} ${y} ${z}`);
      topLevelGroup.rotation.x = x;
      topLevelGroup.rotation.y = y;
      topLevelGroup.rotation.z = z;
    }
  } catch (e) {
    alert(`Invalid angles - ${angles}`);
  }
});

var zoomElem= document.querySelector("#zoom");
zoomElem.addEventListener("input", (event) => {
  var zoom = parseFloat(event.target.value);
  if (!isNaN(zoom)) {
    ZOOM = zoom;
    renderCurve();
  }
});

var THICKNESS = 0.1;
// Directions, indexed clockwise
var DIRECTIONS = [ [0.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.0, -1.0, 0.0], [-1.0, 0.0, 0.0] ];
// Scale, indexed clockwise
var SCALES = [ [THICKNESS, 1.0, THICKNESS], [1.0, THICKNESS, THICKNESS], [THICKNESS, 1.0, THICKNESS], [1.0, THICKNESS, THICKNESS] ];

var groupStack = [ ];

var topGroup = new THREE.Group();
groupStack.push(topGroup);

function applyRules(expr, depth, rules, maxdepth) {
  let result = "";
  if (depth == maxdepth) {
    return expr;
  }
  for (let cur of expr) {
    if (rules[cur] === undefined) {
      result += cur;
    } else {
      result += "(" + applyRules(rules[cur], depth+1, rules, maxdepth) + ")";
    }
  }
  return result;
}


function goGeometry(expr, d, p, s) {
  var direction = d;
  var position = p;
  var scale = s;
  for (let cur of expr) {
    [direction, position, scale] = nextGeometry(cur, direction, position, scale);
  }
}

function nextGeometry(expr, direction, position, scale) {
  // We start at 0,0.
  let here = expr.charAt(0);
  // console.log("char - " + here);
  let newDirection = direction;
  let newPosition = position;
  switch (here) {
  case '+': // Turn 90 degrees clockwise
    newDirection = (direction + 1)%4;
    break;
  case '-': // 90 degrees anticlockwise
    if (direction == 0) {
      newDirection = 3;
    } else {
      newDirection = direction-1;
    }
    break;
  case '(':
    /* open a group */
    var newGroup= new THREE.Group();

    if (ISTHREED) {
      newGroup.rotation.x = groupStack.slice(-1)[0].rotation.x + 0.03;
    } else {
      newGroup.rotation.x = groupStack.slice(-1)[0].rotation.x;
    }
    groupStack.push(newGroup);
    break;
  case ')':
    /* pop a group and add it to its parent */
    let lastGroup = groupStack.pop();
    groupStack.slice(-1)[0].add(lastGroup);
    break;
  case 'F':
    // Start with a cube
    let geom = new THREE.BoxGeometry(1,1,1);
    let scaleVec = SCALES[direction];
    const theDirection = DIRECTIONS[direction]
    console.log("position = " + position + " dir " + direction +  " scale " + (scaleVec[0]*scale) + "," + (scaleVec[1]*scale) + "," + (scaleVec[2]*scale));
    geom.translate(0.5, 0.5, 0.0);
    geom.scale( scaleVec[0] * scale, scaleVec[1] * scale, scaleVec[2] * scale);
    if (theDirection[0] < 0) {
      console.log("Rx");
      geom.rotateY(Math.PI);
    } else {
      geom.translate(-scale*THICKNESS, 0.0, 0.0)
    }
    if (theDirection[1] < 0) {
      console.log("Ry");
      geom.rotateX(Math.PI);
    } else {
      geom.translate(0.0, -scale*THICKNESS, 0.0)
    }

    if (theDirection[2] < 0) {
      console.log("Rz");
      geom.rotateZ(Math.PI);
    }

    geom.translate( position[0], position[1], position[2] )
    let r = 0.5 + position[1]/8;
    let g = 0.6 + position[0]/8;
    let b = 0.4 + (0.2*direction);
    let color = new THREE.Color().setRGB(r,g,b);
   // MeshBasicMaterial
    let material = new THREE.MeshStandardMaterial( {emissive: color, metalness: 0.8, roughness: 0.0}  )
    let cube = new THREE.Mesh(geom, material);
    groupStack.slice(-1)[0].add(cube);
    newPosition = [ position[0] + scale*DIRECTIONS[direction][0], position[1] + scale*DIRECTIONS[direction][1], position[2] + scale*DIRECTIONS[direction][2] ];
    break;
  default:
    // Everything else is ignored.
    break;
  }
  return [ newDirection, newPosition, scale ];
}


var topLevelGroup = undefined;
//const geometry = new THREE.BoxGeometry(1,1,1);
const MATERIAL = new THREE.MeshBasicMaterial(  { color: 0x00ff00 } );
// const cube = new THREE.Mesh(geometry, material);
//scene.add(cube);
camera.position.z = 1.75;

var expression = "+BF-AFA-FB+";


function renderCurve() {
  let curveName=  CURVE;
  let renderDepth = DEPTH;
  let TEST1 = "-+F-F-F+F+(-F+F+F-)F(-F+F+F-)+F(+F-F-F+)-";
  let theRules = RULE_SET[curveName];
  let applied = applyRules(theRules["S"], 0, theRules, renderDepth);
  setCompiledExpression(applied);
  //console.log("Applied " + applied);

  const drawScale = 0.6/(2.0*DEPTH);
  console.log("drawScale = " + drawScale);
  groupStack.push(new THREE.Group());
  goGeometry( applied, 0, [ 0.0, 0.0, 0.0 ] , drawScale);

  var topLevel = groupStack.slice(-1)[0]
  const groupBoundingBox = new THREE.Box3();
  groupBoundingBox.setFromObject(topLevel, true);
  const groupSize = new THREE.Vector3();
  groupBoundingBox.getSize(groupSize);
  let middle =new THREE.Vector3();
  groupBoundingBox.getCenter(middle);
  console.log("middle = " + JSON.stringify(middle));
  var nextUp = new THREE.Group();
  nextUp.add(topLevel);
  var zScale = 1.0;
  if (ISTHREED) {
    zScale = 1.0/groupSize.z;
  }
  topLevel.scale.set( ZOOM/groupSize.x, ZOOM/groupSize.y, ZOOM * zScale );
  topLevel.position.x -= middle.x*(1.0/groupSize.x);
  topLevel.position.y -= middle.y*(1.0/groupSize.y);
  globalScene = new THREE.Scene();
  topLevelGroup = nextUp;
  globalScene.add(nextUp)
}

function animate() {
  if (topLevelGroup !== undefined) {
    topLevelGroup.rotation.x += ROTATION_SPEED;
    topLevelGroup.rotation.y += ROTATION_SPEED;
    topLevelGroup.rotation.z += ROTATION_SPEED;
    renderer.render( globalScene, camera );
  }
  if (resizeRenderer(renderer)) {
    const canvas = renderer.domElement;
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }
}

function resizeRenderer(renderer) {
  const canvas = renderer.domElement;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== width || canvas.height !== height) {
    renderer.setSize(width, height, false);
    return true;
  } else {
    return false;
  }
}

changeCurve("hilbert");
renderer.setAnimationLoop(animate);

