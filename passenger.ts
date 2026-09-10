import type { Server } from 'node:http';
import { createApp } from './src/server/app';
import { attachFrontend } from './src/server/runtime';

async function startPassengerServer() {
  const app = createApp();
  await attachFrontend(app);

  // CloudLinux/LiteSpeed Node Selector replaces the TCP listener with its
  // generated Unix-domain socket. Calling listen() without a port allows
  // the selector runtime to own that binding.
  const listen = app.listen.bind(app) as unknown as () => Server;
  listen();

  console.log('ChatMail AI Server running under CloudLinux Passenger/LiteSpeed');
}

startPassengerServer().catch((error) => {
  console.error('Failed to start Passenger server:', error);
  process.exitCode = 1;
});
