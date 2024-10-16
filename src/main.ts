import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  AssetsManifest,
  clamp,
  consumeInputPressed,
  copyVector,
  doesRectangleContain,
  drawRectInstance,
  drawSprite,
  drawText,
  drawTexture,
  getDelta,
  getFramePerSecond,
  getPixel,
  getSprite,
  getTexture,
  getVectorDistance,
  getVectorLength,
  InputCode,
  isInputDown,
  isInputPressed,
  isRectangleValid,
  loadAssets,
  normalizeVector,
  random,
  rect,
  Rectangle,
  remove,
  resetTimer,
  resetTransform,
  resetVector,
  roll,
  rotateTransform,
  run,
  scaleTransform,
  scaleVector,
  setAlpha,
  setBackgroundColor,
  setCameraBounds,
  setCameraPosition,
  setCameraShakeIntensity,
  setCameraShakeReduction,
  setCameraSmoothing,
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
const PLAYER_INTERACT_RANGE = 10;
const PLAYER_INTERACT_TIME = 200;
const ITEM_DELAY_TIME = 100;
const ITEM_SEEK_TIME = 200;
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
        flint: [48, 32, 16, 16],
        iron: [64, 32, 16, 16],
        chest: [16, 16, 16, 16],
        item_twig: [0, 48, 16, 16],
        item_log: [16, 48, 16, 16],
        item_flint: [32, 48, 16, 16],
        item_rock: [48, 48, 16, 16],
        item_portal_shard: [64, 48, 16, 16],
        item_iron_ore: [80, 48, 16, 16],
        item_iron_ingot: [96, 48, 16, 16],
        tool_axe: [0, 64, 16, 16],
        tool_pickaxe: [16, 64, 16, 16],
        icon_construct: [0, 80, 16, 16],
        building_crafting_table: [0, 96, 16, 16],
        building_furnace: [16, 96, 16, 16],
        building_portal: [32, 80, 32, 32],
        building_anvil: [64, 96, 16, 16],
        box: [0, 176, 16, 16],
        box_selection: [16, 176, 16, 16],
        tooltip: [0, 192, 80, 64],
      },
    },
    forest: {
      url: "worlds/forest.png",
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
        flint_outline: [48, 32, 16, 16],
        iron_outline: [64, 32, 16, 16],
        chest_outline: [16, 16, 16, 16],
        building_crafting_table_outline: [0, 96, 16, 16],
        building_furnace_outline: [16, 96, 16, 16],
        building_portal_outline: [32, 80, 32, 32],
        building_anvil_outline: [64, 96, 16, 16],
      },
    },
  },
  flashTextures: {
    atlas_flash: {
      url: "textures/atlas.png",
      color: "white",
      sprites: {
        tree_flash: [0, 16, 16, 32],
        rock_flash: [16, 32, 16, 16],
        shrub_flash: [32, 32, 16, 16],
        flint_flash: [48, 32, 16, 16],
        iron_flash: [64, 32, 16, 16],
      },
    },
  },
  renderTextures: {
    grass: {
      width: 512,
      height: 512,
      draw: (ctx, width, height) => {
        const texture = getTexture("atlas");
        for (let x = 0; x < width; x += 16) {
          for (let y = 0; y < height; y += 16) {
            ctx.drawImage(texture, 0, 128, 16, 16, x, y, 16, 16);
          }
        }
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

type Dict<T> = Record<string, T>;

const enum Type {
  NONE = "",

  PLAYER = "player",
  SHRUB = "shrub",
  FLINT = "flint",
  TREE = "tree",
  ROCK = "rock",
  IRON = "iron",
  CHEST = "chest",

  ITEM_TWIG = "item_twig",
  ITEM_FLINT = "item_flint",
  ITEM_LOG = "item_log",
  ITEM_ROCK = "item_rock",
  ITEM_IRON_ORE = "item_iron_ore",
  ITEM_IRON_INGOT = "item_iron_ingot",
  ITEM_PORTAL_SHARD = "item_portal_shard",

  TOOL_AXE = "tool_axe",
  TOOL_PICKAXE = "tool_pickaxe",

  BUILDING_CRAFTING_TABLE = "building_crafting_table",
  BUILDING_FURNACE = "building_furnace",
  BUILDING_ANVIL = "building_anvil",
  BUILDING_PORTAL_HOME = "building_portal_home",
  BUILDING_PORTAL_FOREST = "building_portal_forest",
}

type Item = {
  name: string;
  spriteId: string;
};

const ITEMS: Dict<Item> = {
  [Type.ITEM_TWIG]: {
    name: "Twig",
    spriteId: "item_twig",
  },
  [Type.ITEM_FLINT]: {
    name: "Flint",
    spriteId: "item_flint",
  },
  [Type.ITEM_LOG]: {
    name: "Log",
    spriteId: "item_log",
  },
  [Type.ITEM_ROCK]: {
    name: "Rock",
    spriteId: "item_rock",
  },
  [Type.ITEM_IRON_ORE]: {
    name: "Iron Ore",
    spriteId: "item_iron_ore",
  },
  [Type.ITEM_IRON_INGOT]: {
    name: "Iron Ingot",
    spriteId: "item_iron_ingot",
  },
  [Type.ITEM_PORTAL_SHARD]: {
    name: "Portal Shard",
    spriteId: "item_portal_shard",
  },
};

type Recipe = {
  name: string;
  description: string;
  spriteId: string;
  ingredients: Array<{ item: Type; amount: number }>;
  unlocks: Array<Type>;
};

const CRAFTING_BOOK: Dict<Recipe> = {
  [Type.ITEM_IRON_INGOT]: {
    name: "Iron Ingot",
    description: "For things that need iron",
    spriteId: "item_iron_ingot",
    ingredients: [{ item: Type.ITEM_IRON_ORE, amount: 10 }],
    unlocks: [],
  },
  [Type.TOOL_AXE]: {
    name: "Axe",
    description: "Chop trees",
    spriteId: "tool_axe",
    ingredients: [
      { item: Type.ITEM_TWIG, amount: 5 },
      { item: Type.ITEM_FLINT, amount: 5 },
    ],
    unlocks: [],
  },
  [Type.TOOL_PICKAXE]: {
    name: "Pickaxe",
    description: "Mine stones and ores",
    spriteId: "tool_pickaxe",
    ingredients: [
      { item: Type.ITEM_LOG, amount: 5 },
      { item: Type.ITEM_FLINT, amount: 10 },
    ],
    unlocks: [],
  },
  [Type.BUILDING_CRAFTING_TABLE]: {
    name: "Crafting Table",
    description: "Craft things",
    spriteId: "building_crafting_table",
    ingredients: [
      { item: Type.ITEM_TWIG, amount: 10 },
      { item: Type.ITEM_FLINT, amount: 10 },
    ],
    unlocks: [Type.TOOL_AXE, Type.TOOL_PICKAXE],
  },
  [Type.BUILDING_FURNACE]: {
    name: "Furnace",
    description: "Heat things up",
    spriteId: "building_furnace",
    ingredients: [
      { item: Type.ITEM_ROCK, amount: 20 },
      { item: Type.ITEM_LOG, amount: 10 },
    ],
    unlocks: [Type.ITEM_IRON_INGOT],
  },
  [Type.BUILDING_ANVIL]: {
    name: "Anvil",
    description: "Smith things",
    spriteId: "building_anvil",
    ingredients: [{ item: Type.ITEM_IRON_INGOT, amount: 5 }],
    unlocks: [],
  },
  [Type.BUILDING_PORTAL_FOREST]: {
    name: "Forest Portal",
    description: "Warp to the forest",
    spriteId: "building_portal",
    ingredients: [{ item: Type.ITEM_PORTAL_SHARD, amount: 1 }],
    unlocks: [],
  },
};

type Loot = {
  item: Type;
  chance: number;
};

const LOOT_TABLE: Dict<Array<Loot>> = {
  [Type.SHRUB]: [
    { item: Type.ITEM_TWIG, chance: 1 },
    { item: Type.ITEM_TWIG, chance: 0.5 },
  ],
  [Type.FLINT]: [
    { item: Type.ITEM_FLINT, chance: 1 },
    { item: Type.ITEM_FLINT, chance: 0.5 },
  ],
  [Type.TREE]: [
    { item: Type.ITEM_LOG, chance: 1 },
    { item: Type.ITEM_LOG, chance: 0.5 },
  ],
  [Type.ROCK]: [
    { item: Type.ITEM_ROCK, chance: 1 },
    { item: Type.ITEM_ROCK, chance: 0.5 },
  ],
  [Type.IRON]: [
    { item: Type.ITEM_IRON_ORE, chance: 1 },
    { item: Type.ITEM_IRON_ORE, chance: 0.5 },
  ],
  [Type.CHEST]: [{ item: Type.ITEM_PORTAL_SHARD, chance: 1 }],
};

const TOOL_REQUIRED: Dict<Type> = {
  [Type.TREE]: Type.TOOL_AXE,
  [Type.ROCK]: Type.TOOL_PICKAXE,
  [Type.IRON]: Type.TOOL_PICKAXE,
};

const PORTAL_DESTINATION: Dict<SceneId> = {
  [Type.BUILDING_PORTAL_HOME]: SceneId.HOME,
  [Type.BUILDING_PORTAL_FOREST]: SceneId.FOREST,
};

const ENTITY_COLOR = {
  "#ff0000": Type.PLAYER,
  "#405f43": Type.TREE,
  "#513821": Type.SHRUB,
  "#474d4f": Type.FLINT,
  "#8954ce": Type.BUILDING_PORTAL_HOME,
};

const enum State {
  NONE = "",
  PLAYER_IDLE = "player_idle",
  PLAYER_WALK = "player_walk",
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
  flashTimer: Timer;
  timer1: Timer;
  timer2: Timer;
  duration: number;
  health: number;
  isRigid: boolean;
  isVisible: boolean;
  isFlipped: boolean;
  isInteractable: boolean;
  isBuilding: boolean;
  isPortal: boolean;
  isFlashing: boolean;
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
    flashTimer: timer(),
    timer1: timer(),
    timer2: timer(),
    duration: 0,
    health: 0,
    isRigid: false,
    isVisible: true,
    isFlipped: false,
    isInteractable: false,
    isBuilding: false,
    isPortal: false,
    isFlashing: false,
  };
  switch (type) {
    case Type.PLAYER:
      e.state = State.PLAYER_IDLE;
      e.spriteId = "player";
      e.pivot.x = 8;
      e.pivot.y = 14;
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
      e.pivot.y = 14;
      e.health = 1;
      e.isInteractable = true;
      e.duration = random(750, 1000);
      break;

    case Type.FLINT:
      e.spriteId = "flint";
      e.pivot.x = 8;
      e.pivot.y = 14;
      e.health = 1;
      e.isInteractable = true;
      break;

    case Type.TREE:
      e.state = State.TREE_IDLE;
      e.spriteId = "tree";
      e.pivot.x = 8;
      e.pivot.y = 30;
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
      e.duration = random(1500, 2000);
      break;

    case Type.ROCK:
      e.spriteId = "rock";
      e.pivot.x = 8;
      e.pivot.y = 14;
      e.body.w = 10;
      e.body.h = 3;
      e.bodyOffset.x = -5;
      e.bodyOffset.y = -3;
      e.health = 5;
      e.isInteractable = true;
      break;

    case Type.CHEST:
      e.spriteId = "chest";
      e.pivot.x = 8;
      e.pivot.y = 14;
      e.body.w = 8;
      e.body.h = 2;
      e.bodyOffset.x = -4;
      e.bodyOffset.y = -2;
      e.health = 1;
      e.isInteractable = true;
      break;

    case Type.ITEM_TWIG:
      e.spriteId = "item_twig";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 12;
      break;

    case Type.ITEM_FLINT:
      e.spriteId = "item_flint";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 12;
      break;

    case Type.ITEM_LOG:
      e.spriteId = "item_log";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 12;
      break;

    case Type.ITEM_ROCK:
      e.spriteId = "item_rock";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 12;
      break;

    case Type.ITEM_PORTAL_SHARD:
      e.spriteId = "item_portal_shard";
      e.state = State.ITEM_IDLE;
      e.pivot.x = 8;
      e.pivot.y = 12;
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

    case Type.BUILDING_FURNACE:
      e.spriteId = "building_furnace";
      e.pivot.x = 8;
      e.pivot.y = 14;
      e.body.w = 10;
      e.body.h = 2;
      e.bodyOffset.x = -5;
      e.bodyOffset.y = -2;
      e.isInteractable = true;
      e.isBuilding = true;
      break;

    case Type.BUILDING_ANVIL:
      e.spriteId = "building_anvil";
      e.pivot.x = 8;
      e.pivot.y = 12;
      e.body.w = 8;
      e.body.h = 2;
      e.bodyOffset.x = -3;
      e.bodyOffset.y = -2;
      e.isInteractable = true;
      e.isBuilding = true;
      break;

    case Type.BUILDING_PORTAL_HOME:
      e.spriteId = "building_portal";
      e.pivot.x = 16;
      e.pivot.y = 24;
      e.body.w = 18;
      e.body.h = 4;
      e.bodyOffset.x = -9;
      e.bodyOffset.y = -4;
      e.isInteractable = true;
      e.isBuilding = true;
      e.isPortal = true;
      break;

    case Type.BUILDING_PORTAL_FOREST:
      e.spriteId = "building_portal";
      e.pivot.x = 16;
      e.pivot.y = 24;
      e.body.w = 18;
      e.body.h = 4;
      e.bodyOffset.x = -9;
      e.bodyOffset.y = -4;
      e.isInteractable = true;
      e.isBuilding = true;
      e.isPortal = true;
      break;
  }
  scene.entities[id] = e;
  scene.active.push(id);
  scene.render.push(id);
  return e;
}

function destroyEntity(scene: Scene, id: string) {
  scene.destroyed.push(id);
}

const enum SceneId {
  HOME = "home",
  FOREST = "forest",
}

type Scene = {
  entities: Dict<Entity>;
  active: string[];
  render: string[];
  destroyed: string[];
  textureId: string;
  playerId: string;
  interactableId: string;
  selectedMenuItemIndex: number;
  selectedBuildingId: string;
  selectedBuildingRecipes: Array<Type>;
  boundary: Rectangle;
};

function createScene(id: SceneId) {
  const scene: Scene = {
    entities: {},
    active: [],
    render: [],
    destroyed: [],
    textureId: "",
    playerId: "",
    interactableId: "",
    selectedMenuItemIndex: 0,
    selectedBuildingId: "",
    selectedBuildingRecipes: [],
    boundary: rect(),
  };
  switch (id) {
    case SceneId.HOME:
      createEntity(scene, 160, 90, Type.PLAYER);
      createEntity(scene, 120, 80, Type.BUILDING_CRAFTING_TABLE);
      createEntity(scene, 140, 80, Type.BUILDING_FURNACE);
      createEntity(scene, 180, 80, Type.BUILDING_ANVIL);
      createEntity(scene, 160, 80, Type.CHEST);
      createEntity(scene, 160, 40, Type.BUILDING_PORTAL_FOREST);
      break;

    case SceneId.FOREST:
      scene.textureId = "grass";
      setupSceneFromImage(scene, "forest");
      break;
  }
  game.scenes[id] = scene;
  return scene;
}

function setupSceneFromImage(scene: Scene, textureId: string) {
  const texture = getTexture(textureId);
  for (let x = 0; x < texture.width; x++) {
    for (let y = 0; y < texture.height; y++) {
      const pixel = getPixel(texture, x, y);
      const type = ENTITY_COLOR[pixel.hex];
      if (type) {
        createEntity(scene, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, type);
      }
    }
  }
  scene.boundary.w = texture.width * TILE_SIZE;
  scene.boundary.h = texture.height * TILE_SIZE;
}

function switchScene(id: SceneId) {
  game.sceneId = id;
  const scene = game.scenes[game.sceneId];
  const player = scene.entities[scene.playerId];
  setCameraPosition(player.pos.x, player.pos.y);
  setCameraBounds(scene.boundary);
}

const enum GameState {
  NORMAL = "normal",
  CRAFTING_MENU = "crafting_menu",
}

type Game = {
  scenes: Dict<Scene>;
  sceneId: string;
  inventory: Dict<number>;
  tools: Dict<boolean>;
  buildings: Dict<boolean>;
  state: GameState;
};

const game: Game = {
  scenes: {},
  sceneId: "",
  inventory: {
    [Type.ITEM_TWIG]: 0,
    [Type.ITEM_FLINT]: 0,
    [Type.ITEM_LOG]: 0,
    [Type.ITEM_ROCK]: 0,
    [Type.ITEM_IRON_ORE]: 0,
    [Type.ITEM_IRON_INGOT]: 0,
    [Type.ITEM_PORTAL_SHARD]: 0,
  },
  tools: {
    [Type.TOOL_AXE]: true,
    [Type.TOOL_PICKAXE]: false,
  },
  buildings: {
    [Type.BUILDING_CRAFTING_TABLE]: false,
    [Type.BUILDING_FURNACE]: false,
    [Type.BUILDING_ANVIL]: false,
    [Type.BUILDING_PORTAL_HOME]: true,
    [Type.BUILDING_PORTAL_FOREST]: false,
  },
  state: GameState.NORMAL,
};

async function setup() {
  await loadAssets(ASSETS);

  createScene(SceneId.HOME);
  createScene(SceneId.FOREST);

  switchScene(SceneId.FOREST);

  setCameraSmoothing(0.05);
  setBackgroundColor("#808080");
  setFont("default");
}

function update() {
  if (isInputDown(InputCode.KEY_CTRL_LEFT) && isInputPressed(InputCode.KEY_R)) {
    document.location.reload();
  }

  const scene = game.scenes[game.sceneId];
  const player = scene.entities[scene.playerId];

  switch (game.state) {
    case GameState.NORMAL:
      for (const id of scene.active) {
        const e = scene.entities[id];
        updateState(scene, e);
        updateCollisions(scene, e);
        updateHitbox(scene, e);
        updateFlash(e);
      }
      break;

    case GameState.CRAFTING_MENU:
      updateCraftingMenu(scene);
      break;
  }

  updateCamera(player.pos.x, player.pos.y);
  cleanUpEntities(scene);
}

function playerMove(e: Entity) {
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
  if (getVectorLength(e.vel) > 0) {
    normalizeVector(e.vel);
    scaleVector(e.vel, PLAYER_SPEED);
    addVectorScaled(e.pos, e.vel, getDelta());
    setState(e, State.PLAYER_WALK);
  } else {
    setState(e, State.PLAYER_IDLE);
  }
}

function playerInteract(scene: Scene, e: Entity) {
  updateNearestInteractable(scene, e);
  const interactable = scene.entities[scene.interactableId];
  if (interactable) {
    if (interactable.isBuilding) {
      if (isInputPressed(InputCode.KEY_Z)) {
        consumeInputPressed(InputCode.KEY_Z);
        setState(e, State.PLAYER_INTERACT_BUILDING);
      }
    } else {
      if (isInputDown(InputCode.KEY_Z)) {
        setState(e, State.PLAYER_INTERACT_RESOURCE);
      }
    }
  }
}

function updateState(scene: Scene, e: Entity) {
  switch (e.state) {
    case State.PLAYER_IDLE:
      playerMove(e);
      playerInteract(scene, e);
      tickTimer(e.timer1, Infinity);
      e.scale = tween(1, 1.1, 2000, "easeInOutSine", e.timer1);
      break;

    case State.PLAYER_WALK:
      playerMove(e);
      playerInteract(scene, e);
      tickTimer(e.timer1, Infinity);
      e.offset.y = -tween(0, 1, 100, "easeInOutSine", e.timer1);
      break;

    case State.PLAYER_INTERACT_RESOURCE:
      if (interactWithResource(scene, e)) {
        setState(e, State.PLAYER_IDLE);
      }
      break;

    case State.PLAYER_INTERACT_BUILDING:
      interactWithBuilding(scene);
      setState(e, State.PLAYER_IDLE);
      break;

    case State.ITEM_IDLE:
      if (tickTimer(e.timer1, ITEM_DELAY_TIME)) {
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
    case State.TREE_IDLE:
      tickTimer(e.timer1, Infinity);
      e.angle = tween(-2, 2, e.duration, "easeInOutSine", e.timer1);
      break;
  }
}

function interactWithResource(scene: Scene, player: Entity) {
  const e = scene.entities[scene.interactableId];
  const completed = tickTimer(player.timer1, PLAYER_INTERACT_TIME);
  const trigger = tickTimer(player.timer2, PLAYER_INTERACT_TIME / 2);
  player.scale = tween(1, 1.25, PLAYER_INTERACT_TIME / 2, "easeInOutSine", player.timer1);
  if (trigger) {
    e.health -= 1;
    e.isFlashing = true;
    resetTimer(e.flashTimer);
    setCameraShakeIntensity(0.5);
    setCameraShakeReduction(0.05);
    if (e.health <= 0) {
      for (const loot of LOOT_TABLE[e.type]) {
        if (roll(loot.chance)) {
          createEntity(scene, e.pos.x + random(-4, 4), e.pos.y + random(-4, 4), loot.item);
        }
      }
      destroyEntity(scene, e.id);
    }
  }
  return completed;
}

function interactWithBuilding(scene: Scene) {
  const e = scene.entities[scene.interactableId];
  if (e.isPortal && game.buildings[e.type]) {
    switchScene(PORTAL_DESTINATION[e.type]);
  } else {
    scene.selectedBuildingId = e.id;
    scene.selectedBuildingRecipes.length = 0;
    if (game.buildings[e.type]) {
      for (const recipe of CRAFTING_BOOK[e.type].unlocks) {
        if (!game.tools[recipe]) {
          scene.selectedBuildingRecipes.push(recipe);
        }
      }
    } else {
      scene.selectedBuildingRecipes.push(e.type);
    }
    scene.selectedMenuItemIndex = clamp(scene.selectedMenuItemIndex, 0, scene.selectedBuildingRecipes.length - 1);
    if (scene.selectedBuildingRecipes.length) {
      game.state = GameState.CRAFTING_MENU;
    } else {
      game.state = GameState.NORMAL;
    }
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

function updateHitbox(scene: Scene, e: Entity) {
  if (isRectangleValid(e.hitbox)) {
    copyVector(e.hitbox, e.pos);
    addVector(e.hitbox, e.hitboxOffset);
    const player = scene.entities[scene.playerId];
    e.alpha = doesRectangleContain(e.hitbox, player.pos.x, player.pos.y) ? 0.5 : 1;
  }
}

function updateFlash(e: Entity) {
  if (e.isFlashing) {
    if (tickTimer(e.flashTimer, 100)) {
      e.isFlashing = false;
    }
    e.scale = tween(1, 1.2, 50, "easeInOutSine", e.flashTimer);
  }
}

function updateCraftingMenu(scene: Scene) {
  if (scene.selectedBuildingRecipes.length === 0) {
    game.state = GameState.NORMAL;
    return;
  }
  const building = scene.entities[scene.selectedBuildingId];
  const type = scene.selectedBuildingRecipes[scene.selectedMenuItemIndex];
  const recipe = CRAFTING_BOOK[type];
  if (isInputPressed(InputCode.KEY_LEFT)) {
    consumeInputPressed(InputCode.KEY_LEFT);
    scene.selectedMenuItemIndex = Math.max(0, scene.selectedMenuItemIndex - 1);
  }
  if (isInputPressed(InputCode.KEY_RIGHT)) {
    consumeInputPressed(InputCode.KEY_RIGHT);
    scene.selectedMenuItemIndex = Math.min(scene.selectedBuildingRecipes.length - 1, scene.selectedMenuItemIndex + 1);
  }
  if (isInputPressed(InputCode.KEY_ESCAPE)) {
    consumeInputPressed(InputCode.KEY_ESCAPE);
    game.state = GameState.NORMAL;
  }
  if (isInputPressed(InputCode.KEY_Z)) {
    consumeInputPressed(InputCode.KEY_Z);
    const isCraftable = recipe.ingredients.every((ingredient) => game.inventory[ingredient.item] >= ingredient.amount);
    if (isCraftable) {
      if (type in game.tools) {
        game.tools[type] = true;
      }
      if (type in game.buildings) {
        game.buildings[type] = true;
      }
      if (type in game.inventory) {
        game.inventory[type] = Math.min(game.inventory[type] + 1, MAX_ITEM_COUNT);
      }
      for (const ingredient of recipe.ingredients) {
        game.inventory[ingredient.item] -= ingredient.amount;
      }
      if (!building.isPortal) {
        interactWithBuilding(scene);
      } else {
        game.state = GameState.NORMAL;
      }
    }
  }
}

function updateNearestInteractable(scene: Scene, player: Entity) {
  scene.interactableId = "";
  let smallestDistance = Infinity;
  for (const id of scene.active) {
    const target = scene.entities[id];
    const tool = TOOL_REQUIRED[target.type];
    const distance = getVectorDistance(player.pos, target.pos);
    if (target.isInteractable && distance < PLAYER_INTERACT_RANGE && distance < smallestDistance) {
      if (tool && !game.tools[tool]) {
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

function render() {
  const scene = game.scenes[game.sceneId];

  if (scene.textureId) {
    applyCameraTransform();
    drawTexture(scene.textureId, 0, 0);
  }

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
      if (e.isBuilding) {
        if (!game.buildings[e.type]) {
          if (e.id === scene.interactableId) {
            drawSprite("icon_construct", -8, 0);
          }
          setAlpha(0.5);
        } else {
          setAlpha(e.alpha);
        }
      } else {
        setAlpha(e.alpha);
      }
      drawSprite(e.isFlashing ? `${e.spriteId}_flash` : e.spriteId, -e.pivot.x, -e.pivot.y);
      setAlpha(1);
      if (e.id === scene.interactableId) {
        drawSprite(`${e.spriteId}_outline`, -e.pivot.x, -e.pivot.y);
      }
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
    const recipe = CRAFTING_BOOK[id];
    const isSelected = i === scene.selectedMenuItemIndex;
    const sprite = getSprite(recipe.spriteId);
    const x = WIDTH / 2 + i * 16 - recipes.length * 8;
    const y = HEIGHT - 20;
    resetTransform();
    translateTransform(x, y);
    drawSprite("box", 0, 0);
    if (isSelected) {
      drawSprite("box_selection", 0, 0);
    }
    const scale = 16 / sprite.w;
    scaleTransform(scale, scale);
    translateTransform(8, 8);
    drawSprite(recipe.spriteId, -8, -8);
    if (isSelected) {
      renderCraftingRecipe(id, x, y);
    }
  }
}

function renderCraftingRecipe(type: Type, anchorX: number, anchorY: number) {
  const recipe = CRAFTING_BOOK[type];
  const sprite = getSprite("tooltip");
  const x = anchorX;
  const y = anchorY - sprite.h - 2;
  resetTransform();
  translateTransform(x - sprite.w / 2 + 8, y);
  drawSprite("tooltip", 0, 0);
  translateTransform(4, 4);
  scaleTransform(1.25, 1.25);
  drawText(recipe.name, 0, 0);
  scaleTransform(0.8, 0.8);
  translateTransform(0, 9);
  drawText(recipe.description, 0, 0, "gray");
  translateTransform(0, 8);
  for (const ingredient of recipe.ingredients) {
    const item = ITEMS[ingredient.item];
    const count = game.inventory[ingredient.item];
    const color = count >= ingredient.amount ? "white" : "red";
    drawSprite(item.spriteId, -2, -4);
    drawText(item.name, 14, 2, color);
    drawText(`${count}/${ingredient.amount}`, sprite.w - 10, 2, color, "right");
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
      const item = ITEMS[type];
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
      const tool = CRAFTING_BOOK[type];
      drawSprite("box", 0, 0);
      drawSprite(tool.spriteId, 0, 0);
      translateTransform(16, 0);
    }
  }
}

function renderMetrics() {
  resetTransform();
  translateTransform(1, 1);
  scaleTransform(0.5, 0.5);
  drawText(getFramePerSecond().toString(), 0, 0, "lime");
}

run({
  width: WIDTH,
  height: HEIGHT,
  setup,
  update,
  render,
});
