import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  copyVector,
  delta,
  drawRect,
  drawRectInstance,
  drawSprite,
  drawText,
  fps,
  getVectorDistance,
  InputCode,
  isInputDown,
  isRectangleValid,
  loadFlashTexture,
  loadFont,
  loadOutlineTexture,
  loadSprite,
  loadTexture,
  normalizeVector,
  random,
  rect,
  Rectangle,
  remove,
  repeat,
  resetTimer,
  resetTransform,
  resetVector,
  roll,
  rotateTransform,
  run,
  scaleTransform,
  scaleVector,
  setCamera,
  tickTimer,
  timer,
  Timer,
  translateTransform,
  tween,
  updateCamera,
  uuid,
  vec,
  Vector,
  writeIntersectionBetweenRectangles,
} from "ridder";

const DEBUG = false;
const WIDTH = 320;
const HEIGHT = 180;
const PLAYER_SPEED = 1.125;
const PLAYER_RANGE = 10;
const PLAYER_INTERACT_TIME = 200;
const ITEM_SEEK_TIME = 200;
const ITEM_SEEK_DELAY = 500;

const enum StateId {
  NONE = "",
  PLAYER_CONTROL = "player_control",
  PLAYER_INTERACT = "player_interact",
  ITEM_IDLE = "item_idle",
  ITEM_SEEK = "item_seek",
  TREE_IDLE = "tree_idle",
}

const enum ItemId {
  NONE = "",
  TWIG = "twig",
}

const enum SceneId {
  WORLD = "world",
}

type Drop = {
  item: ItemId;
  chance: number;
  minAmount: number;
  maxAmount: number;
};

type Entity = {
  id: string;
  state: StateId;
  item: ItemId;
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
  timer1: Timer;
  timer2: Timer;
  drops: Drop[];
  health: number;
  isRigid: boolean;
  isFlipped: boolean;
  isInteractable: boolean;
  isOutlineVisible: boolean;
};

