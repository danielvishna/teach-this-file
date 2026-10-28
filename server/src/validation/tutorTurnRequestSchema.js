/**
 * @fileoverview Request-body schema for POST /api/tutor-turn. The client
 * sends everything the server needs to build the prompt from scratch —
 * the server holds no session state between requests (CLAUDE.md: the
 * lesson plan/progress live in the client's reducer, not the server).
 *
 * Every string/array field has a `.max(...)` — defense in depth so a
 * modified client can't push an arbitrarily large prompt through this
 * route (the 1MB express.json() body limit is only a backstop, not a
 * real limit). `step.sourceExcerpt` in particular carries untrusted file
 * content per CLAUDE.md's Hard Rules, so it's bounded like everything
 * else here, not trusted to already be short.
 */
import { z } from 'zod';

const stepContextSchema = z.object({
  title: z.string().min(1).max(300),
  objective: z.string().min(1).max(1000),
  sourceExcerpt: z.string().min(1).max(5000),
});

const historyMessageSchema = z.object({
  role: z.enum(['tutor', 'student']),
  text: z.string().max(5000),
});

/** @const {!z.ZodType} */
export const tutorTurnRequestSchema = z.object({
  teacherPrompt: z.string().min(1).max(2000),
  subject: z.string().min(1).max(200),
  targetAudience: z.string().min(1).max(200),
  language: z.string().min(1).max(100),
  step: stepContextSchema,
  history: z.array(historyMessageSchema).max(50).default([]),
  // Absent on the call that opens a step; present once the student replies.
  studentMessage: z.string().min(1).max(5000).optional(),
});
