import { createServer } from 'http';
import { createApp } from './app';
import { env } from './config/env';
import { initRealtime } from './realtime/io';

const app = createApp();
const httpServer = createServer(app);
initRealtime(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`PrintPlz backend on :${env.PORT} (${env.NODE_ENV})`);
});
