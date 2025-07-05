   const express = require('express');
   const bodyParser = require('body-parser');
   const cors = require('cors');
   const Airtable = require('airtable');
   const crypto = require('crypto');
   const path = require('path');
   require('dotenv').config();

   const app = express();
   const PORT = process.env.PORT || 3000;

   // Airtable configuration
   const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

   app.use(cors());
   app.use(bodyParser.json());

   // Generate a unique API key
   function generateApiKey() {
       return crypto.randomBytes(16).toString('hex');
   }

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

   // Register a new user
   app.post('/api/register', async (req, res) => {
       const { email } = req.body;

       if (!email) {
           return res.status(400).json({ error: 'Email is required' });
       }

       const apiKey = generateApiKey();

       try {
           await base('Users').create([{ fields: { Email: email, 'API Key': apiKey } }]);
           res.status(201).json({ apiKey });
       } catch (error) {
           console.error(error);
           res.status(500).json({ error: 'Failed to register user' });
       }
   });

   app.listen(PORT, () => {
       console.log(`Server is running on http://localhost:${PORT}`);
   });
   // ...existing code...

// Test Airtable connection
app.get('/api/test-airtable', async (req, res) => {
    try {
        // Try to select one record from the Users table
        const records = await base('Users').select({ maxRecords: 1 }).firstPage();
        if (records && records.length > 0) {
            res.json({ success: true, message: 'Airtable connection successful!' });
        } else {
            res.json({ success: true, message: 'Airtable connected, but no records found.' });
        }
    } catch (error) {
        console.error('Airtable connection error:', error);
        res.status(500).json({ success: false, message: 'Airtable connection failed.', error: error.message });
    }
});

// ...existing code...