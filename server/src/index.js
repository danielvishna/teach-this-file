import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { smokeTestRouter } from './routes/smokeTest.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use('/api/smoke-test', smokeTestRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
