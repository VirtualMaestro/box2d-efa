import assert from 'node:assert/strict';
import { test } from 'node:test';

import Standard from '../dist/box2d.mjs';
import Scalar from '../dist/box2d.scalar.mjs';
import Entry, { hasSimd } from '../dist/entry.mjs';

const standard = await Standard();
const scalar = await Scalar();

/** A pile falling on a floor: the positions, rotations and velocities of every body on every tick, as 32-bit words. */
function pile(b2, ticks = 300) {
  const v = (x, y) => { const r = new b2.b2Vec2(); r.x = x; r.y = y; return r; };
  const wd = b2.b2DefaultWorldDef();
  wd.gravity = v(0, -10);
  const world = b2.b2CreateWorld(wd);
  const floor = b2.b2DefaultBodyDef();
  floor.position = v(0, -1);
  b2.b2CreatePolygonShape(b2.b2CreateBody(world, floor), b2.b2DefaultShapeDef(), b2.b2MakeBox(50, 1));
  const bodies = [];
  for (let i = 0; i < 60; i++) {
    const bd = b2.b2DefaultBodyDef();
    bd.type = b2.b2BodyType.b2_dynamicBody;
    bd.position = v((i % 6) * 1.05 + (i % 7) * 0.01, 1 + Math.floor(i / 6) * 1.05);
    const id = b2.b2CreateBody(world, bd);
    b2.b2CreatePolygonShape(id, b2.b2DefaultShapeDef(), b2.b2MakeBox(0.5, 0.5));
    bodies.push(id);
  }
  const words = [], f = new Float32Array(1), u = new Uint32Array(f.buffer);
  const put = x => { f[0] = x; words.push(u[0]); };
  for (let t = 0; t < ticks; t++) {
    b2.b2World_Step(world, 1 / 60, 4);
    for (const id of bodies) {
      const p = b2.b2Body_GetPosition(id), q = b2.b2Body_GetRotation(id), w = b2.b2Body_GetLinearVelocity(id);
      put(p.x); put(p.y); put(q.c); put(q.s); put(w.x); put(w.y);
    }
  }
  const step = b2.b2World_GetProfile(world).step;
  b2.b2DestroyWorld(world);
  return { words, step };
}

test('the pile comes to rest above the floor, on both builds', () => {
  for (const b2 of [standard, scalar]) {
    const { words } = pile(b2);
    const f = new Float32Array(new Uint32Array(words.slice(-360)).buffer);
    for (let i = 0; i < 60; i++) assert.ok(f[i * 6 + 1] > 0.4, `body ${i} at y ${f[i * 6 + 1]}`);
  }
});

test('the SIMD and scalar builds give the same words on every tick', () => {
  assert.deepEqual(pile(standard).words, pile(scalar).words);
});

test('no clock in a step until asked for', () => {
  for (const b2 of [standard, scalar]) {
    assert.equal(pile(b2, 30).step, 0);
    b2.enableStepTimers(true);
    assert.ok(pile(b2, 30).step > 0);
    b2.enableStepTimers(false);
    assert.equal(pile(b2, 30).step, 0);
  }
});

test('the timers do not change results', () => {
  const off = pile(standard).words;
  standard.enableStepTimers(true);
  const on = pile(standard).words;
  standard.enableStepTimers(false);
  assert.deepEqual(on, off);
});

test('no threads in either build', () => {
  for (const b2 of [standard, scalar]) {
    assert.equal(b2.b2CreateThreadedWorld, undefined);
    assert.ok(b2.HEAPU8.buffer instanceof ArrayBuffer);
  }
});

test('the entry picks the SIMD build here', async () => {
  assert.equal(hasSimd(), true);
  assert.equal(typeof (await Entry()).b2CreateWorld, 'function');
});
