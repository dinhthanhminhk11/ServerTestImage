const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, Rosita Madlife!');
});

app.use('/BrainrotFilter', express.static('BrainrotFilter'));

app.listen(port, () => {
  console.log(`Server run in port http://localhost:${port}`);
});
