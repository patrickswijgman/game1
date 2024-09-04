import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  AssetsManifest,
  clamp,
  consumeInputDown,
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
  rect,
  Rectangle,
  remove,
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
const MAX_ITEM_COUNT = 99;

const ASSETS: AssetsManifest = {
  textures: {
    atlas: {
      url: "textures/atlas.png",
      sprites: {
        player: [0, 0, 16, 16],
        tree: [0, 16, 16, 32],
        rock: [16, 32, 16, 16],
        shrub: [32, 32, 16, 16],
        stones: [48, 32, 16, 16],
        item_twig: [0, 48, 16, 16],
        item_log: [16, 48, 16, 16],
        item_pebble: [32, 48, 16, 16],
        item_stone: [48, 48, 16, 16],
        tool_axe: [0, 64, 16, 16],
        tool_stonecutter: [16, 64, 16, 16],
        tool_pickaxe: [32, 64, 16, 16],
        building_crafting_table: [0, 80, 16, 16],
        building_furnace: [16, 80, 16, 16],
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
        tree_outline: [0, 16, 16, 32],
        rock_outline: [16, 32, 16, 16],
        shrub_outline: [32, 32, 16, 16],
        stones_outline: [48, 32, 16, 16],
        building_crafting_table_outline: [0, 80, 16, 16],
        building_furnace_outline: [16, 80, 16, 16],
        tooltip_outline: [0, 128, 80, 64],
      },
    },
  },
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
  STONES = "stones",
  TREE = "tree",
  ROCK = "rock",

  ITEM_TWIG = "item_twig",
  ITEM_PEBBLE = "item_pebble",
  ITEM_LOG = "item_log",
  ITEM_STONE = "item_stone",

  TOOL_AXE = "tool_axe",
  TOOL_STONECUTTER = "tool_stonecutter",
  TOOL_PICKAXE = "tool_pickaxe",

  BUILDING_CRAFTING_TABLE = "crafting_table",
  BUILDING_FURNACE = "furnace",
}

type Crafting = {
  name: string;
  spriteId: string;
  ingredients: Array<{ type: Type; amount: number }>;
  recipes: Array<Type>;
};

const CRAFTING: Record<string, Crafting> = {
  [Type.ITEM_TWIG]: {
    name: "Twig",
    spriteId: "item_twig",
    ingredients: [],
    recipes: [],
  },
  [Type.ITEM_PEBBLE]: {
    name: "Pebble",
    spriteId: "item_pebble",
    ingredients: [],
    recipes: [],
  },
  [Type.ITEM_LOG]: {
    name: "Log",
    spriteId: "item_log",
    ingredients: [],
    recipes: [],
  },
  [Type.ITEM_STONE]: {
    name: "Stone",
    spriteId: "item_stone",
    ingredients: [],
    recipes: [],
  },
  [Type.TOOL_AXE]: {
    name: "Axe",
    spriteId: "tool_axe",
    ingredients: [
      { type: Type.ITEM_TWIG, amount: 5 },
      { type: Type.ITEM_PEBBLE, amount: 5 },
    ],
    recipes: [],
  },
  [Type.TOOL_STONECUTTER]: {
    name: "Stonecutter",
    spriteId: "tool_stonecutter",
    ingredients: [
      { type: Type.ITEM_TWIG, amount: 5 },
      { type: Type.ITEM_PEBBLE, amount: 5 },
    ],
    recipes: [],
  },
  [Type.TOOL_PICKAXE]: {
    name: "Pickaxe",
    spriteId: "tool_pickaxe",
    ingredients: [
      { type: Type.ITEM_LOG, amount: 5 },
      { type: Type.ITEM_STONE, amount: 5 },
    ],
    recipes: [],
  },
  [Type.BUILDING_CRAFTING_TABLE]: {
    name: "Crafting Table",
    spriteId: "building_crafting_table",
    ingredients: [
      { type: Type.ITEM_TWIG, amount: 10 },
      { type: Type.ITEM_PEBBLE, amount: 10 },
    ],
    recipes: [Type.TOOL_AXE, Type.TOOL_STONECUTTER, Type.TOOL_PICKAXE],
  },
  [Type.BUILDING_FURNACE]: {
    name: "Furnace",
    spriteId: "building_furnace",
    ingredients: [
      { type: Type.ITEM_STONE, amount: 20 },
      { type: Type.ITEM_LOG, amount: 5 },
    ],
    recipes: [],
  },
};

