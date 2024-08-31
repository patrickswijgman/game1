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

type Nil = "";
const nil: Nil = "";

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
        box: [0, 112, 16, 16],
        box_selection: [16, 112, 16, 16],
        tooltip: [0, 128, 80, 64],
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
        tooltip_outline: [0, 128, 80, 64],
        building_crafting_table_outline: [0, 80, 16, 16],
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

const enum ItemId {
  TWIG = "twig",
  LOG = "log",
  PEBBLE = "pebble",
  ROCK = "rock",
}

type Item = {
  name: string;
  spriteId: string;
};

const ITEMS: Record<ItemId, Item> = {
  [ItemId.TWIG]: {
    name: "Twig",
    spriteId: "item_twig",
  },
  [ItemId.LOG]: {
    name: "Log",
    spriteId: "item_log",
  },
  [ItemId.PEBBLE]: {
    name: "Pebble",
    spriteId: "item_pebble",
  },
  [ItemId.ROCK]: {
    name: "Rock",
    spriteId: "item_rock",
  },
};

const MAX_ITEM_COUNT = 99;

const enum ToolId {
  AXE = "axe",
}

const enum BuildingId {
  CRAFTING_TABLE = "crafting_table",
}

const BUILDINGS: Record<BuildingId, Array<ToolId>> = {
  [BuildingId.CRAFTING_TABLE]: [ToolId.AXE],
};

type BlueprintId = ToolId | BuildingId;

type Blueprint = {
  name: string;
  spriteId: string;
  recipe: Array<{ itemId: ItemId; amount: number }>;
};

const BLUEPRINTS: Record<BlueprintId, Blueprint> = {
  [ToolId.AXE]: {
    name: "Axe",
    spriteId: "tool_axe",
    recipe: [
      { itemId: ItemId.TWIG, amount: 10 },
      { itemId: ItemId.PEBBLE, amount: 5 },
    ],
  },
  [BuildingId.CRAFTING_TABLE]: {
    name: "Crafting Table",
    spriteId: "building_crafting_table",
    recipe: [
      { itemId: ItemId.TWIG, amount: 10 },
      { itemId: ItemId.PEBBLE, amount: 10 },
    ],
  },
};

function isBlueprintCraftable(id: BlueprintId) {
  return BLUEPRINTS[id].recipe.every((item) => game.inventory[item.itemId] >= item.amount);
}

const enum Type {
  PLAYER = "player",
  SHRUB = "shrub",
  TREE = "tree",
  STONES = "stones",
  ROCK = "rock",
  ITEM = "item",
  BUILDING = "building",
}

const enum State {
  PLAYER_CONTROL = "player_control",
  PLAYER_INTERACT_RESOURCE = "player_interact_resource",
  PLAYER_INTERACT_BUILDING = "player_interact_building",
  ITEM_IDLE = "item_idle",
  ITEM_SEEK = "item_seek",
  SHRUB_IDLE = "shrub_idle",
  TREE_IDLE = "tree_idle",
}

const enum Interact {
  RESOURCE = "resource",
  BUILDING = "building",
}

type Entity = {
  id: string;
  type: Type | Nil;
  state: State | Nil;
  itemId: ItemId | Nil;
  toolId: ToolId | Nil;
  interactType: Interact | Nil;
  interactToGameStateId: GameStateId | Nil;
  buildingId: BuildingId | Nil;
  pos: Vector;
  vel: Vector;
  start: Vector;
  hitbox: Rectangle;
  hitboxOffset: Vector;
  body: Rectangle;
  bodyOffset: Vector;
  bodyIntersection: Vector;
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
};

