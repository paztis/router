/**
 * @koa/router - RESTful resource routing middleware for Koa
 *
 * @module @koa/router
 */

export type {
  RouterOptions,
  RouterOptionsWithMethods,
  LayerOptions,
  UrlOptions,
  RouterParameterMiddleware,
  RouterMiddleware,
  RouterMethodFunction,
  RouterContext,
  MatchResult,
  AllowedMethodsOptions,
  Layer,
  HttpMethod,
  RouterWithMethods,
  RouterEvent,
  RouterEventSelector
} from './types';

export { RouterEvents } from './utils/router-events';

export {
  createParameterValidationMiddleware,
  type ParameterValidationOptions
} from './utils/parameter-match';

export { default, Router, type RouterInstance } from './router';