function isCraftable(type: Type) {
  return CRAFTING[type].ingredients.every((ingredient) => game.inventory[ingredient.type] >= ingredient.amount);
}

const enum State {
  NONE = "",
  PLAYER_CONTROL = "player_control",
  PLAYER_INTERACT_RESOURCE = "player_interact_resource",
  PLAYER_INTERACT_BUILDING = "player_interact_building",
  ITEM_IDLE = "item_idle",
  ITEM_SEEK = "item_seek",
  SHRUB_IDLE = "shrub_idle",
  TREE_IDLE = "tree_idle",
}

type Entity = {
  id: string;
  type: Type;
  state: State;
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
  tool: Type;
  loot: Array<Type>;
  isRigid: boolean;
  isVisible: boolean;
  isFlipped: boolean;
  isInteractable: boolean;
  isBuilding: boolean;
};

function createEntity(scene: Scene, x: number, y: number, type: Type) {
  const id = uuid();

  const e: Entity = {
    id,
    type,
    state: State.NONE,
    pos: vec(x, y),
    vel: vec(),
    start: vec(x, y),
    hitbox: rect(),
    hitboxOffset: vec(),
    body: rect(),
    bodyOffset: vec(),
    bodyIntersection: vec(),
    spriteId: "",
    pivot: vec(),
    offset: vec(),
    angle: 0,
    scale: 1,
    alpha: 1,
    timer1: timer(),
    timer2: timer(),
    health: 0,
    tool: Type.NONE,
    loot: [],
    isRigid: false,
    isVisible: true,
    isFlipped: false,
    isInteractable: false,
    isBuilding: false,
  };

  switch (type) {
    case Type.PLAYER:
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
      scene.playerId = id;
      break;

    case Type.SHRUB:
      e.state = State.SHRUB_IDLE;
      e.spriteId = "shrub";
      e.pivot.x = 8;
      e.pivot.y = 15;
      e.health = 1;
      e.loot.push(Type.ITEM_TWIG);
      e.isInteractable = true;
      break;

    case Type.STONES:
      e.spriteId = "stones";
      e.pivot.x = 8;
      e.pivot.y = 15;
      e.health = 1;
      e.loot.push(Type.ITEM_PEBBLE);
      e.isInteractable = true;
      break;

    case Type.TREE:
      e.state = State.TREE_IDLE;
      e.spriteId = "tree";
      e.pivot.x = 8;
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
      e.tool = Type.TOOL_AXE;
      e.loot.push(Type.ITEM_LOG);
      e.isInteractable = true;
      break;

    case Type.ROCK:
      e.spriteId = "rock";
      e.pivot.x = 8;
      e.pivot.y = 15;
      e.body.w = 10;
      e.body.h = 3;
      e.bodyOffset.x = -5;
      e.bodyOffset.y = -3;
      e.health = 5;
      e.tool = Type.TOOL_STONECUTTER;
      e.loot.push(Type.ITEM_STONE);
      e.isInteractable = true;
      break;

    case Type.ITEM_TWIG:
      e.spriteId = "item_twig";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 8;
      break;

    case Type.ITEM_PEBBLE:
      e.spriteId = "item_pebble";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 8;
      break;

    case Type.ITEM_LOG:
      e.spriteId = "item_log";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 8;
      break;

    case Type.ITEM_STONE:
      e.spriteId = "item_stone";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 8;
      break;

    case Type.BUILDING_CRAFTING_TABLE:
      e.spriteId = "building_crafting_table";
      e.pivot.x = 8;
      e.pivot.y = 11;
      e.body.w = 6;
      e.body.h = 2;
      e.bodyOffset.x = -3;
      e.bodyOffset.y = -2;
      e.isInteractable = true;
      e.isBuilding = true;
      break;

      break;
    case Type.BUILDING_FURNACE:
      e.spriteId = "building_furnace";
      e.pivot.x = 8;
      e.pivot.y = 15;
      e.body.w = 10;
      e.body.h = 2;
      e.bodyOffset.x = -5;
      e.bodyOffset.y = -2;
      e.isInteractable = true;
      e.isBuilding = true;
      break;
  }

  scene.entities[id] = e;
  scene.active.push(id);
  scene.render.push(id);
}

