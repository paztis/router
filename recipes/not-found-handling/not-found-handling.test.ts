import { describe, it } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import request from 'supertest';

import {
  createRouteMatchedApp,
  createMatchedArrayApp,
  createCatchAllApp,
  createNotFoundEventApp,
  createSelectorFunctionApp,
  createRawStringEventApp,
  createComposedNotFoundApp,
  createFullNotFoundApp
} from './not-found-handling';

describe('Not Found Handling recipes', () => {
  describe('Approach 1: ctx.routeMatched', () => {
    it('should return the route body for known routes', async () => {
      const server = http.createServer(createRouteMatchedApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should return 404 for unknown paths', async () => {
      const server = http.createServer(createRouteMatchedApp().callback());
      const res = await request(server).get('/unknown').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
      assert.strictEqual(res.body.path, '/unknown');
    });

    it('should return 405 for wrong method (allowedMethods is active)', async () => {
      const server = http.createServer(createRouteMatchedApp().callback());
      await request(server).delete('/users').expect(405);
    });
  });

  describe('Approach 2: ctx.matched array', () => {
    it('should return the route body for known routes', async () => {
      const server = http.createServer(createMatchedArrayApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should return 404 for unknown paths', async () => {
      const server = http.createServer(createMatchedArrayApp().callback());
      const res = await request(server).get('/unknown').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
    });
  });

  describe('Approach 3: catch-all route with !ctx.body', () => {
    it('should return body for known routes', async () => {
      const server = http.createServer(createCatchAllApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should return 404 via catch-all for unknown paths', async () => {
      const server = http.createServer(createCatchAllApp().callback());
      const res = await request(server).get('/unknown').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
    });

    it('should not override response from matched route', async () => {
      const server = http.createServer(createCatchAllApp().callback());
      const res = await request(server).get('/posts').expect(200);
      assert.deepStrictEqual(res.body, { posts: [] });
    });
  });

  describe('Approach 4: router.on() with RouterEvents constant', () => {
    it('should return body for known routes', async () => {
      const server = http.createServer(createNotFoundEventApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should fire not-found handler for unknown paths', async () => {
      const server = http.createServer(createNotFoundEventApp().callback());
      const res = await request(server).get('/unknown').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
      assert.strictEqual(res.body.path, '/unknown');
      assert.strictEqual(res.body.method, 'GET');
    });
  });

  describe('Approach 5: router.on() with selector function', () => {
    it('should return body for known routes', async () => {
      const server = http.createServer(createSelectorFunctionApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should fire not-found handler for unknown paths', async () => {
      const server = http.createServer(createSelectorFunctionApp().callback());
      const res = await request(server).get('/anything').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
    });
  });

  describe('Approach 6: router.on() with raw string', () => {
    it('should return body for known routes', async () => {
      const server = http.createServer(createRawStringEventApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should fire not-found handler for unknown paths', async () => {
      const server = http.createServer(createRawStringEventApp().callback());
      const res = await request(server).get('/missing').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
    });
  });

  describe('Approach 7: composed not-found handlers', () => {
    it('should call both handlers in order', async () => {
      const logs: string[] = [];
      const server = http.createServer(
        createComposedNotFoundApp((msg) => logs.push(msg)).callback()
      );
      const res = await request(server).get('/nope').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
      assert.strictEqual(logs.length, 1);
      assert.ok(logs[0].includes('GET'));
      assert.ok(logs[0].includes('/nope'));
    });

    it('should not log for matched routes', async () => {
      const logs: string[] = [];
      const server = http.createServer(
        createComposedNotFoundApp((msg) => logs.push(msg)).callback()
      );
      await request(server).get('/users').expect(200);
      assert.strictEqual(logs.length, 0);
    });

    it('should include timestamp in response', async () => {
      const server = http.createServer(createComposedNotFoundApp().callback());
      const res = await request(server).get('/nope').expect(404);
      assert.ok(typeof res.body.timestamp === 'string');
    });
  });

  describe('Approach 8: not-found event + allowedMethods()', () => {
    it('should return body for GET /users', async () => {
      const server = http.createServer(createFullNotFoundApp().callback());
      const res = await request(server).get('/users').expect(200);
      assert.deepStrictEqual(res.body, { users: [] });
    });

    it('should return 201 for POST /users', async () => {
      const server = http.createServer(createFullNotFoundApp().callback());
      const res = await request(server).post('/users').expect(201);
      assert.deepStrictEqual(res.body, { created: true });
    });

    it('should return 404 for completely unknown path', async () => {
      const server = http.createServer(createFullNotFoundApp().callback());
      const res = await request(server).get('/unknown').expect(404);
      assert.strictEqual(res.body.error, 'Not Found');
    });

    it('should return 405 for wrong method on known path', async () => {
      const server = http.createServer(createFullNotFoundApp().callback());
      await request(server).delete('/users').expect(405);
    });

    it('should log 404 events', async () => {
      const logs: string[] = [];
      const server = http.createServer(
        createFullNotFoundApp((msg) => logs.push(msg)).callback()
      );
      await request(server).get('/unknown').expect(404);
      assert.strictEqual(logs.length, 1);
      assert.ok(logs[0].includes('/unknown'));
    });
  });
});
