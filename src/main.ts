import {
  addVector,
  addVectorScaled,
  applyCameraTransform,
  copyVector,
  delta,
  drawRect,
  drawSprite,
  drawText,
  fps,
  getRandomId,
  getTexture,
  InputCode,
  isInputDown,
  isRectangleValid,
  loadRenderTexture,
  loadSprite,
  loadTexture,
  normalizeVector,
  rect,
  Rectangle,
  remove,
  resetTransform,
  resetVector,
  run,
  scaleTransform,
  scaleVector,
  setCamera,
  translateTransform,
  updateCamera,
  vec,
  Vector,
  writeIntersectionBetweenRectangles,
} from "ridder";

const DEBUG = false;

function loadSprites(
  id: string,
  textureId: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  loadSprite(id, textureId, x, y, w, h);
  loadSprite(`${id}_outline`, `${textureId}_outline`, x, y, w, h);
}

type Entity = {
  id: string;
  pos: Vector;
  vel: Vector;
  body: Rectangle;
  bodyOffset: Vector;
  bodyIntersectionResult: Vector;
  spriteId: string;
  pivot: Vector;
  isPlayer: boolean;
  isFlipped: boolean;
  isOutlineVisible: boolean;
};

function createEntity(scene: Scene, x: number, y: number) {
  const e: Entity = {
    id: getRandomId(),
    pos: vec(x, y),
    vel: vec(),
    body: rect(),
    bodyOffset: vec(),
    bodyIntersectionResult: vec(),
    spriteId: "",
    pivot: vec(),
    isPlayer: false,
    isFlipped: false,
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
  e.spriteId = "player";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 8;
  e.body.h = 3;
  e.bodyOffset.x = -4;
  e.bodyOffset.y = -3;
  e.isPlayer = true;
  scene.playerId = e.id;
}

function setupTree(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.spriteId = "tree";
  e.pivot.x = 16;
  e.pivot.y = 31;
}

function setupRock(scene: Scene, x: number, y: number) {
  const e = createEntity(scene, x, y);
  e.spriteId = "rock";
  e.pivot.x = 8;
  e.pivot.y = 15;
  e.body.w = 10;
  e.body.h = 3;
  e.bodyOffset.x = -5;
  e.bodyOffset.y = -3;
}

type Scene = {
  entities: Record<string, Entity>;
  active: string[];
  visible: string[];
  destroyed: string[];
  playerId: string;
};

function createScene(id: string) {
  const scene: Scene = {
    entities: {},
    active: [],
    visible: [],
    destroyed: [],
    playerId: "",
  };
  scenes[id] = scene;
  return scene;
}

function setupWorldScene() {
  const scene = createScene("world");
  setupPlayer(scene, 120, 65);
  setupTree(scene, 100, 50);
  setupRock(scene, 120, 40);
  setCamera(120, 65);
}

const scenes: Record<string, Scene> = {};
let sceneId = "";

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
    sceneId = "world";
  },

  update: () => {
    const scene = scenes[sceneId];

    for (const id of scene.active) {
      const e = scene.entities[id];

      if (e.isPlayer) {
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
        scaleVector(e.vel, 1.125);
        addVectorScaled(e.pos, e.vel, delta);
        updateCamera(e.pos.x, e.pos.y);
      }

      if (isRectangleValid(e.body)) {
        copyVector(e.body, e.pos);
        addVector(e.body, e.bodyOffset);
        resetVector(e.bodyIntersectionResult);

        for (const id of scene.active) {
          writeIntersectionBetweenRectangles(
            e.body,
            scene.entities[id].body,
            e.vel,
            e.bodyIntersectionResult,
          );
        }

        const { x, y } = e.bodyIntersectionResult;
        if (x) {
          e.body.x += x;
          e.pos.x += x;
          e.vel.x = 0;
        }
        if (y) {
          e.body.y += y;
          e.pos.y += y;
          e.vel.y = 0;
        }
      }
    }

    if (scene.destroyed.length) {
      for (const id of scene.destroyed) {
        delete scene.entities[id];
        remove(scene.active, id);
        remove(scene.visible, id);
      }
      scene.destroyed.length = 0;
    }

    scene.visible.sort((idA, idB) => {
      const a = scene.entities[idA];
      const b = scene.entities[idB];
      return a.pos.y - b.pos.y;
    });

    for (const id of scene.visible) {
      const e = scene.entities[id];
      resetTransform();
      applyCameraTransform();
      translateTransform(e.pos.x, e.pos.y);
      if (e.isFlipped) {
        scaleTransform(-1, 1);
      }
      drawSprite(e.spriteId, -e.pivot.x, -e.pivot.y);
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
