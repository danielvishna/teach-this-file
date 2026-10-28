import { Router } from 'express';
import { createGeminiClient, DEFAULT_MODEL } from '../ai/geminiClient.js';
import { resolveApiKey } from '../ai/resolveApiKey.js';

export const smokeTestRouter = Router();

/**
 * One hardcoded request to the configured AI provider, used only to verify
 * that client, server and provider are wired together after a deploy.
 */
smokeTestRouter.post('/', async (req, res) => {
  const apiKey = resolveApiKey(req.body.apiKey);
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey is required' });
  }

  try {
    const ai = createGeminiClient(apiKey);
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: 'Reply with exactly: "Smoke test OK".',
      config: { abortSignal: AbortSignal.timeout(15000) },
    });
    res.json({ reply: response.text });
  } catch (err) {
    res.status(502).json({ error: err.message || 'AI provider request failed' });
  }
});
