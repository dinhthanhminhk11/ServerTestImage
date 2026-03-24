const { createApp } = require('./src/app');

async function main() {
  const { app, config } = await createApp();

  app.listen(config.port, () => {
    console.log(`HLS origin server listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error('Unable to start HLS origin server.');
  console.error(error);
  process.exit(1);
});
