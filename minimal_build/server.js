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
        console.error("Airtable error:", err);
        return res.status(500).json({ error: 'Failed to save to Airtable' });
      }
      res.status(200).json({ message: '✅ Log saved to Airtable', recordId: record.id });
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
