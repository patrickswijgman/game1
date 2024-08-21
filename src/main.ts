import { addVector, addVectorScaled, applyCameraTransform, copyVector, delta, drawRect, drawSprite, drawText, fps, getRandomId, getTexture, getVectorDistance, InputCode, isInputDown, isInputPressed, isRectangleValid, loadRenderTexture, loadSprite, loadTexture, normalizeVector, rect, Rectangle, remove, resetTimer, resetTransform, resetVector, rotateTransform, run, scaleTransform, scaleVector, setCamera, tickTimer, timer, Timer, translateTransform, tween, updateCamera, vec, Vector, writeIntersectionBetweenRectangles } from "ridder";

const DEBUG = true;
const PLAYER_SPEED = 1.125;
const PLAYER_RANGE = 10;
const PLAYER_INTERACT_TIME = 200;

function loadSprites(id: string, textureId: string, x: number, y: number, w: number, h: number) {
  loadSprite(id, textureId, x, y, w, h);
  loadSprite(`${id}_outline`, `${textureId}_outline`, x, y, w, h);
}

enum ArcheType {
  NIL,
  PLAYER,
  TREE,
  ROCK,
}

type Entity = {
  id: string;
  archeType: ArcheType;
  pos: Vector;
  vel: Vector;
  body: Rectangle;
  bodyOffset: Vector;
  intersection: Vector;
  spriteId: string;
  pivot: Vector;
  angle: number;
  scale: number;
  timer: Timer;
  isRigid: boolean;
  isFlipped: boolean;
  isInteractable: boolean;
  isInteracting: boolean;
  isOutlineVisible: boolean;
};

function createEntity(scene: Scene, x: number, y: number) {
  const e: Entity = {
    id: getRandomId(),
    archeType: ArcheType.NIL,
    pos: vec(x, y),
    vel: vec(),
    body: rect(),
    bodyOffset: vec(),
    intersection: vec(),
    spriteId: "",
    pivot: vec(),
    angle: 0,
    scale: 1,
    timer: timer(),
    isRigid: false,
    isFlipped: false,
    isInteractable: false,
    isInteracting: false,
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

function setupPlayer(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.archeType = ArcheType.PLAYER;
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

function setupTree(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.archeType = ArcheType.TREE;
  e.spriteId = "tree";
  e.pivot.x = 16;
  e.pivot.y = 31;
  e.body.w = 2;
  e.body.h = 2;
  e.bodyOffset.x = -1;
  e.bodyOffset.y = -2;
  e.isInteractable = true;
}

function setupRock(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.archeType = ArcheType.ROCK;
  e.spriteId = "rock";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 10;
  e.body.h = 3;
  e.bodyOffset.x = -5;
  e.bodyOffset.y = -3;
  e.isInteractable = true;
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

function setupWorldScene() {
  const scene = createScene("world");
  setupPlayer(scene, 120, 65);
  setupTree(scene, 100, 50);
  setupRock(scene, 120, 40);
  setCamera(120, 65);
}

type Game = {
  scenes: Record<string, Scene>;
  sceneId: string;
};

const game: Game = {
  scenes: {},
  sceneId: "",
};

function findInteractable(scene: Scene, player: Entity) {
  scene.interactableId = "";
  let smallestDistance = Infinity;
  for (const id of scene.active) {
    const target = scene.entities[id];
    const distance = getVectorDistance(player.pos, target.pos);
    if (target.isInteractable && distance < PLAYER_RANGE && distance < smallestDistance) {
      smallestDistance = distance;
      scene.interactableId = id;
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

run({
  settings: {
    width: 320,
    height: 180,
    cameraSmoothing: 0.05,
    background: "#1e1e1e",
  },

  setup: async () => {
    await loadTexture("atlas", "textures/atlas.png");
    loadRenderTexture("atlas_outline", 256, 256, (ctx) => {
      const tex = getTexture("atlas");
      ctx.drawImage(tex, 0, -1);
      ctx.drawImage(tex, 1, 0);
      ctx.drawImage(tex, 0, 1);
      ctx.drawImage(tex, -1, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, tex.width, tex.height);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(tex, 0, 0);
    });
    loadSprites("player", "atlas", 0, 0, 16, 16);
    loadSprites("tree", "atlas", 0, 16, 32, 32);
    loadSprites("rock", "atlas", 32, 32, 16, 16);
    setupWorldScene();
    game.sceneId = "world";
  },

  update: () => {
    const scene = game.scenes[game.sceneId];
    const player = scene.entities[scene.playerId];

    for (const id of scene.active) {
      const e = scene.entities[id];

      switch (e.archeType) {
        case ArcheType.PLAYER:
          {
            if (e.isInteracting) {
              if (tickTimer(e.timer, PLAYER_INTERACT_TIME)) {
                e.isInteracting = false;
                destroyEntity(scene, scene.interactableId);
              }
              e.scale = tween(1, 1.25, PLAYER_INTERACT_TIME / 2, "easeInOutSine", e.timer);
            } else {
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
              findInteractable(scene, e);
              if (scene.interactableId && isInputPressed(InputCode.KEY_SPACE)) {
                e.isInteracting = true;
                resetTimer(e.timer);
              }
            }
          }
          break;
        case ArcheType.TREE:
          {
            tickTimer(e.timer, Infinity);
            e.angle = tween(-2, 2, 2000, "easeInOutSine", e.timer);
          }
          break;
      }

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

      e.isOutlineVisible = id === scene.interactableId;
    }

    updateCamera(player.pos.x, player.pos.y);
    cleanUpEntities(scene);
    depthSortEntities(scene);

    for (const id of scene.visible) {
      const e = scene.entities[id];
      resetTransform();
      applyCameraTransform();
      translateTransform(e.pos.x, e.pos.y);
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
  },
});