function createEntity(scene: Scene, x: number, y: number) {
  const e: Entity = {
    id: uuid(),
    state: StateId.NONE,
    item: ItemId.NONE,
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
    timer1: timer(),
    timer2: timer(),
    drops: [],
    health: 0,
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
  e.state = StateId.PLAYER_CONTROL;
  e.spriteId = "player";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 8;
  e.body.h = 3;
  e.bodyOffset.x = -4;
  e.bodyOffset.y = -3;
  e.isRigid = true;
  e.health = 1;
  scene.playerId = e.id;
}

function createTree(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.state = StateId.TREE_IDLE;
  e.spriteId = "tree";
  e.pivot.x = 16;
  e.pivot.y = 31;
  e.body.w = 2;
  e.body.h = 2;
  e.bodyOffset.x = -1;
  e.bodyOffset.y = -2;
  e.health = 3;
  e.isInteractable = true;
  e.drops = [{ item: ItemId.TWIG, chance: 0.5, minAmount: 1, maxAmount: 3 }];
}

function createRock(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
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
  e.state = StateId.ITEM_IDLE;
  e.item = ItemId.TWIG;
  e.spriteId = "item_twig";
  e.pivot.x = 4;
  e.pivot.y = 8;
}

type Item = {
  name: string;
  spriteId: string;
  count: number;
};

function loadItem(id: ItemId, name: string, spriteId: string) {
  const item: Item = { name, spriteId, count: 0 };
  game.inventory[id] = item;
  return item;
}

type Scene = {
  entities: Record<string, Entity>;
  active: string[];
  visible: string[];
  destroyed: string[];
  playerId: string;
  interactableId: string;
};

function loadScene(id: SceneId) {
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

function loadWorldScene() {
  const scene = loadScene(SceneId.WORLD);
  createPlayer(scene, 160, 90);
  repeat(100, () => createTree(scene, random(0, WIDTH), random(0, HEIGHT)));
  createRock(scene, 120, 70);
  setCamera(160, 90);
  return scene;
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: string;
  inventory: Record<string, Item>;
};

const game: Game = {
  scenes: {},
  sceneId: "",
  inventory: {},
};

async function setup() {
  await loadTexture("atlas", "textures/atlas.png");
  loadSprite("player", "atlas", 0, 0, 16, 16);
  loadSprite("tree", "atlas", 0, 16, 32, 32);
  loadSprite("rock", "atlas", 32, 32, 16, 16);
  loadSprite("item_twig", "atlas", 0, 48, 8, 8);

  loadOutlineTexture("atlas_outline", "atlas", "circle", "white");
  loadSprite("tree_outline", "atlas_outline", 0, 16, 32, 32);
  loadSprite("rock_outline", "atlas_outline", 32, 32, 16, 16);

  loadFlashTexture("atlas_flash", "atlas", "white");

  await loadFont("default", "fonts/pixelmix.ttf", "pixelmix", 8);

  loadItem(ItemId.NONE, "", "");
  loadItem(ItemId.TWIG, "Twig", "item_twig");

  loadWorldScene();

  game.sceneId = SceneId.WORLD;
}

function update(scene: Scene) {
  for (const id of scene.active) {
    const e = scene.entities[id];
    updateState(scene, e);
    checkForCollisions(scene, e);
    e.isOutlineVisible = id === scene.interactableId;
  }

  const player = scene.entities[scene.playerId];
  updateCamera(player.pos.x, player.pos.y);
  cleanUpEntities(scene);
}

function updateState(scene: Scene, e: Entity) {
  switch (e.state) {
    case StateId.PLAYER_CONTROL:
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
        updateNearestInteractable(scene, e);
        const interactable = scene.entities[scene.interactableId];
        if (interactable && isInputDown(InputCode.KEY_Z)) {
          setState(e, StateId.PLAYER_INTERACT);
        }
      }
      break;

    case StateId.PLAYER_INTERACT:
      {
        const completed = tickTimer(e.timer1, PLAYER_INTERACT_TIME);
        e.scale = tween(1, 1.25, PLAYER_INTERACT_TIME / 2, "easeInOutSine", e.timer1);
        if (completed) {
          const interactable = scene.entities[scene.interactableId];
          interactable.health -= 1;
          if (interactable.health <= 0) {
            destroyEntity(scene, interactable.id);
            dropItems(scene, interactable);
          }
          setState(e, StateId.PLAYER_CONTROL);
        }
      }
      break;

    case StateId.ITEM_IDLE:
      {
        tickTimer(e.timer1, Infinity);
        e.offset.y = tween(0, -2, 1000, "easeInOutSine", e.timer1);
        if (tickTimer(e.timer2, ITEM_SEEK_DELAY)) {
          setState(e, StateId.ITEM_SEEK);
        }
      }
      break;

    case StateId.ITEM_SEEK:
      {
        const player = scene.entities[scene.playerId];
        const completed = tickTimer(e.timer1, ITEM_SEEK_TIME);
        e.pos.x = tween(e.start.x, player.pos.x, ITEM_SEEK_TIME, "easeInCirc", e.timer1);
        e.pos.y = tween(e.start.y, player.pos.y, ITEM_SEEK_TIME, "easeInCirc", e.timer1);
        if (completed) {
          const item = game.inventory[e.item];
          item.count += 1;
          destroyEntity(scene, e.id);
        }
      }
      break;

    case StateId.TREE_IDLE:
      {
        tickTimer(e.timer1, Infinity);
        e.angle = tween(-2, 2, 2000, "easeInOutSine", e.timer1);
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

function dropItem(scene: Scene, e: Entity, item: ItemId) {
  const x = e.pos.x + random(-4, 4);
  const y = e.pos.y + random(-4, 4);
  switch (item) {
    case ItemId.TWIG:
      createItemTwig(scene, x, y);
      break;
  }
}

function dropItems(scene: Scene, e: Entity) {
  for (const drop of e.drops) {
    repeat(drop.minAmount, () => dropItem(scene, e, drop.item));
    repeat(drop.maxAmount - drop.minAmount, () => roll(drop.chance) && dropItem(scene, e, drop.item));
  }
}

function updateNearestInteractable(scene: Scene, player: Entity) {
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

function setState(e: Entity, state: StateId) {
  if (e.state !== state) {
    e.state = state;
    resetTimer(e.timer1);
    resetTimer(e.timer2);
  }
}

function render(scene: Scene) {
  depthSortEntities(scene);
  renderEntities(scene);
  renderInventory();
  renderMetrics();
}

function renderEntities(scene: Scene) {
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
      drawRectInstance(e.body, "red");
    }
  }
}

function renderInventory() {
  renderInventoryItem(ItemId.TWIG, 4, 4);
}

function renderInventoryItem(id: ItemId, x: number, y: number) {
  const item = game.inventory[id];
  resetTransform();
  translateTransform(x, y);
  drawRect(0, 0, 10, 10, "rgba(0,0,0,0.5)", true);
  drawSprite(item.spriteId, 0, 0);
  translateTransform(10, 5);
  scaleTransform(0.5, 0.5);
  drawText(item.count.toString(), 0, 0, "white", "right");
}

function renderMetrics() {
  resetTransform();
  translateTransform(1, 1);
  scaleTransform(0.25, 0.25);
  drawText(fps.toString(), 0, 0, "lime");
}

run({
  settings: {
    width: WIDTH,
    height: HEIGHT,
    cameraSmoothing: 0.05,
    background: "#1e1e1e",
  },
  setup,
  update: () => {
    const scene = game.scenes[game.sceneId];
    update(scene);
    render(scene);
  },
});
