const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();
app.use(express.json());

// Serve frontend (auth.html)
app.use(express.static(path.join(__dirname, 'public')));

// API route
app.use(authRoutes);

app.listen(3000, () => {
  console.log('Auth server running on http://localhost:3000');
});
