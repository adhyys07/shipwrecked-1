const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const Airtable = require('airtable');
const axios = require('axios');

const app = express();
const PORT = 3000;

// --- Airtable Config ---
const AIRTABLE_API_KEY = 'patm2nblQ7xrjmkio.20f2c934b2f3145546a958b5ae6d9b00d5d5c688a7fcd742c1f3c5a98180a7d2';
const BASE_ID = 'appC8uxNkBTNIODq3';
const TABLE_NAME = 'Time Logger';

Airtable.configure({ apiKey: AIRTABLE_API_KEY });
const base = Airtable.base(BASE_ID);

// --- GitHub OAuth Config ---
const CLIENT_ID = 'Ov23lizw0cZPEhNdeb3I';
const CLIENT_SECRET = 'e61578e4a195b50393dfd4aff146d0a1822aa1c6';

let accessToken = null; // Store for this session

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// --- Multer Config ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// --- GitHub OAuth Callback ---
app.get('/callback', async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code: code,
    }, {
      headers: { accept: 'application/json' }
    });

    accessToken = tokenRes.data.access_token;

    res.redirect('/'); // Go back to UI after login
  } catch (err) {
    console.error("❌ GitHub OAuth failed:", err);
    res.status(500).send("OAuth failed");
  }
});

// --- Get GitHub Repositories ---
app.get('/api/repos', async (req, res) => {
  if (!accessToken) {
    return res.status(401).json({ error: "Not logged in" });
  }

  try {
    const reposRes = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${accessToken}`
      }
    });
    const repoList = reposRes.data.map(r => ({
      full_name: r.full_name,
      html_url: r.html_url
    }));
    res.json(repoList);
  } catch (err) {
    console.error("❌ Failed to fetch repos:", err);
    res.status(500).json({ error: "Failed to fetch repos" });
  }
});

// --- Submit Time Log to Airtable ---
app.post('/api/log', upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const { repo, timeSpent, description } = req.body;

    const photos = (req.files['photos'] || []).map(file => `${req.protocol}://${req.get('host')}/${file.path}`);
    const video = req.files['video']?.[0] ? `${req.protocol}://${req.get('host')}/${req.files['video'][0].path}` : '';

    base(TABLE_NAME).create({
      repo,
      timeSpent,
      description,
      photoURLs: photos.join(', '),
      videoURL: video
    }, (err, record) => {
      if (err) {
        console.error("❌ Airtable error:", err);
        return res.status(500).json({ error: 'Failed to save to Airtable' });
      }
      res.status(200).json({ message: '✅ Log saved to Airtable', recordId: record.id });
    });
  } catch (err) {
    console.error("❌ Server error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
