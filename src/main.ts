import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  copyVector,
  doesRectangleContain,
  drawRect,
  drawRectInstance,
  drawSprite,
  drawText,
  getEngineState,
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
  setAlpha,
  setCameraPosition,
  setFont,
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

const enum TypeId {
  NONE = "",
  PLAYER = "player",
  TREE = "tree",
  ROCK = "rock",
  ITEM = "item",
}

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
  PEBBLE = "pebble",
}

const enum SceneId {
  WORLD = "world",
}

const enum GameStateId {
  NONE = "",
}

type Entity = {
  id: string;
  type: TypeId;
  state: StateId;
  item: ItemId;
  pos: Vector;
  vel: Vector;
  start: Vector;
  hitbox: Rectangle;
  hitboxOffset: Vector;
  body: Rectangle;
  bodyOffset: Vector;
  intersection: Vector;
  spriteId: string;
  pivot: Vector;
  offset: Vector;
  angle: number;
  scale: number;
  alpha: number;
  timer1: Timer;
  timer2: Timer;
  health: number;
  isRigid: boolean;
  isVisible: boolean;
  isFlipped: boolean;
  isInteractable: boolean;
  isOutlineVisible: boolean;
};

function createEntity(scene: Scene, x: number, y: number) {
  const e: Entity = {
    id: uuid(),
    type: TypeId.NONE,
    state: StateId.NONE,
    item: ItemId.NONE,
    pos: vec(x, y),
    vel: vec(),
    start: vec(x, y),
    hitbox: rect(),
    hitboxOffset: vec(),
    body: rect(),
    bodyOffset: vec(),
    intersection: vec(),
    spriteId: "",
    pivot: vec(),
    offset: vec(),
    angle: 0,
    scale: 1,
    alpha: 1,
    timer1: timer(),
    timer2: timer(),
    health: 0,
    isRigid: false,
    isVisible: true,
    isFlipped: false,
    isInteractable: false,
    isOutlineVisible: false,
  };
  scene.entities[e.id] = e;
  scene.active.push(e.id);
  return e;
}

function destroyEntity(scene: Scene, id: string) {
  scene.destroyed.push(id);
}

function createPlayer(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = TypeId.PLAYER;
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
  e.type = TypeId.TREE;
  e.state = StateId.TREE_IDLE;
  e.spriteId = "tree";
  e.pivot.x = 16;
  e.pivot.y = 31;
  e.body.w = 2;
  e.body.h = 2;
  e.bodyOffset.x = -1;
  e.bodyOffset.y = -2;
  e.hitbox.w = 13;
  e.hitbox.h = 25;
  e.hitboxOffset.x = -6.5;
  e.hitboxOffset.y = -25;
  e.health = 3;
  e.isInteractable = true;
}

function createRock(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = TypeId.ROCK;
  e.spriteId = "rock";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 10;
  e.body.h = 3;
  e.bodyOffset.x = -5;
  e.bodyOffset.y = -3;
  e.health = 5;
  e.isInteractable = true;
}

function createItem(scene: Scene, x: number, y: number, item: ItemId, spriteId: string) {
  const e = createEntity(scene, x, y);
  e.type = TypeId.ITEM;
  e.state = StateId.ITEM_IDLE;
  e.item = item;
  e.spriteId = spriteId;
  e.pivot.x = 4;
  e.pivot.y = 8;
}

function createItemTwig(scene: Scene, x: number, y: number) {
  return createItem(scene, x, y, ItemId.TWIG, "item_twig");
}

function createItemPebble(scene: Scene, x: number, y: number) {
  return createItem(scene, x, y, ItemId.PEBBLE, "item_pebble");
}

type Item = {
  name: string;
  spriteId: string;
  count: number;
  max: number;
};

function loadItem(id: ItemId, name: string, spriteId: string) {
  const item: Item = { name, spriteId, count: 0, max: 99 };
  game.inventory[id] = item;
}

type Scene = {
  entities: Record<string, Entity>;
  active: string[];
  destroyed: string[];
  playerId: string;
  interactableId: string;
};

function createScene(id: SceneId) {
  const scene: Scene = {
    entities: {},
    active: [],
    destroyed: [],
    playerId: "",
    interactableId: "",
  };
  game.scenes[id] = scene;
  return scene;
}

