import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  AssetsManifest,
  consumeInputPressed,
  copyVector,
  doesRectangleContain,
  drawRectInstance,
  drawSprite,
  drawText,
  getEngineState,
  getSprite,
  getVectorDistance,
  InputCode,
  isInputDown,
  isInputPressed,
  isRectangleValid,
  loadAssets,
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

const ASSETS: AssetsManifest = {
  textures: {
    atlas: {
      url: "textures/atlas.png",
      sprites: {
        player: [0, 0, 16, 16],
        tree: [0, 16, 32, 32],
        rock: [32, 32, 16, 16],
        shrub: [48, 32, 16, 16],
        stones: [64, 32, 16, 16],
        item_twig: [0, 48, 16, 16],
        item_log: [16, 48, 16, 16],
        item_pebble: [32, 48, 16, 16],
        item_rock: [48, 48, 16, 16],
        tool_axe: [0, 64, 16, 16],
        building_crafting_table: [0, 80, 16, 16],
        box: [0, 96, 16, 16],
        box_selection: [16, 96, 16, 16],
        locked: [32, 96, 16, 16],
        tooltip: [0, 112, 80, 64],
      },
    },
  },
  outlineTextures: {
    atlas_outline: {
      url: "textures/atlas.png",
      mode: "circle",
      color: "white",
      sprites: {
        tree_outline: [0, 16, 32, 32],
        rock_outline: [32, 32, 16, 16],
        shrub_outline: [48, 32, 16, 16],
        stones_outline: [64, 32, 16, 16],
        tooltip_outline: [0, 112, 80, 64],
      },
    },
  },
  flashTextures: {},
  fonts: {
    default: {
      url: "fonts/pixelmix.ttf",
      family: "pixelmix",
      size: 4,
    },
  },
  sounds: {},
};

const enum Type {
  NONE = "",
  PLAYER = "player",
  SHRUB = "shrub",
  TREE = "tree",
  STONES = "stones",
  ROCK = "rock",
  ITEM = "item",
}

const enum State {
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
  type: Type;
  state: State;
  itemId: ItemId;
  toolId: BlueprintId;
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
    type: Type.NONE,
    state: State.NONE,
    itemId: ItemId.NONE,
    toolId: BlueprintId.NONE,
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
  e.type = Type.PLAYER;
  e.state = State.PLAYER_CONTROL;
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
  e.type = Type.SHRUB;
  e.state = State.SHRUB_IDLE;
  e.spriteId = "shrub";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.health = 1;
  e.isInteractable = true;
}

function createStones(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.STONES;
  e.spriteId = "stones";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.health = 1;
  e.isInteractable = true;
}

function createTree(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.TREE;
  e.state = State.TREE_IDLE;
  e.toolId = BlueprintId.AXE;
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
  e.type = Type.ROCK;
  e.spriteId = "rock";
  e.toolId = BlueprintId.PICKAXE;
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 10;
  e.body.h = 3;
  e.bodyOffset.x = -5;
  e.bodyOffset.y = -3;
  e.health = 5;
  e.isInteractable = true;
}

function createItem(scene: Scene, x: number, y: number, itemId: ItemId, spriteId: string) {
  const e = createEntity(scene, x, y);
  e.type = Type.ITEM;
  e.state = State.ITEM_IDLE;
  e.itemId = itemId;
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
  game.items[id] = { name, spriteId, count: 0, max: 99 };
}

const enum BlueprintId {
  NONE = "",
  AXE = "axe",
  PICKAXE = "pickaxe",
  CRAFTING_TABLE = "crafting_table",
}

type BlueprintRecipe = Array<{
  itemId: ItemId;
  amount: number;
}>;

type Blueprint = {
  name: string;
  spriteId: string;
  recipe: BlueprintRecipe;
};

function loadTool(id: BlueprintId, name: string, spriteId: string, recipe: BlueprintRecipe) {
  game.blueprints[id] = { name, spriteId, recipe };
}

function loadBuilding(id: BlueprintId, name: string, spriteId: string, recipe: BlueprintRecipe, blueprints: Array<BlueprintId>) {
  game.blueprints[id] = { name, spriteId, recipe };
  game.blueprintsPerBuilding[id] = blueprints;
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
  selectedIndex: number;
};

function createScene(id: SceneId) {
  const scene: Scene = {
    entities: {},
    active: [],
    render: [],
    destroyed: [],
    playerId: "",
    interactableId: "",
    selectedIndex: 0,
  };
  game.scenes[id] = scene;
  return scene;
}

