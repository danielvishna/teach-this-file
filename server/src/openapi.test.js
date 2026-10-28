/**
 * @fileoverview Sanity checks for the OpenAPI spec. ROUTES_IN_APP is a
 * manually maintained list (Express's internal router tree isn't a
 * stable enough API to introspect reliably across versions) - add a path
 * here in the same commit as mounting a new route, and the "documents
 * every route" test will catch a missing openapi.js entry.
 */
import { describe, expect, it } from 'vitest';
import { openapiSpec } from './openapi.js';

/** @const {!Array<string>} Every route path mounted directly in app.js (excluding /api/docs and /api/openapi.json, which describe the spec itself rather than being described by it). */
const ROUTES_IN_APP = ['/api/health', '/api/smoke-test', '/api/plan', '/api/tutor-turn'];

describe('openapiSpec', () => {
  it('documents every route mounted in the app', () => {
    for (const path of ROUTES_IN_APP) {
      expect(Object.keys(openapiSpec.paths)).toContain(path);
    }
  });

  it('is valid OpenAPI 3.0 at a basic structural level', () => {
    expect(openapiSpec.openapi).toBe('3.0.3');
    expect(openapiSpec.info.title).toBeTruthy();
    expect(openapiSpec.paths).toBeTypeOf('object');
  });
});