function destroyEntity(scene: Scene, id: string) {
  scene.destroyed.push(id);
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
  selectedMenuItemIndex: number;
  selectedBuildingRecipes: Array<Type>;
};

function createScene(id: SceneId) {
  const scene: Scene = {
    entities: {},
    active: [],
    render: [],
    destroyed: [],
    playerId: "",
    interactableId: "",
    selectedMenuItemIndex: 0,
    selectedBuildingRecipes: [],
  };
  game.scenes[id] = scene;
  return scene;
}

function loadWorldScene() {
  const scene = createScene(SceneId.WORLD);
  createEntity(scene, 160, 90, Type.PLAYER);
  createEntity(scene, 100, 60, Type.BUILDING_CRAFTING_TABLE);
  createEntity(scene, 120, 60, Type.BUILDING_FURNACE);
  setCameraPosition(160, 90);
  const types = [Type.SHRUB, Type.STONES, Type.TREE, Type.ROCK];
  for (let x = 0; x < WIDTH; x += TILE_SIZE) {
    for (let y = 0; y < HEIGHT; y += TILE_SIZE) {
      const type = pick(types);
      createEntity(scene, x, y, type);
    }
  }
}

const enum GameState {
  NORMAL = "normal",
  CRAFTING_MENU = "crafting_menu",
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: SceneId;
  inventory: Record<string, number>;
  tools: Record<string, boolean>;
  buildings: Record<string, boolean>;
  state: GameState;
};

const game: Game = {
  scenes: {},
  sceneId: SceneId.WORLD,
  inventory: {
    [Type.ITEM_TWIG]: 20,
    [Type.ITEM_PEBBLE]: 20,
    [Type.ITEM_LOG]: 0,
    [Type.ITEM_STONE]: 0,
  },
  tools: {
    [Type.TOOL_AXE]: false,
    [Type.TOOL_STONECUTTER]: false,
    [Type.TOOL_PICKAXE]: false,
  },
  buildings: {
    [Type.BUILDING_CRAFTING_TABLE]: false,
    [Type.BUILDING_FURNACE]: false,
  },
  state: GameState.NORMAL,
};

async function setup() {
  await loadAssets(ASSETS);
  setFont("default");
  loadWorldScene();
}