function loadWorldScene() {
  const scene = createScene(SceneId.WORLD);
  createPlayer(scene, 160, 90);
  repeat(100, () => {
    const x = random(0, WIDTH);
    const y = random(0, HEIGHT);
    if (roll(0.5)) {
      createTree(scene, x, y);
    } else {
      createRock(scene, x, y);
    }
  });
  setCameraPosition(160, 90);
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: string;
  inventory: Record<string, Item>;
  state: GameStateId;
};

const game: Game = {
  scenes: {},
  sceneId: "",
  inventory: {},
  state: GameStateId.NONE,
};

async function setup() {
  await loadTexture("atlas", "textures/atlas.png");
  loadSprite("player", "atlas", 0, 0, 16, 16);
  loadSprite("tree", "atlas", 0, 16, 32, 32);
  loadSprite("rock", "atlas", 32, 32, 16, 16);
  loadSprite("item_twig", "atlas", 0, 48, 8, 8);
  loadSprite("item_pebble", "atlas", 32, 48, 8, 8);

  loadOutlineTexture("atlas_outline", "atlas", "circle", "white");
  loadSprite("tree_outline", "atlas_outline", 0, 16, 32, 32);
  loadSprite("rock_outline", "atlas_outline", 32, 32, 16, 16);

  loadFlashTexture("atlas_flash", "atlas", "white");

  await loadFont("default", "fonts/pixelmix.ttf", "pixelmix", 8);
  setFont("default");

  loadItem(ItemId.NONE, "", "");
  loadItem(ItemId.TWIG, "Twig", "item_twig");
  loadItem(ItemId.PEBBLE, "Pebble", "item_pebble");

  loadWorldScene();

  game.sceneId = SceneId.WORLD;
}

function update() {
  const scene = game.scenes[game.sceneId];

  for (const id of scene.active) {
    const e = scene.entities[id];
    updateState(scene, e);
    updateHitbox(e);
    checkForCollisions(scene, e);
    e.isOutlineVisible = id === scene.interactableId;
  }

  const player = scene.entities[scene.playerId];
  updateCamera(player.pos.x, player.pos.y);
  cleanUpEntities(scene);
  depthSortEntities(scene, scene.active);

  for (const id of scene.active) {
    const e = scene.entities[id];
    renderEntity(e);
  }

  renderInventory();
  renderMetrics();
}

function updateState(scene: Scene, e: Entity) {
  const { delta } = getEngineState();
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
          item.count = Math.min(item.count + 1, item.max);
          destroyEntity(scene, e.id);
        }
      }
      break;

    case StateId.TREE_IDLE:
      {
        tickTimer(e.timer1, Infinity);
        e.angle = tween(-2, 2, 2000, "easeInOutSine", e.timer1);
        const player = scene.entities[scene.playerId];
        e.alpha = doesRectangleContain(e.hitbox, player.pos.x, player.pos.y) ? 0.5 : 1;
      }
      break;
  }
}

function updateHitbox(e: Entity) {
  if (isRectangleValid(e.hitbox)) {
    copyVector(e.hitbox, e.pos);
    addVector(e.hitbox, e.hitboxOffset);
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
    case ItemId.PEBBLE:
      createItemPebble(scene, x, y);
      break;
  }
}

function dropItems(scene: Scene, e: Entity) {
  switch (e.type) {
    case TypeId.TREE:
      repeat(random(1, 2), () => dropItem(scene, e, ItemId.TWIG));
      break;
    case TypeId.ROCK:
      repeat(random(1, 2), () => dropItem(scene, e, ItemId.PEBBLE));
      break;
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
    }
    scene.destroyed.length = 0;
  }
}

function depthSortEntities(scene: Scene, list: Array<string>) {
  list.sort((idA, idB) => {
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

function renderEntity(e: Entity) {
  if (e.isVisible) {
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
      setAlpha(e.alpha);
      drawSprite(e.spriteId, -e.pivot.x, -e.pivot.y);
      setAlpha(1);
    }
    if (e.isOutlineVisible) {
      drawSprite(`${e.spriteId}_outline`, -e.pivot.x, -e.pivot.y);
    }
    if (DEBUG) {
      resetTransform();
      applyCameraTransform();
      drawRectInstance(e.body, "red");
      drawRectInstance(e.hitbox, "yellow");
    }
  }
}

function renderInventory() {
  renderInventoryItem(ItemId.TWIG, 4, 4);
  renderInventoryItem(ItemId.PEBBLE, 14, 4);
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
  const { fps } = getEngineState();
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
  update,
});
