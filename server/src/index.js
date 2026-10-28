/**
 * @fileoverview Process entrypoint: loads env vars and starts the HTTP
 * listener for the app built in app.js. Kept separate from app.js so
 * tests can import the app without binding a port.
 */
import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
