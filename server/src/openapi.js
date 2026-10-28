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

// What /api/plan actually returns — no per-step `status`. That field only
// exists client-side, added by the reducer (lessonReducer.js) once the
// plan lands in app state. Keep this schema matching the real response,
// not the reducer's state shape.
const LESSON_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subject: { type: 'string', example: 'biology' },
    targetAudience: { type: 'string', example: '7th grade' },
    language: { type: 'string', example: 'en' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          objective: { type: 'string' },
          sourceExcerpt: { type: 'string', description: 'Verified exact substring of the uploaded file.' },
        },
      },
    },
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
      LessonPlan: LESSON_PLAN_SCHEMA,
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
    '/api/plan': {
      post: {
        summary: 'Build a lesson plan from an uploaded file and a teacher prompt',
        description:
          'One AI call, structured JSON, schema-validated. Each step\'s sourceExcerpt is ' +
          'verified server-side to be an exact substring of the uploaded file before the plan ' +
          'is returned - see validation/lessonPlanSchema.js.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'apiKey', 'teacherPrompt'],
                properties: {
                  file: { type: 'string', format: 'binary', description: 'A .txt file, max 20,000 characters.' },
                  apiKey: { type: 'string', description: 'Gemini API key, sent per-request.' },
                  teacherPrompt: { type: 'string', description: 'Audience, language, tone, time limit, etc.' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'The lesson plan.',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { lessonPlan: { $ref: '#/components/schemas/LessonPlan' } } },
              },
            },
          },
          400: {
            description: 'Missing apiKey/teacherPrompt, no file, unsupported file type, or file too long.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          502: {
            description: 'The AI provider failed, or returned invalid/ungrounded output even after one retry.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
        },
      },
    },
  },
};
