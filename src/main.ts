import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  consumeInputPressed,
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
  isInputPressed,
  isRectangleValid,
  loadFlashTexture,
  loadFont,
  loadOutlineTexture,
  loadSprite,
  loadTexture,
  normalizeVector,
  pick,
  random,
  rect,
  Rectangle,
  remove,
  repeat,
  resetTimer,
  resetTransform,
  resetVector,
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
const TILE_SIZE = 20;
const PLAYER_SPEED = 1;
const PLAYER_RANGE = 10;
const PLAYER_INTERACT_TIME = 200;
const ITEM_SEEK_TIME = 200;
const ITEM_SEEK_DELAY = 500;

const enum TypeId {
  NONE = "",
  PLAYER = "player",
  SHRUB = "shrub",
  TREE = "tree",
  STONES = "stones",
  ROCK = "rock",
  ITEM = "item",
}

const enum StateId {
  NONE = "",
  PLAYER_CONTROL = "player_control",
  PLAYER_INTERACT = "player_interact",
  ITEM_IDLE = "item_idle",
  ITEM_SEEK = "item_seek",
  SHRUB_IDLE = "shrub_idle",
  TREE_IDLE = "tree_idle",
}

type Entity = {
  id: string;
  type: TypeId;
  state: StateId;
  item: ItemId;
  blueprint: BlueprintId;
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
    blueprint: BlueprintId.NONE,
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
  scene.render.push(e.id);
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
  e.body.w = 6;
  e.body.h = 2;
  e.bodyOffset.x = -3;
  e.bodyOffset.y = -2;
  e.isRigid = true;
  e.health = 1;
  scene.playerId = e.id;
}

function createShrub(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = TypeId.SHRUB;
  e.state = StateId.SHRUB_IDLE;
  e.spriteId = "shrub";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.health = 1;
  e.isInteractable = true;
}

function createStones(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = TypeId.STONES;
  e.spriteId = "stones";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.health = 1;
  e.isInteractable = true;
}

