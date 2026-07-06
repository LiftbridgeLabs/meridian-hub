require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const apiRoutes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 34216;
const CLIENT_DIST = path.join(__dirname, 'client', 'dist');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api', apiRoutes);

app.use(express.static(CLIENT_DIST));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(CLIENT_DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Meridian Hub listening on port ${PORT}`);
});
