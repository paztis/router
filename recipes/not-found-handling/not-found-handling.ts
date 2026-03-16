/**
 * Not Found Handling Recipe
 *
 * Demonstrates every approach to handling unmatched routes in @koa/router.
 * Choose the approach that best fits your application's architecture.
 *
 * Approaches covered:
 * 1. App-level middleware with `ctx.routeMatched`  (recommended, clean)
 * 2. App-level middleware with `ctx.matched`        (classic approach)
 * 3. Catch-all route with `!ctx.body`               (router-scoped, inline)
 * 4. router.on() with RouterEvents constant         (router-scoped, experimental)
 * 5. router.on() with selector function             (fluent style, experimental)
 * 6. router.on() with raw string                    (string style, experimental)
 * 7. Composed not-found handlers (logging + response)
 * 8. Combining not-found event with allowedMethods() for 404 vs 405 distinction
 */

import Koa from 'koa';
import Router, { RouterEvents } from '../router-module-loader';
import type { RouterMiddleware } from '../router-module-loader';

// ---------------------------------------------------------------------------
// Approach 1: App-level middleware with ctx.routeMatched (recommended)
// ---------------------------------------------------------------------------

/**
 * Uses `ctx.routeMatched` which is set by the router before any handlers run.
 * `true`  → a route matched path + method.
 * `false` → no route matched.
 *
 * This is the most explicit approach. It does not require a catch-all route
 * and works cleanly alongside `router.allowedMethods()`.
 */
export function createRouteMatchedApp() {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  router.post('/users', (ctx) => {
    ctx.status = 201;
    ctx.body = { created: true };
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  // Runs for any request the router did not handle
  app.use((ctx) => {
    if (!ctx.routeMatched) {
      ctx.status = 404;
      ctx.body = {
        error: 'Not Found',
        path: ctx.path,
        method: ctx.method
      };
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Approach 2: App-level middleware with ctx.matched (classic)
// ---------------------------------------------------------------------------

/**
 * Inspects the `ctx.matched` array which contains all layers (including
 * middleware layers) that matched the request path. An empty array means
 * nothing in the router matched at all.
 */
export function createMatchedArrayApp() {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  app.use((ctx) => {
    if (!ctx.matched || ctx.matched.length === 0) {
      ctx.status = 404;
      ctx.body = { error: 'Not Found', path: ctx.path };
    }
  });

  return app;
}

// ---------------------------------------------------------------------------
// Approach 3: Catch-all route with !ctx.body
// ---------------------------------------------------------------------------

/**
 * Registers a wildcard route for all methods. Checks `!ctx.body` so that
 * the catch-all only responds if no previous handler has set a response.
 *
 * Note: The catch-all itself sets `ctx.routeMatched = true`, so
 * `ctx.routeMatched` cannot be used as the condition here.
 */
export function createCatchAllApp() {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  router.get('/posts', (ctx) => {
    ctx.body = { posts: [] };
  });

  // Catch-all: runs for any path/method not matched above
  router.all('{/*rest}', (ctx) => {
    if (!ctx.body) {
      ctx.status = 404;
      ctx.body = { error: 'Not Found', path: ctx.path };
    }
  });

  app.use(router.routes());

  return app;
}

// ---------------------------------------------------------------------------
// Approach 4: router.on() with RouterEvents constant (experimental)
// ---------------------------------------------------------------------------

/**
 * Uses the experimental `router.on()` API with the `RouterEvents.NotFound`
 * constant. This is the recommended form — IDE autocomplete works and the
 * constant is refactor-safe.
 *
 * The handler fires instead of calling `next()` when no route matched.
 * It does not appear in `ctx.matched`.
 */
export function createNotFoundEventApp() {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  router.on(RouterEvents.NotFound, (ctx) => {
    ctx.status = 404;
    ctx.body = {
      error: 'Not Found',
      path: ctx.path,
      method: ctx.method
    };
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}

// ---------------------------------------------------------------------------
// Approach 5: router.on() with selector function (experimental)
// ---------------------------------------------------------------------------

/**
 * Uses a selector function `(events) => events.NotFound` instead of the constant.
 * Functionally identical to the constant form — personal style preference.
 */
export function createSelectorFunctionApp() {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  router.on(
    (events) => events.NotFound,
    (ctx) => {
      ctx.status = 404;
      ctx.body = { error: 'Not Found', path: ctx.path };
    }
  );

  app.use(router.routes());

  return app;
}

// ---------------------------------------------------------------------------
// Approach 6: router.on() with raw string (experimental)
// ---------------------------------------------------------------------------

/**
 * Uses a plain string. Works but provides no autocomplete or type checking.
 * Prefer the constant or selector form.
 */
export function createRawStringEventApp() {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  router.on('not-found', (ctx) => {
    ctx.status = 404;
    ctx.body = { error: 'Not Found' };
  });

  app.use(router.routes());

  return app;
}

// ---------------------------------------------------------------------------
// Approach 7: Composed not-found handlers (logging + response)
// ---------------------------------------------------------------------------

/**
 * Registers multiple handlers for the same event. They compose in
 * registration order following the koa-compose onion model.
 *
 * The first handler logs and calls `next()` to pass control to the second.
 * The second handler sets the actual response.
 */
export function createComposedNotFoundApp(
  log: (message: string) => void = () => {}
) {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  // First handler: logging
  const logHandler: RouterMiddleware = async (ctx, next) => {
    log(`[404] ${ctx.method} ${ctx.path}`);
    await next();
  };

  // Second handler: response
  const responseHandler: RouterMiddleware = (ctx) => {
    ctx.status = 404;
    ctx.body = {
      error: 'Not Found',
      path: ctx.path,
      method: ctx.method,
      timestamp: new Date().toISOString()
    };
  };

  router
    .on(RouterEvents.NotFound, logHandler)
    .on(RouterEvents.NotFound, responseHandler);

  app.use(router.routes());

  return app;
}

// ---------------------------------------------------------------------------
// Approach 8: Combining not-found event with allowedMethods() (404 vs 405)
// ---------------------------------------------------------------------------

/**
 * When used together with `router.allowedMethods()`, you can distinguish
 * between a true 404 (path never registered) and a 405 (path exists but
 * method is wrong) by inspecting `ctx.matched` inside the not-found handler.
 *
 * `router.on(RouterEvents.NotFound, ...)` fires whenever `matchResult.route`
 * is false — this covers BOTH cases:
 * - Path does not match any route at all → ctx.matched is empty
 * - Path matched but HTTP method didn't  → ctx.matched is non-empty
 *
 * By calling `next()` when `ctx.matched` is non-empty, we let
 * `allowedMethods()` produce the 405 response. Otherwise we set 404.
 */
export function createFullNotFoundApp(
  log: (message: string) => void = () => {}
) {
  const app = new Koa();
  const router = new Router();

  router.get('/users', (ctx) => {
    ctx.body = { users: [] };
  });

  router.post('/users', (ctx) => {
    ctx.status = 201;
    ctx.body = { created: true };
  });

  router.on(RouterEvents.NotFound, async (ctx, next) => {
    // Path matched but method didn't — let allowedMethods() handle it
    if (ctx.matched && ctx.matched.length > 0) {
      await next();
      return;
    }
    // Genuine 404: path was never registered
    log(`[404] ${ctx.method} ${ctx.path}`);
    ctx.status = 404;
    ctx.body = { error: 'Not Found', path: ctx.path };
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return app;
}
