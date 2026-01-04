/**
 * Tests for Regex Parameter Validation Recipe
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as http from 'node:http';
import request from 'supertest';
import Koa from 'koa';

import Router from '../router-module-loader';
import { createParameterValidationMiddleware } from '../router-module-loader';

describe('Regex Parameter Validation', () => {
  it('should validate UUID via router.param()', async () => {
    const app = new Koa();
    const router = new Router();

    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    router.param(
      'id',
      createParameterValidationMiddleware('id', uuidRegex, {
        status: 400,
        message: 'Invalid id (expected UUID)'
      })
    );

    router.get('/role/:id', (ctx) => {
      ctx.body = { id: ctx.params.id, ok: true };
    });

    app.use(router.routes());

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    const res1 = await request(http.createServer(app.callback()))
      .get(`/role/${validUUID}`)
      .expect(200);

    assert.strictEqual(res1.body.ok, true);
    assert.strictEqual(res1.body.id, validUUID);

    await request(http.createServer(app.callback()))
      .get('/role/invalid-id')
      .expect(400);
  });

  it('should validate UUID inline on a specific route', async () => {
    const app = new Koa();
    const router = new Router();

    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

    router.get(
      '/roles/:id',
      createParameterValidationMiddleware('id', uuidRegex, {
        status: 400,
        message: 'Invalid id (expected UUID)'
      }),
      (ctx) => {
        ctx.body = { id: ctx.params.id, ok: true };
      }
    );

    // A different route with same param name, but without validation
    router.get('/roles-unvalidated/:id', (ctx) => {
      ctx.body = { id: ctx.params.id, ok: true };
    });

    app.use(router.routes());

    const validUUID = '123e4567-e89b-12d3-a456-426614174000';
    await request(http.createServer(app.callback()))
      .get(`/roles/${validUUID}`)
      .expect(200);

    await request(http.createServer(app.callback()))
      .get('/roles/invalid-id')
      .expect(400);

    // This should NOT be validated (inline middleware applies only to /roles/:id)
    await request(http.createServer(app.callback()))
      .get('/roles-unvalidated/invalid-id')
      .expect(200);
  });
});