function createEntity(scene: Scene, x: number, y: number) {
  const e: Entity = {
    id: uuid(),
    type: nil,
    state: nil,
    itemId: nil,
    toolId: nil,
    buildingId: nil,
    interactType: nil,
    interactToGameStateId: nil,
    pos: vec(x, y),
    vel: vec(),
    start: vec(x, y),
    hitbox: rect(),
    hitboxOffset: vec(),
    body: rect(),
    bodyOffset: vec(),
    bodyIntersection: vec(),
    spriteId: nil,
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
  e.interactType = Interact.RESOURCE;
}

function createStones(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.STONES;
  e.spriteId = "stones";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.health = 1;
  e.interactType = Interact.RESOURCE;
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
  e.hitbox.w = 13;
  e.hitbox.h = 25;
  e.hitboxOffset.x = -6.5;
  e.hitboxOffset.y = -25;
  e.health = 3;
  e.interactType = Interact.RESOURCE;
  e.toolId = ToolId.AXE;
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
  e.health = 5;
  e.interactType = Interact.RESOURCE;
  e.toolId = ToolId.AXE;
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

function createCraftingTable(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.type = Type.BUILDING;
  e.spriteId = "building_crafting_table";
  e.pivot.x = 8;
  e.pivot.y = 10;
  e.body.w = 6;
  e.body.h = 2;
  e.bodyOffset.x = -3;
  e.bodyOffset.y = -2;
  e.buildingId = BuildingId.CRAFTING_TABLE;
  e.interactType = Interact.BUILDING;
  e.interactToGameStateId = GameStateId.CRAFTING_TABLE_MENU;
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
  createCraftingTable(scene, 140, 90);
  setCameraPosition(160, 90);
  for (let x = 0; x < WIDTH; x += TILE_SIZE) {
    for (let y = 0; y < HEIGHT; y += TILE_SIZE) {
      const factory = pick([createShrub, createTree, createStones, createRock]);
      factory(scene, x, y);
    }
  }
}

const enum GameStateId {
  NORMAL = "normal",
  CRAFTING_TABLE_MENU = "crafting",
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: string;
  inventory: Record<ItemId, number>;
  tools: Record<ToolId, boolean>;
  buildings: Record<BuildingId, boolean>;
  state: GameStateId | Nil;
};

const game: Game = {
  scenes: {},
  sceneId: "",
  inventory: {
    [ItemId.TWIG]: 0,
    [ItemId.LOG]: 0,
    [ItemId.PEBBLE]: 0,
    [ItemId.ROCK]: 0,
  },
  tools: {
    [ToolId.AXE]: false,
  },
  buildings: {
    [BuildingId.CRAFTING_TABLE]: false,
  },
  state: nil,
};

async function setup() {
  await loadAssets(ASSETS);
  setFont("default");

  loadWorldScene();

  game.sceneId = SceneId.WORLD;
  game.state = GameStateId.NORMAL;
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
        }
        break;

      case GameStateId.CRAFTING_TABLE_MENU:
        {
          if (isInputPressed(InputCode.KEY_LEFT)) {
            consumeInputPressed(InputCode.KEY_LEFT);
            scene.selectedIndex = Math.max(0, scene.selectedIndex - 1);
          }
          if (isInputPressed(InputCode.KEY_RIGHT)) {
            consumeInputPressed(InputCode.KEY_RIGHT);
            scene.selectedIndex = Math.min(BUILDINGS[BuildingId.CRAFTING_TABLE].length - 1, scene.selectedIndex + 1);
          }
          if (isInputPressed(InputCode.KEY_ESCAPE)) {
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
    renderEntity(scene, e);
  }

  switch (game.state) {
    case GameStateId.CRAFTING_TABLE_MENU:
      renderCraftingMenu(scene, BUILDINGS[BuildingId.CRAFTING_TABLE]);
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
          switch (interactable.interactType) {
            case Interact.RESOURCE:
              setState(e, State.PLAYER_INTERACT_RESOURCE);
              break;
            case Interact.BUILDING:
              setState(e, State.PLAYER_INTERACT_BUILDING);
              break;
          }
        }
      }
      break;

    case State.PLAYER_INTERACT_RESOURCE:
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

    case State.PLAYER_INTERACT_BUILDING:
      {
        const interactable = scene.entities[scene.interactableId];
        game.state = interactable.interactToGameStateId;
        scene.selectedIndex = 0;
        setState(e, State.PLAYER_CONTROL);
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
          game.inventory[e.itemId] = Math.min(game.inventory[e.itemId] + 1, MAX_ITEM_COUNT);
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
      resetVector(e.bodyIntersection);
      for (const id of scene.active) {
        const other = scene.entities[id];
        writeIntersectionBetweenRectangles(e.body, other.body, e.vel, e.bodyIntersection);
      }
      if (e.bodyIntersection.x) {
        e.body.x += e.bodyIntersection.x;
        e.pos.x += e.bodyIntersection.x;
        e.vel.x = 0;
      }
      if (e.bodyIntersection.y) {
        e.body.y += e.bodyIntersection.y;
        e.pos.y += e.bodyIntersection.y;
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
    if (target.interactType && distance < PLAYER_RANGE && distance < smallestDistance) {
      if (target.toolId && !game.tools[target.toolId]) {
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

function renderEntity(scene: Scene, e: Entity) {
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
      const alpha = e.interactType === Interact.BUILDING && !game.buildings[e.buildingId] ? 0.5 : 1;
      setAlpha(e.alpha * alpha);
      drawSprite(e.spriteId, -e.pivot.x, -e.pivot.y);
      setAlpha(1);
    }
    if (e.id === scene.interactableId) {
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
    const blueprint = BLUEPRINTS[id];
    const isSelected = id === blueprints[scene.selectedIndex];
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
      const isCraftable = isBlueprintCraftable(id);
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
    const item = ITEMS[recipe.itemId];
    const count = game.inventory[recipe.itemId];
    drawSprite(item.spriteId, -2, -4);
    drawText(item.name, 12, 2);
    drawText(`x${recipe.amount} (${count})`, bg.w - 8, 2, "white", "right");
    translateTransform(0, 10);
  }
}

function renderInventory() {
  resetTransform();
  translateTransform(4, 10);
  drawText("Inventory", 0, 0);
  translateTransform(0, 5);
  let id: ItemId;
  for (id in game.inventory) {
    const count = game.inventory[id];
    if (!count) continue;
    const item = ITEMS[id];
    drawSprite("box", 0, 0);
    drawSprite(item.spriteId, 0, 0);
    drawText(count.toString(), 14, 10, "white", "right");
    translateTransform(16, 0);
  }
}

function renderToolBelt() {
  resetTransform();
  translateTransform(4, 32);
  drawText("Tools", 0, 0);
  translateTransform(0, 5);
  let id: ToolId;
  for (id in game.tools) {
    const isUnlocked = game.tools[id];
    if (!isUnlocked) continue;
    const blueprint = BLUEPRINTS[id];
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
