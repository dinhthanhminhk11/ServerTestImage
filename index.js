const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, Rosita Madlife!');
});

app.use('/SpitalBetty', express.static(path.join(__dirname, 'SpitalBetty')));

app.listen(port, () => {
  console.log(`Server run in port http://localhost:${port}`);
});
