/**
 * Parameter validation helpers.
 *
 * These utilities exist to help migrate legacy `:param(regex)` usage from older
 * router/path-to-regexp versions to v14+ (path-to-regexp v8), where inline
 * parameter regexes are no longer supported in route strings.
 */

import createHttpError from 'http-errors';

import type {
  RouterContext,
  RouterMiddleware,
  RouterParameterMiddleware
} from '../types';

/**
 * Options for createParameterValidationMiddleware helper
 */
export type ParameterValidationOptions = {
  /**
   * HTTP status to use when the value does not match
   * @default 400
   */
  status?: number;

  /**
   * Error message to use when the value does not match
   * @default `Invalid value for parameter "<parameterName>"`
   */
  message?: string;

  /**
   * Whether the error message should be exposed to the client.
   * Passed through to HttpError#expose.
   */
  expose?: boolean;

  /**
   * Optional custom error factory. If provided, it is used
   * instead of the default HttpError.
   */
  createError?: (parameterName: string, value: string) => Error;
};

/**
 * Convenience helper to recreate legacy `:param(regex)` validation.
 *
 * @example
 * const validateUuid = createParameterValidationMiddleware('id', uuidRegex);
 * router.param('id', validateUuid).get('/role/:id', handler);
 * router.get('/role/:id', createParameterValidationMiddleware('id', uuidRegex)
 */
export function createParameterValidationMiddleware(
  parameterName: string,
  pattern: RegExp,
  options: ParameterValidationOptions = {}
): RouterMiddleware<any, any, any> & RouterParameterMiddleware<any, any, any> {
  if (!(pattern instanceof RegExp)) {
    throw new TypeError('pattern must be a RegExp instance');
  }

  // clone the RegExp once so we do not mutate the caller's instance
  const matcher = new RegExp(pattern.source, pattern.flags);

  const createDefaultHttpError = (message: string) => {
    const httpError = createHttpError(options.status ?? 400, message);
    if (options.expose !== undefined) {
      httpError.expose = options.expose;
    }

    return httpError;
  };

  const validateValue = (value: string) => {
    // ensure deterministic behavior even when /g or /y flags are present
    if (matcher.global || matcher.sticky) {
      matcher.lastIndex = 0;
    }

    if (matcher.test(value)) {
      return;
    }

    if (options.createError) {
      throw options.createError(parameterName, value);
    }

    throw createDefaultHttpError(
      options.message ??
        `Invalid value for parameter "${parameterName}": "${value}"`
    );
  };

  const middleware: RouterMiddleware<any, any, any> &
    RouterParameterMiddleware<any, any, any> = async (
    argument1: unknown,
    argument2: unknown,
    argument3?: unknown
  ) => {
    // called as a normal route middleware: (ctx, next)
    if (typeof argument1 !== 'string') {
      const context = argument1 as RouterContext<any, any, any> & {
        params?: Record<string, string>;
      };
      const next = argument2 as Parameters<RouterMiddleware<any, any, any>>[1];

      const parameterValue =
        context.params && parameterName in context.params
          ? context.params[parameterName]
          : undefined;

      if (typeof parameterValue !== 'string') {
        throw createDefaultHttpError(
          options.message ??
            `Missing required parameter "${parameterName}" in route params`
        );
      }

      validateValue(parameterValue);
      return next();
    }

    // called as router.param middleware: (value, ctx, next)
    const value = argument1 as string;
    // // keep for compatibility (router.param passes ctx as second arg)
    // void argument2;
    const next = argument3 as () => Promise<unknown>;

    validateValue(value);
    return next();
  };

  return middleware;
}
