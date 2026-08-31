import { createApp } from './src/server/app';
import { serverConfig } from './src/server/config';
import { attachFrontend } from './src/server/runtime';

async function startServer() {
  const app = createApp();
  await attachFrontend(app);

  app.listen(serverConfig.port, serverConfig.host, () => {
    console.log(`ChatMail AI Server running on http://${serverConfig.host}:${serverConfig.port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});
