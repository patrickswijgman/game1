import { addVector, addVectorScaled, applyCameraTransform, copyVector, delta, drawRect, drawSprite, drawText, fps, getRandomId, getRandomIntInRange, getTexture, getVectorDistance, InputCode, isInputDown, isInputPressed, isRectangleValid, loadRenderTexture, loadSprite, loadTexture, normalizeVector, rect, Rectangle, remove, resetTimer, resetTransform, resetVector, rotateTransform, run, scaleTransform, scaleVector, setCamera, tickTimer, timer, Timer, translateTransform, tween, updateCamera, vec, Vector, writeIntersectionBetweenRectangles } from "ridder";
import { loadFlashTexture, loadOutlineTexture, repeat } from "./engine.ts";

const DEBUG = false;
const WIDTH = 320;
const HEIGHT = 180;
const PLAYER_SPEED = 1.125;
const PLAYER_RANGE = 10;
const PLAYER_INTERACT_TIME = 200;
const ITEM_SEEK_TIME = 200;
const ITEM_SEEK_DELAY = 500;

enum Type {
  NIL = "",
  PLAYER = "player",
  TREE = "tree",
  ROCK = "rock",
  ITEM_TWIG = "item_twig",
}

enum State {
  NIL = "",
  PLAYER_CONTROL = "player_control",
  PLAYER_INTERACT = "player_interact",
  ITEM_IDLE = "item_idle",
  ITEM_SEEK = "item_seek",
  TREE_IDLE = "tree_idle",
}

type Entity = {
  id: string;
  type: Type;
  state: State;
  pos: Vector;
  vel: Vector;
  start: Vector;
  body: Rectangle;
  bodyOffset: Vector;
  intersection: Vector;
  spriteId: string;
  pivot: Vector;
  offset: Vector;
  angle: number;
  scale: number;
  timer: Timer;
  delay: Timer;
  isRigid: boolean;
  isFlipped: boolean;
  isInteractable: boolean;
  isOutlineVisible: boolean;
};

function createEntity(scene: Scene, x: number, y: number) {
  const e: Entity = {
    id: getRandomId(),
    type: Type.NIL,
    state: State.NIL,
    pos: vec(x, y),
    vel: vec(),
    start: vec(x, y),
    body: rect(),
    bodyOffset: vec(),
    intersection: vec(),
    spriteId: "",
    pivot: vec(),
    offset: vec(),
    angle: 0,
    scale: 1,
    timer: timer(),
    delay: timer(),
    isRigid: false,
    isFlipped: false,
    isInteractable: false,
    isOutlineVisible: false,
  };
  scene.entities[e.id] = e;
  scene.active.push(e.id);
  scene.visible.push(e.id);
  return e;
}

function destroyEntity(scene: Scene, id: string) {
  scene.destroyed.push(id);
}

function createPlayer(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.PLAYER;
  e.state = State.PLAYER_CONTROL;
  e.spriteId = "player";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 8;
  e.body.h = 3;
  e.bodyOffset.x = -4;
  e.bodyOffset.y = -3;
  e.isRigid = true;
  scene.playerId = e.id;
}

function createTree(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.TREE;
  e.state = State.TREE_IDLE;
  e.spriteId = "tree";
  e.pivot.x = 16;
  e.pivot.y = 31;
  e.body.w = 2;
  e.body.h = 2;
  e.bodyOffset.x = -1;
  e.bodyOffset.y = -2;
  e.isInteractable = true;
}

function createRock(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.ROCK;
  e.spriteId = "rock";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 10;
  e.body.h = 3;
  e.bodyOffset.x = -5;
  e.bodyOffset.y = -3;
  e.isInteractable = true;
}

function createItemTwig(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.ITEM_TWIG;
  e.state = State.ITEM_IDLE;
  e.spriteId = "item_twig";
  e.pivot.x = 4;
  e.pivot.y = 8;
}

type Scene = {
  entities: Record<string, Entity>;
  active: string[];
  visible: string[];
  destroyed: string[];
  playerId: string;
  interactableId: string;
};

function createScene(id: string) {
  const scene: Scene = {
    entities: {},
    active: [],
    visible: [],
    destroyed: [],
    playerId: "",
    interactableId: "",
  };
  game.scenes[id] = scene;
  return scene;
}

function createWorldScene() {
  const scene = createScene("world");
  createPlayer(scene, 160, 90);
  createTree(scene, 140, 80);
  createRock(scene, 120, 70);
  setCamera(160, 90);
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: string;
};

const game: Game = {
  scenes: {},
  sceneId: "",
};

async function setup() {
  await loadTexture("atlas", "textures/atlas.png");
  loadSprite("player", "atlas", 0, 0, 16, 16);
  loadSprite("tree", "atlas", 0, 16, 32, 32);
  loadSprite("rock", "atlas", 32, 32, 16, 16);
  loadSprite("item_twig", "atlas", 0, 48, 8, 8);

  loadOutlineTexture("atlas_outline", "atlas", "circle");
  loadSprite("tree_outline", "atlas_outline", 0, 16, 32, 32);
  loadSprite("rock_outline", "atlas_outline", 32, 32, 16, 16);

  loadFlashTexture("atlas_flash", "atlas");

  createWorldScene();
  game.sceneId = "world";
}

