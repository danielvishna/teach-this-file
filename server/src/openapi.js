/**
 * @fileoverview OpenAPI 3.0 spec for the Teach This File API, served as
 * both raw JSON (GET /api/openapi.json) and an interactive Swagger UI
 * (GET /api/docs) from app.js. Kept as a plain JS object (not a .yaml
 * file + parser) to avoid an extra dependency and so it lives next to the
 * routes it describes instead of drifting out of sync in a separate
 * format. Update this in the same commit as any route's request/response
 * shape change — it's documentation, not generated from the code, so
 * nothing enforces that it stays accurate except doing so.
 */

const ERROR_SCHEMA = {
  type: 'object',
  properties: {
    error: { type: 'string', description: 'User-facing message, safe to show as-is.' },
  },
};

/** @const {Object} */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Teach This File API',
    version: '1.0.0',
    description:
      'Turns an uploaded file and a teacher prompt into a tutoring chat. See CLAUDE.md for the ' +
      'architecture this API follows and DECISIONS.md for why things work the way they do. ' +
      'AI routes take the caller\'s Gemini key in the request body - it is never persisted or ' +
      'logged server-side.',
  },
  servers: [{ description: 'This server', url: '/' }],
  components: {
    schemas: {
      Error: ERROR_SCHEMA,
    },
  },
  paths: {
    '/api/health': {
      get: {
        summary: 'Liveness check',
        responses: {
          200: {
            description: 'The server is up.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { ok: { type: 'boolean', example: true } } },
              },
            },
          },
        },
      },
    },
    '/api/smoke-test': {
      post: {
        summary: 'One hardcoded request to the configured AI provider',
        description:
          'Used only to verify that client, server and AI provider are wired together after a ' +
          'deploy. Not part of the actual teaching flow.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['apiKey'],
                properties: { apiKey: { type: 'string', description: 'Gemini API key, sent per-request.' } },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'The model replied.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { reply: { type: 'string', example: 'Smoke test OK' } } },
              },
            },
          },
          400: { description: 'Missing apiKey.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          502: { description: 'The AI provider request failed.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
  },
};
