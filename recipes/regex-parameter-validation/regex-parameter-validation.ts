/**
 * Regex Parameter Validation Recipe (v14+)
 *
 * Demonstrates how to validate route parameters with regex in v14+,
 * where `:param(regex)` is no longer supported in the path string.
 *
 * Shows both styles:
 * - router.param('id', createParameterValidationMiddleware(...))
 * - router.get('/role/:id', createParameterValidationMiddleware(...), handler)
 */

import Router, {
  createParameterValidationMiddleware
} from '../router-module-loader';

const uuidRegex =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const router = new Router();

// ===========================================
// Style A: router.param() (applies to all routes using :id)
// ===========================================
router.param(
  'id',
  createParameterValidationMiddleware('id', uuidRegex, {
    status: 400,
    message: 'Invalid id (expected UUID)'
  })
);

router.get('/role/:id', (ctx) => {
  ctx.body = { id: ctx.params.id, source: 'router.param' };
});

// ===========================================
// Style B: Inline per-route middleware (applies to this route only)
// ===========================================
router.get(
  '/roles/:id',
  createParameterValidationMiddleware('id', uuidRegex, {
    status: 400,
    message: 'Invalid id (expected UUID)'
  }),
  (ctx) => {
    ctx.body = { id: ctx.params.id, source: 'inline' };
  }
);

export { router };
