const app = require('./app');
const db = require('./utils/database');

// running the server 
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Authorization server is running on port ${PORT}`);
});

// graceful shuting down the server is needed for passing tests
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    await db.closePool();
    console.log('Database pool closed');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown', err);
    process.exit(1);
  }
};

// For nodemon restarts
process.once('SIGUSR2', async () => {
  await gracefulShutdown();
  process.kill(process.pid, 'SIGUSR2');
});

// For app termination
process.on('SIGINT', async () => {
  await gracefulShutdown();
});

// For Heroku app termination
process.on('SIGTERM', async () => {
  await gracefulShutdown();
});

module.exports = server;