function loadWorldScene() {
  const scene = createScene(SceneId.WORLD);
  createPlayer(scene, 160, 90);
  setCameraPosition(160, 90);
  for (let x = 0; x < WIDTH; x += TILE_SIZE) {
    for (let y = 0; y < HEIGHT; y += TILE_SIZE) {
      const factory = pick([createShrub, createTree, createStones, createRock]);
      factory(scene, x, y);
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
  items: Record<string, Item>;
  inventory: Array<ItemId>;
  blueprints: Record<string, Blueprint>;
  blueprintsPerBuilding: Record<string, Array<BlueprintId>>;
  tools: Array<BlueprintId>;
  state: GameStateId;
};

const game: Game = {
  scenes: {},
  sceneId: "",
  items: {},
  inventory: [ItemId.TWIG, ItemId.PEBBLE],
  blueprints: {},
  blueprintsPerBuilding: {},
  tools: [],
  state: GameStateId.NORMAL,
};

async function setup() {
  await loadAssets(ASSETS);
  setupItems();
  setupTools();
  setupBuildings();
  setupScenes();
}

function setupItems() {
  loadItem(ItemId.TWIG, "Twig", "item_twig");
  loadItem(ItemId.PEBBLE, "Pebble", "item_pebble");
  loadItem(ItemId.LOG, "Log", "item_log");
  loadItem(ItemId.ROCK, "Rock", "item_rock");
}

function setupTools() {
  loadTool(BlueprintId.AXE, "Axe", "tool_axe", [
    { itemId: ItemId.TWIG, amount: 10 },
    { itemId: ItemId.LOG, amount: 5 },
  ]);
}

function setupBuildings() {
  loadBuilding(
    BlueprintId.CRAFTING_TABLE,
    "Crafting table",
    "building_crafting_table",
    [
      { itemId: ItemId.TWIG, amount: 10 },
      { itemId: ItemId.PEBBLE, amount: 10 },
    ],
    [BlueprintId.AXE, BlueprintId.CRAFTING_TABLE],
  );
}

function setupScenes() {
  loadWorldScene();
  game.sceneId = SceneId.WORLD;
}

function update() {
  if (isInputDown(InputCode.KEY_CTRL_LEFT) && isInputPressed(InputCode.KEY_R)) {
    document.location.reload();
  }

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
          if (isInputPressed(InputCode.KEY_LEFT)) {
            consumeInputPressed(InputCode.KEY_LEFT);
            scene.selectedIndex = Math.max(0, scene.selectedIndex - 1);
          }
          if (isInputPressed(InputCode.KEY_RIGHT)) {
            consumeInputPressed(InputCode.KEY_RIGHT);
            scene.selectedIndex = Math.min(game.blueprintsPerBuilding[BlueprintId.CRAFTING_TABLE].length - 1, scene.selectedIndex + 1);
          }
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
      renderCraftingMenu(scene, game.blueprintsPerBuilding[BlueprintId.CRAFTING_TABLE]);
      break;
  }

  renderInventory();
  renderToolBelt();
  renderMetrics();
}

function updateState(scene: Scene, e: Entity) {
  const { delta } = getEngineState();

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

        updateNearestInteractable(scene, e);
        const interactable = scene.entities[scene.interactableId];

        if (interactable && isInputDown(InputCode.KEY_Z)) {
          setState(e, State.PLAYER_INTERACT);
        }

        if (isInputPressed(InputCode.KEY_C)) {
          consumeInputPressed(InputCode.KEY_C);
          game.state = GameStateId.CRAFTING;
          scene.selectedIndex = 0;
        }
      }
      break;

    case State.PLAYER_INTERACT:
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
          setState(e, State.PLAYER_CONTROL);
        }
      }
      break;

    case State.ITEM_IDLE:
      {
        tickTimer(e.timer1, Infinity);
        e.offset.y = tween(0, -2, 1000, "easeInOutSine", e.timer1);
        if (tickTimer(e.timer2, ITEM_SEEK_DELAY)) {
          setState(e, State.ITEM_SEEK);
        }
      }
      break;

    case State.ITEM_SEEK:
      {
        const player = scene.entities[scene.playerId];
        const completed = tickTimer(e.timer1, ITEM_SEEK_TIME);
        e.pos.x = tween(e.start.x, player.pos.x, ITEM_SEEK_TIME, "easeInCirc", e.timer1);
        e.pos.y = tween(e.start.y, player.pos.y, ITEM_SEEK_TIME, "easeInCirc", e.timer1);
        if (completed) {
          const item = game.items[e.itemId];
          item.count = Math.min(item.count + 1, item.max);
          destroyEntity(scene, e.id);
        }
      }
      break;

    case State.SHRUB_IDLE:
      {
        tickTimer(e.timer1, Infinity);
        e.angle = tween(-2, 2, 2000, "easeInOutSine", e.timer1);
      }
      break;

    case State.TREE_IDLE:
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
    case Type.SHRUB:
      repeat(random(1, 2), () => createItemTwig(scene, e.pos.x + random(-4, 4), e.pos.y + random(-4, 4)));
      break;
    case Type.STONES:
      repeat(random(1, 2), () => createItemPebble(scene, e.pos.x + random(-4, 4), e.pos.y + random(-4, 4)));
      break;
    case Type.TREE:
      repeat(random(1, 2), () => createItemLog(scene, e.pos.x + random(-4, 4), e.pos.y + random(-4, 4)));
      break;
    case Type.ROCK:
      repeat(random(1, 2), () => createItemRock(scene, e.pos.x + random(-4, 4), e.pos.y + random(-4, 4)));
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
      if (target.toolId && !game.tools.includes(target.toolId)) {
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

function setState(e: Entity, state: State) {
  if (e.state !== state) {
    e.state = state;
    resetTimer(e.timer1);
    resetTimer(e.timer2);
  }
}

function isBlueprintCraftable(id: BlueprintId) {
  return game.blueprints[id].recipe.every((recipe) => game.items[recipe.itemId].count >= recipe.amount);
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

function renderCraftingMenu(scene: Scene, blueprints: Array<BlueprintId>) {
  for (let i = 0; i < blueprints.length; i++) {
    const id = blueprints[i];
    const blueprint = game.blueprints[id];
    const isSelected = id === blueprints[scene.selectedIndex];
    const isCraftable = isBlueprintCraftable(id);
    const x = WIDTH / 2 + i * 16 - blueprints.length * 8;
    const y = HEIGHT - 20;
    resetTransform();
    translateTransform(x, y);
    drawSprite("box", 0, 0);
    if (isSelected) {
      drawSprite("box_selection", 0, 0);
    }
    translateTransform(8, 8);
    if (isSelected) {
      scaleTransform(1.25, 1.25);
    }
    drawSprite(blueprint.spriteId, -8, -8);
    if (isSelected) {
      renderCraftingRecipe(blueprint, x, y, isCraftable);
    }
  }
}

function renderCraftingRecipe(blueprint: Blueprint, anchorX: number, anchorY: number, isCraftable: boolean) {
  const bg = getSprite("tooltip");
  const x = anchorX;
  const y = anchorY - bg.h - 2;
  let message = "Craftable";
  let isError = false;
  if (!isCraftable) {
    message = "Not enough resources";
    isError = true;
  }
  resetTransform();
  translateTransform(x - bg.w / 2 + 8, y);
  drawSprite("tooltip", 0, 0);
  drawSprite("tooltip_outline", 0, 0);
  translateTransform(4, 4);
  scaleTransform(1.25, 1.25);
  drawText(blueprint.name, 0, 0);
  scaleTransform(0.8, 0.8);
  translateTransform(0, 8);
  drawText(message, 0, 0, isError ? "red" : "green");
  translateTransform(0, 8);
  for (const recipe of blueprint.recipe) {
    const item = game.items[recipe.itemId];
    drawSprite(item.spriteId, -2, -4);
    drawText(item.name, 12, 2);
    drawText(`x${recipe.amount} (${item.count})`, bg.w - 8, 2, "white", "right");
    translateTransform(0, 10);
  }
}

function renderInventory() {
  resetTransform();
  translateTransform(4, 10);
  drawText("Inventory", 0, 0);
  translateTransform(0, 5);
  for (const id of game.inventory) {
    const item = game.items[id];
    drawSprite("box", 0, 0);
    drawSprite(item.spriteId, 0, 0);
    drawText(item.count.toString(), 14, 10, "white", "right");
    translateTransform(16, 0);
  }
}

function renderToolBelt() {
  resetTransform();
  translateTransform(4, 32);
  drawText("Tools", 0, 0);
  translateTransform(0, 5);
  for (const id of game.tools) {
    const blueprint = game.blueprints[id];
    drawSprite("box", 0, 0);
    drawSprite(blueprint.spriteId, 0, 0);
    translateTransform(16, 0);
  }
}

function renderMetrics() {
  const { fps } = getEngineState();
  resetTransform();
  translateTransform(1, 1);
  scaleTransform(0.5, 0.5);
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
