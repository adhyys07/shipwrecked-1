const express = require('express');
const axios = require('axios');
const path = require('path');
const app = express();

const CLIENT_ID = 'Ov23lizw0cZPEhNdeb3I';
const CLIENT_SECRET = '053a7d8b71262234fed2907c14412cca1209280c';

let userAccessToken = null; // Store token in memory (demo only!)

app.use(express.static('public')); // serve frontend from 'public' folder

// OAuth callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Code not provided');
  }

  try {
    const response = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }, {
      headers: { accept: 'application/json' }
    });

    userAccessToken = response.data.access_token;
    if (!userAccessToken) {
      return res.status(400).send('Failed to get access token');
    }

    // Redirect back to main page after login
    res.redirect('/');
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).send('OAuth failed');
  }
});

// API to get user repos
app.get('/api/repos', async (req, res) => {
  if (!userAccessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const reposResponse = await axios.get('https://api.github.com/user/repos', {
      headers: { Authorization: `token ${userAccessToken}` }
    });

    res.json(reposResponse.data);
  } catch (error) {
    console.error('Fetch repos error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// Serve index.html on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
