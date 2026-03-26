const { createApp } = require('./src/app');
const express = require('express'); 
const path = require('path');       

async function main() {
  const { app, config } = await createApp();

  app.get('/', (req, res) => {
    res.send('Hello, Rosita Madlife!');
  });

  app.use('/SpitalBetty', express.static(path.join(__dirname, 'SpitalBetty')));

  app.listen(config.port, () => {
    console.log(`HLS origin server listening on http://localhost:${config.port}`);
  });
}

main().catch((error) => {
  console.error('Unable to start HLS origin server.');
  console.error(error);
  process.exit(1);
});