function createTree(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = TypeId.TREE;
  e.state = StateId.TREE_IDLE;
  e.blueprint = BlueprintId.AXE;
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

function createItemLog(scene: Scene, x: number, y: number) {
  return createItem(scene, x, y, ItemId.LOG, "item_log");
}

function createItemPebble(scene: Scene, x: number, y: number) {
  return createItem(scene, x, y, ItemId.PEBBLE, "item_pebble");
}

function createItemRock(scene: Scene, x: number, y: number) {
  return createItem(scene, x, y, ItemId.ROCK, "item_rock");
}

const enum ItemId {
  NONE = "",
  TWIG = "twig",
  LOG = "log",
  PEBBLE = "pebble",
  ROCK = "rock",
}

type Item = {
  name: string;
  spriteId: string;
  count: number;
  max: number;
};

function loadItem(id: ItemId, name: string, spriteId: string) {
  game.inventory[id] = { name, spriteId, count: 0, max: 99 };
}

const enum BlueprintId {
  NONE = "",
  AXE = "axe",
  CRAFTING_TABLE = "crafting_table",
}

type Blueprint = {
  name: string;
  spriteId: string;
  recipe: Record<string, number>;
  isUnlocked: boolean;
};

function loadBlueprint(id: BlueprintId, name: string, spriteId: string, recipe: Record<string, number>) {
  game.blueprints[id] = { name, spriteId, recipe, isUnlocked: false };
}

const enum SceneId {
  WORLD = "world",
}

type Scene = {
  entities: Record<string, Entity>;
  active: string[];
  render: string[];
  destroyed: string[];
  playerId: string;
  interactableId: string;
  selectedId: string;
};

function createScene(id: SceneId) {
  const scene: Scene = {
    entities: {},
    active: [],
    render: [],
    destroyed: [],
    playerId: "",
    interactableId: "",
    selectedId: "",
  };
  game.scenes[id] = scene;
  return scene;
}

function loadWorldScene() {
  const scene = createScene(SceneId.WORLD);
  createPlayer(scene, 160, 90);
  setCameraPosition(160, 90);
  const objects = [TypeId.SHRUB, TypeId.TREE, TypeId.STONES, TypeId.ROCK];
  for (let x = 0; x < WIDTH; x += TILE_SIZE) {
    for (let y = 0; y < HEIGHT; y += TILE_SIZE) {
      const type = pick(objects);
      switch (type) {
        case TypeId.SHRUB:
          createShrub(scene, x, y);
          break;
        case TypeId.TREE:
          createTree(scene, x, y);
          break;
        case TypeId.STONES:
          createStones(scene, x, y);
          break;
        case TypeId.ROCK:
          createRock(scene, x, y);
          break;
      }
    }
  }
}

const enum GameStateId {
  NONE = "",
  NORMAL = "normal",
  CRAFTING = "crafting",
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: string;
  inventory: Record<string, Item>;
  blueprints: Record<string, Blueprint>;
  state: GameStateId;
};

const game: Game = {
  scenes: {},
  sceneId: "",
  inventory: {},
  blueprints: {},
  state: GameStateId.NORMAL,
};

async function setup() {
  await setupTextures();
  await setupFont();
  setupSprites();
  setupItems();
  setupBlueprints();
  setupScenes();
}

async function setupTextures() {
  await loadTexture("atlas", "textures/atlas.png");
  loadOutlineTexture("atlas_outline", "atlas", "circle", "white");
  loadFlashTexture("atlas_flash", "atlas", "white");
}

async function setupFont() {
  await loadFont("default", "fonts/pixelmix.ttf", "pixelmix", 8);
  setFont("default");
}

function setupSprites() {
  loadSprite("player", "atlas", 0, 0, 16, 16);

  loadSprite("tree", "atlas", 0, 16, 32, 32);
  loadSprite("tree_outline", "atlas_outline", 0, 16, 32, 32);

  loadSprite("rock", "atlas", 32, 32, 16, 16);
  loadSprite("rock_outline", "atlas_outline", 32, 32, 16, 16);

  loadSprite("shrub", "atlas", 48, 32, 16, 16);
  loadSprite("shrub_outline", "atlas_outline", 48, 32, 16, 16);

  loadSprite("stones", "atlas", 64, 32, 16, 16);
  loadSprite("stones_outline", "atlas_outline", 64, 32, 16, 16);

  loadSprite("item_twig", "atlas", 0, 48, 8, 8);
  loadSprite("item_log", "atlas", 16, 48, 8, 8);
  loadSprite("item_pebble", "atlas", 32, 48, 8, 8);
  loadSprite("item_rock", "atlas", 48, 48, 8, 8);

  loadSprite("tool_axe", "atlas", 0, 64, 8, 8);

  loadSprite("building_crafting_table", "atlas", 0, 80, 16, 16);
}

function setupItems() {
  loadItem(ItemId.TWIG, "Twig", "item_twig");
  loadItem(ItemId.PEBBLE, "Pebble", "item_pebble");
  loadItem(ItemId.LOG, "Log", "item_log");
  loadItem(ItemId.ROCK, "Rock", "item_rock");
}

function setupBlueprints() {
  loadBlueprint(BlueprintId.AXE, "Axe", "tool_axe", { [ItemId.TWIG]: 10, [ItemId.PEBBLE]: 10 });
  loadBlueprint(BlueprintId.CRAFTING_TABLE, "Crafting table", "building_crafting_table", { [ItemId.TWIG]: 10, [ItemId.PEBBLE]: 10 });
}

function setupScenes() {
  loadWorldScene();
  game.sceneId = SceneId.WORLD;
}

function update() {
  const scene = game.scenes[game.sceneId];

  for (const id of scene.active) {
    const e = scene.entities[id];

    switch (game.state) {
      case GameStateId.NORMAL:
        {
          updateState(scene, e);
          updateHitbox(e);
          checkForCollisions(scene, e);
          e.isOutlineVisible = id === scene.interactableId;
        }
        break;

      case GameStateId.CRAFTING:
        {
          if (isInputPressed(InputCode.KEY_C) || isInputPressed(InputCode.KEY_ESCAPE)) {
            game.state = GameStateId.NORMAL;
          }
        }
        break;
    }
  }

  const player = scene.entities[scene.playerId];
  updateCamera(player.pos.x, player.pos.y);
  cleanUpEntities(scene);
  depthSortEntities(scene, scene.render);

  for (const id of scene.render) {
    const e = scene.entities[id];
    renderEntity(e);
  }

  switch (game.state) {
    case GameStateId.CRAFTING:
      renderCrafting(scene);
      break;
  }

  renderInventory();
  renderToolBelt();
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

        if (isInputPressed(InputCode.KEY_C)) {
          consumeInputPressed(InputCode.KEY_C);
          game.state = GameStateId.CRAFTING;
          scene.selectedId = BlueprintId.CRAFTING_TABLE;
        }
      }
      break;

    case StateId.PLAYER_INTERACT:
      {
        const completed = tickTimer(e.timer1, PLAYER_INTERACT_TIME);
        const trigger = tickTimer(e.timer2, PLAYER_INTERACT_TIME / 2);
        e.scale = tween(1, 1.25, PLAYER_INTERACT_TIME / 2, "easeInOutSine", e.timer1);
        if (trigger) {
          const interactable = scene.entities[scene.interactableId];
          interactable.health -= 1;
          if (interactable.health <= 0) {
            destroyEntity(scene, interactable.id);
            dropItems(scene, interactable);
          }
        }
        if (completed) {
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

    case StateId.SHRUB_IDLE:
      {
        tickTimer(e.timer1, Infinity);
        e.angle = tween(-2, 2, 2000, "easeInOutSine", e.timer1);
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

function dropItems(scene: Scene, e: Entity) {
  switch (e.type) {
    case TypeId.SHRUB:
      repeat(random(1, 2), () => dropItem(scene, e, ItemId.TWIG));
      break;
    case TypeId.STONES:
      repeat(random(1, 2), () => dropItem(scene, e, ItemId.PEBBLE));
      break;
    case TypeId.TREE:
      repeat(random(1, 2), () => dropItem(scene, e, ItemId.LOG));
      break;
    case TypeId.ROCK:
      repeat(random(1, 2), () => dropItem(scene, e, ItemId.ROCK));
      break;
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
    case ItemId.LOG:
      createItemLog(scene, x, y);
      break;
    case ItemId.ROCK:
      createItemRock(scene, x, y);
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
      if (target.blueprint && !game.blueprints[target.blueprint].isUnlocked) {
        continue;
      }
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
      remove(scene.render, id);
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

function renderCrafting(scene: Scene) {
  renderCraftingChoice(scene, BlueprintId.CRAFTING_TABLE, 4, HEIGHT - 40);
}

function renderCraftingChoice(scene: Scene, id: BlueprintId, x: number, y: number) {
  const blueprint = game.blueprints[id];
  const isSelected = id === scene.selectedId;
  resetTransform();
  translateTransform(x, y);
  drawRect(0, 0, 16, 16, blueprint.isUnlocked ? "rgba(0,0,0,0.5)" : "rgba(255, 0, 0, 0.5)", true);
  if (isSelected) {
    drawRect(0, 0, 16, 16, "white");
  }
  translateTransform(8, 15);
  if (isSelected) {
    scaleTransform(1.25, 1.25);
  }
  drawSprite(blueprint.spriteId, -8, -15);
  resetTransform();
  translateTransform(x, y);
  for (const key in blueprint.recipe) {
    drawSprite("item_twig", 0, 0);
  }
}

function renderInventory() {
  renderInventoryItem(ItemId.TWIG, 4, 4);
  renderInventoryItem(ItemId.LOG, 14, 4);
  renderInventoryItem(ItemId.PEBBLE, 24, 4);
  renderInventoryItem(ItemId.ROCK, 34, 4);
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

function renderToolBelt() {
  renderBlueprint(BlueprintId.AXE, 4, 14);
}

function renderBlueprint(id: BlueprintId, x: number, y: number) {
  const blueprint = game.blueprints[id];
  resetTransform();
  translateTransform(x, y);
  drawRect(0, 0, 10, 10, blueprint.isUnlocked ? "rgba(0,0,0,0.5)" : "rgba(255, 0, 0, 0.5)", true);
  drawSprite(blueprint.spriteId, 0, 0);
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
