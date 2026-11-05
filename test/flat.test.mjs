import assert from 'node:assert/strict';
import { test } from 'node:test';

import Standard from '../dist/box2d.mjs';
import Scalar from '../dist/box2d.scalar.mjs';

/** A pile on a floor, one body destroyed on the way: readMoved against the same values through embind, tick by tick. */
for (const [name, load] of [['standard', Standard], ['scalar', Scalar]]) {
  test(`${name}: readMoved gives what the move events and the bodies give`, async () => {
    const b2 = await load();
    const v = (x, y) => { const r = new b2.b2Vec2(); r.x = x; r.y = y; return r; };
    const wd = b2.b2DefaultWorldDef();
    wd.gravity = v(0, -10);
    const world = b2.b2CreateWorld(wd);
    const floor = b2.b2DefaultBodyDef();
    floor.position = v(0, -1);
    b2.b2CreatePolygonShape(b2.b2CreateBody(world, floor), b2.b2DefaultShapeDef(), b2.b2MakeBox(50, 1));
    assert.equal(b2.readMoved(world), 0, 'nothing moved yet');
    const bodies = [];
    for (let i = 0; i < 60; i++) {
      const bd = b2.b2DefaultBodyDef();
      bd.type = b2.b2BodyType.b2_dynamicBody;
      bd.position = v((i % 6) * 1.05, 1 + Math.floor(i / 6) * 1.05);
      bd.angularVelocity = i * 0.1;
      const id = b2.b2CreateBody(world, bd);
      b2.b2CreatePolygonShape(id, b2.b2DefaultShapeDef(), b2.b2MakeBox(0.5, 0.5));
      bodies.push(id);
    }
    const f = new Float32Array(1);
    const fround = x => { f[0] = x; return f[0]; };
    let moved = 0;
    for (let t = 0; t < 200; t++) {
      b2.b2World_Step(world, 1 / 60, 4);
      const events = b2.b2World_GetBodyEvents(world), count = events.moveCount;
      const written = b2.readMoved(world), at = b2.flatOut() >> 2, u = b2.HEAPU32, h = b2.HEAPF32;
      assert.equal(written, count);
      for (let i = 0; i < count; i++) {
        const e = events.GetMoveEvent(i), id = e.bodyId, p = e.transform.p, w = b2.b2Body_GetLinearVelocity(id), o = at + 8 * i;
        assert.equal(u[o], id.index1);
        assert.equal(u[o + 1], id.generation);
        assert.deepEqual([h[o + 2], h[o + 3], h[o + 4], h[o + 5], h[o + 6], h[o + 7]], [p.x, p.y, b2.b2Rot_GetAngle(e.transform.q), w.x, w.y, b2.b2Body_GetAngularVelocity(id)].map(fround));
        w.delete(); e.delete();
      }
      events.delete();
      moved += count;
      if (t === 100) {
        // Destroyed after the step: the event is gone or its body is skipped, and readMoved survives it either way.
        b2.b2DestroyBody(bodies[59]);
        assert.ok(b2.readMoved(world) <= count);
      }
    }
    assert.ok(moved > 60, `moved ${moved}`);
    b2.b2DestroyWorld(world);
  });
}