function update() {
  if (isInputDown(InputCode.KEY_CTRL_LEFT) && isInputPressed(InputCode.KEY_R)) {
    document.location.reload();
  }

  const scene = game.scenes[game.sceneId];

  switch (game.state) {
    case GameState.NORMAL:
      for (const id of scene.active) {
        const e = scene.entities[id];
        updateState(scene, e);
        updateCollisions(scene, e);
        updateHitbox(e);
      }
      break;

    case GameState.CRAFTING_MENU:
      updateCraftingMenu(scene);
      break;
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
    case GameState.CRAFTING_MENU:
      renderCraftingMenu(scene);
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
          if (interactable.isBuilding) {
            setState(e, State.PLAYER_INTERACT_BUILDING);
          } else {
            setState(e, State.PLAYER_INTERACT_RESOURCE);
          }
        }
      }
      break;

    case State.PLAYER_INTERACT_RESOURCE:
      if (interactWithResource(scene, e)) {
        setState(e, State.PLAYER_CONTROL);
      }
      break;

    case State.PLAYER_INTERACT_BUILDING:
      interactWithBuilding(scene);
      setState(e, State.PLAYER_CONTROL);
      break;

    case State.ITEM_IDLE:
      if (tickTimer(e.timer1, ITEM_SEEK_DELAY)) {
        setState(e, State.ITEM_SEEK);
      }
      break;

    case State.ITEM_SEEK:
      {
        const player = scene.entities[scene.playerId];
        const completed = tickTimer(e.timer1, ITEM_SEEK_TIME);
        e.pos.x = tween(e.start.x, player.pos.x, ITEM_SEEK_TIME, "easeInCirc", e.timer1);
        e.pos.y = tween(e.start.y, player.pos.y, ITEM_SEEK_TIME, "easeInCirc", e.timer1);
        if (completed) {
          game.inventory[e.type] = Math.min(game.inventory[e.type] + 1, MAX_ITEM_COUNT);
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

function interactWithResource(scene: Scene, e: Entity) {
  const completed = tickTimer(e.timer1, PLAYER_INTERACT_TIME);
  const trigger = tickTimer(e.timer2, PLAYER_INTERACT_TIME / 2);
  e.scale = tween(1, 1.25, PLAYER_INTERACT_TIME / 2, "easeInOutSine", e.timer1);
  if (trigger) {
    const interactable = scene.entities[scene.interactableId];
    interactable.health -= 1;
    if (interactable.health <= 0) {
      for (const lootId of interactable.loot) {
        createEntity(scene, interactable.pos.x, interactable.pos.y, lootId);
      }
      destroyEntity(scene, interactable.id);
    }
  }
  return completed;
}

function interactWithBuilding(scene: Scene) {
  const interactable = scene.entities[scene.interactableId];
  scene.selectedMenuItemIndex = 0;
  scene.selectedBuildingRecipes.length = 0;
  if (game.buildings[interactable.type]) {
    for (const type of CRAFTING[interactable.type].recipes) {
      if (!game.tools[type]) {
        scene.selectedBuildingRecipes.push(type);
      }
    }
  } else {
    scene.selectedBuildingRecipes.push(interactable.type);
  }
  if (scene.selectedBuildingRecipes.length) {
    game.state = GameState.CRAFTING_MENU;
  } else {
    game.state = GameState.NORMAL;
  }
}

function updateCollisions(scene: Scene, e: Entity) {
  if (isRectangleValid(e.body)) {
    copyVector(e.body, e.pos);
    addVector(e.body, e.bodyOffset);

    if (e.isRigid) {
      resetVector(e.bodyIntersection);
      for (const id of scene.active) {
        writeIntersectionBetweenRectangles(e.body, scene.entities[id].body, e.vel, e.bodyIntersection);
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

function updateHitbox(e: Entity) {
  if (isRectangleValid(e.hitbox)) {
    copyVector(e.hitbox, e.pos);
    addVector(e.hitbox, e.hitboxOffset);
  }
}

function updateCraftingMenu(scene: Scene) {
  if (scene.selectedBuildingRecipes.length === 0) {
    game.state = GameState.NORMAL;
    return;
  }
  const thingId = scene.selectedBuildingRecipes[scene.selectedMenuItemIndex];
  const thing = CRAFTING[thingId];
  if (isInputPressed(InputCode.KEY_LEFT)) {
    consumeInputPressed(InputCode.KEY_LEFT);
    scene.selectedMenuItemIndex = Math.max(0, scene.selectedMenuItemIndex - 1);
  }
  if (isInputPressed(InputCode.KEY_RIGHT)) {
    consumeInputPressed(InputCode.KEY_RIGHT);
    scene.selectedMenuItemIndex = Math.min(scene.selectedBuildingRecipes.length - 1, scene.selectedMenuItemIndex + 1);
  }
  if (isInputPressed(InputCode.KEY_ESCAPE)) {
    game.state = GameState.NORMAL;
  }
  if (isInputPressed(InputCode.KEY_Z) && isCraftable(thingId)) {
    consumeInputPressed(InputCode.KEY_Z);
    consumeInputDown(InputCode.KEY_Z);
    if (thingId in game.tools) {
      game.tools[thingId] = true;
    }
    if (thingId in game.buildings) {
      game.buildings[thingId] = true;
    }
    if (thingId in game.inventory) {
      game.inventory[thingId] += 1;
    }
    for (const ingredient of thing.ingredients) {
      game.inventory[ingredient.type] -= ingredient.amount;
    }
    scene.selectedBuildingRecipes.splice(scene.selectedMenuItemIndex, 1);
    scene.selectedMenuItemIndex = clamp(scene.selectedMenuItemIndex, 0, scene.selectedBuildingRecipes.length - 1);
    if (game.buildings[thingId]) {
      interactWithBuilding(scene);
    }
  }
}

function updateNearestInteractable(scene: Scene, player: Entity) {
  scene.interactableId = "";
  let smallestDistance = Infinity;
  for (const id of scene.active) {
    const target = scene.entities[id];
    const distance = getVectorDistance(player.pos, target.pos);
    if (target.isInteractable && distance < PLAYER_RANGE && distance < smallestDistance) {
      if (target.tool && !game.tools[target.tool]) {
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
      const alpha = e.isBuilding && !game.buildings[e.type] ? 0.5 : e.alpha;
      setAlpha(alpha);
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

function renderCraftingMenu(scene: Scene) {
  const recipes = scene.selectedBuildingRecipes;
  for (let i = 0; i < recipes.length; i++) {
    const id = recipes[i];
    const recipe = CRAFTING[id];
    const isSelected = i === scene.selectedMenuItemIndex;
    const x = WIDTH / 2 + i * 16 - recipes.length * 8;
    const y = HEIGHT - 20;
    resetTransform();
    translateTransform(x, y);
    drawSprite("box", 0, 0);
    if (isSelected) {
      drawSprite("box_selection", 0, 0);
    }
    translateTransform(8, 8);
    drawSprite(recipe.spriteId, -8, -8);
    if (isSelected) {
      renderCraftingRecipe(id, x, y);
    }
  }
}

function renderCraftingRecipe(type: Type, anchorX: number, anchorY: number) {
  const thing = CRAFTING[type];
  const isValid = isCraftable(type);
  const bg = getSprite("tooltip");
  const x = anchorX;
  const y = anchorY - bg.h - 2;
  let message = "Craftable";
  let isError = false;
  if (!isValid) {
    message = "Not enough resources";
    isError = true;
  }
  resetTransform();
  translateTransform(x - bg.w / 2 + 8, y);
  drawSprite("tooltip", 0, 0);
  drawSprite("tooltip_outline", 0, 0);
  translateTransform(4, 4);
  scaleTransform(1.25, 1.25);
  drawText(thing.name, 0, 0);
  scaleTransform(0.8, 0.8);
  translateTransform(0, 8);
  drawText(message, 0, 0, isError ? "red" : "green");
  translateTransform(0, 8);
  for (const ingredient of thing.ingredients) {
    const item = CRAFTING[ingredient.type];
    const count = game.inventory[ingredient.type];
    const color = count >= ingredient.amount ? "white" : "red";
    drawSprite(item.spriteId, -2, -4);
    drawText(item.name, 12, 2, color);
    drawText(`${count}/${ingredient.amount}`, bg.w - 10, 2, color, "right");
    translateTransform(0, 10);
  }
}

function renderInventory() {
  resetTransform();
  translateTransform(4, 10);
  drawText("Inventory", 0, 0);
  translateTransform(0, 5);
  for (const type in game.inventory) {
    const count = game.inventory[type];
    if (count) {
      const item = CRAFTING[type];
      drawSprite("box", 0, 0);
      drawSprite(item.spriteId, 0, 0);
      drawText(count.toString(), 14, 10, "white", "right");
      translateTransform(16, 0);
    }
  }
}

function renderToolBelt() {
  resetTransform();
  translateTransform(4, 32);
  drawText("Tools", 0, 0);
  translateTransform(0, 5);
  for (const type in game.tools) {
    if (game.tools[type]) {
      const thing = CRAFTING[type];
      drawSprite("box", 0, 0);
      drawSprite(thing.spriteId, 0, 0);
      translateTransform(16, 0);
    }
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