function update() {
  const scene = game.scenes[game.sceneId];

  for (const id of scene.active) {
    const e = scene.entities[id];
    updateState(scene, e);
    checkForCollisions(scene, e);
    e.isOutlineVisible = id === scene.interactableId;
  }

  const player = scene.entities[scene.playerId];
  updateCamera(player.pos.x, player.pos.y);
  cleanUpEntities(scene);
  depthSortEntities(scene);

  for (const id of scene.visible) {
    const e = scene.entities[id];
    resetTransform();
    applyCameraTransform();
    translateTransform(e.pos.x, e.pos.y);
    translateTransform(e.offset.x, e.offset.y);
    scaleTransform(e.scale, e.scale);
    rotateTransform(e.angle);
    if (e.isFlipped) {
      scaleTransform(-1, 1);
    }
    if (e.spriteId) {
      drawSprite(e.spriteId, -e.pivot.x, -e.pivot.y);
    }
    if (e.isOutlineVisible) {
      drawSprite(`${e.spriteId}_outline`, -e.pivot.x, -e.pivot.y);
    }
    if (DEBUG) {
      resetTransform();
      applyCameraTransform();
      drawRect(e.body, "red");
    }
  }

  resetTransform();
  translateTransform(1, 1);
  scaleTransform(0.125, 0.125);
  drawText(fps.toString(), 0, 0, "lime");
}

function updateState(scene: Scene, e: Entity) {
  switch (e.state) {
    case State.PLAYER_CONTROL:
      {
        resetVector(e.vel);
        if (isInputDown(InputCode.KEY_LEFT)) {
          e.vel.x -= 1;
          e.isFlipped = true;
        }
        if (isInputDown(InputCode.KEY_RIGHT)) {
          e.vel.x += 1;
          e.isFlipped = false;
        }
        if (isInputDown(InputCode.KEY_UP)) {
          e.vel.y -= 1;
        }
        if (isInputDown(InputCode.KEY_DOWN)) {
          e.vel.y += 1;
        }
        normalizeVector(e.vel);
        scaleVector(e.vel, PLAYER_SPEED);
        addVectorScaled(e.pos, e.vel, delta);
        findNearestInteractable(scene, e);
        const interactable = scene.entities[scene.interactableId];
        if (interactable && isInputPressed(InputCode.KEY_SPACE)) {
          setState(e, State.PLAYER_INTERACT);
        }
      }
      break;

    case State.PLAYER_INTERACT:
      {
        e.scale = tween(1, 1.25, PLAYER_INTERACT_TIME / 2, "easeInOutSine", e.timer);
        if (tickTimer(e.timer, PLAYER_INTERACT_TIME)) {
          destroyEntity(scene, scene.interactableId);
          dropItems(scene, scene.entities[scene.interactableId]);
          setState(e, State.PLAYER_CONTROL);
        }
      }
      break;

    case State.ITEM_IDLE:
      {
        tickTimer(e.timer, Infinity);
        e.offset.y = tween(0, -2, 1000, "easeInOutSine", e.timer);
        if (tickTimer(e.delay, ITEM_SEEK_DELAY)) {
          setState(e, State.ITEM_SEEK);
        }
      }
      break;

    case State.ITEM_SEEK:
      {
        const player = scene.entities[scene.playerId];
        e.pos.x = tween(e.start.x, player.pos.x, ITEM_SEEK_TIME, "easeInCirc", e.timer);
        e.pos.y = tween(e.start.y, player.pos.y, ITEM_SEEK_TIME, "easeInCirc", e.timer);
        if (tickTimer(e.timer, ITEM_SEEK_TIME)) {
          destroyEntity(scene, e.id);
        }
      }
      break;

    case State.TREE_IDLE:
      {
        tickTimer(e.timer, Infinity);
        e.angle = tween(-2, 2, 2000, "easeInOutSine", e.timer);
      }
      break;
  }
}

function checkForCollisions(scene: Scene, e: Entity) {
  if (isRectangleValid(e.body)) {
    copyVector(e.body, e.pos);
    addVector(e.body, e.bodyOffset);
    if (e.isRigid) {
      resetVector(e.intersection);
      for (const id of scene.active) {
        const other = scene.entities[id];
        writeIntersectionBetweenRectangles(e.body, other.body, e.vel, e.intersection);
      }
      if (e.intersection.x) {
        e.body.x += e.intersection.x;
        e.pos.x += e.intersection.x;
        e.vel.x = 0;
      }
      if (e.intersection.y) {
        e.body.y += e.intersection.y;
        e.pos.y += e.intersection.y;
        e.vel.y = 0;
      }
    }
  }
}

function dropItems(scene: Scene, e: Entity) {
  switch (e.type) {
    case Type.TREE:
      {
        repeat(getRandomIntInRange(1, 3), () => createItemTwig(scene, e.pos.x + getRandomIntInRange(-4, 4), e.pos.y + getRandomIntInRange(-4, 4)));
      }
      break;
  }
}

function findNearestInteractable(scene: Scene, player: Entity) {
  scene.interactableId = "";
  let smallestDistance = Infinity;
  for (const id of scene.active) {
    const target = scene.entities[id];
    const distance = getVectorDistance(player.pos, target.pos);
    if (target.isInteractable && distance < PLAYER_RANGE && distance < smallestDistance) {
      scene.interactableId = id;
      smallestDistance = distance;
    }
  }
}

function cleanUpEntities(scene: Scene) {
  if (scene.destroyed.length) {
    for (const id of scene.destroyed) {
      delete scene.entities[id];
      remove(scene.active, id);
      remove(scene.visible, id);
    }
    scene.destroyed.length = 0;
  }
}

function depthSortEntities(scene: Scene) {
  scene.visible.sort((idA, idB) => {
    const a = scene.entities[idA];
    const b = scene.entities[idB];
    return a.pos.y - b.pos.y;
  });
}

function setState(e: Entity, state: State) {
  if (e.state !== state) {
    e.state = state;
    resetTimer(e.timer);
    resetTimer(e.delay);
  }
}

run({
  settings: {
    width: WIDTH,
    height: HEIGHT,
    cameraSmoothing: 0.05,
    background: "#1e1e1e",
  },
  setup,
  update,
});
