const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Airtable = require('airtable');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Airtable setup
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Generate a random API key
function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const normalizedEmail = email.toLowerCase();

    // 1. Check if the email already exists
    const existingRecords = await base('Users')
      .select({
        filterByFormula: `LOWER({Email}) = "${normalizedEmail}"`,
        maxRecords: 1
      })
      .firstPage();

    if (existingRecords.length > 0) {
      // Email already exists, return the existing API key
      const existingApiKey = existingRecords[0].fields['API Key'];
      return res.json({ apiKey: existingApiKey, existing: true });
    }

    // 2. Email does not exist, create a new record
    const apiKey = generateApiKey();
    await base('Users').create([
      {
        fields: {
          'Email': normalizedEmail,
          'API Key': apiKey
        }
      }
    ]);

    // Airtable automation will send email
    res.json({ apiKey, existing: false });

  } catch (err) {
    console.error('Airtable error:', err);
    res.status(500).json({ error: 'Failed to register or check Airtable.' });
  }
});

// Log-time endpoint (placeholder)
app.post('/api/log-time', (req, res) => {
  const { apiKey, durationMinutes, description, mediaUrls } = req.body;
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  // Validate API key here if needed
  res.json({ message: 'Time logged successfully' });
});

// Validate API key
app.post('/api/validate-key', async (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey) {
    return res.status(400).json({ valid: false, error: 'API key required' });
  }

  try {
    const records = await base('Users').select({
      filterByFormula: `{API Key} = '${apiKey}'`,
      maxRecords: 1
    }).firstPage();

    if (records.length > 0) {
      return res.json({ valid: true });
    } else {
      return res.json({ valid: false });
    }
  } catch (err) {
    console.error('Airtable validation error:', err);
    return res.status(500).json({ valid: false, error: 'Database error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
