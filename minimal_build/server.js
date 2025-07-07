const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Airtable = require('airtable');
const crypto = require('crypto');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Airtable setup
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate a random API key
function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

// Send API key email
async function sendApiKeyEmail(email, apiKey, isExisting = false) {
  const subject = isExisting ? 'Your Existing API Key - Carnival' : 'Welcome to Carnival - Your API Key';
  const welcomeMessage = isExisting ? 
    '<p>You requested your API key. Here it is:</p>' : 
    '<p>Welcome to Carnival! Your account has been created.</p>';

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: subject,
    priority: 'high',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">🎡 Carnival Time Tracker</h2>
        ${welcomeMessage}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #34495e; margin-top: 0;">Your API Key:</h3>
          <code style="background-color: #e9ecef; padding: 8px 12px; border-radius: 4px; font-size: 16px; color: #495057;">
            ${apiKey}
          </code>
        </div>
        
        <div style="margin: 20px 0;">
          <h4 style="color: #34495e;">Important Notes:</h4>
          <ul style="color: #6c757d;">
            <li>Keep this API key safe and don't share it with others</li>
            <li>Use this key to access our time tracking API</li>
            <li>If you lose this key, you can register again with the same email</li>
          </ul>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px;">
          <p>If you didn't request this API key, please ignore this email.</p>
          <p>Happy time tracking! 🎯</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`API key email sent successfully to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
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

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
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
      
      // Send existing API key via email
      try {
        await sendApiKeyEmail(normalizedEmail, existingApiKey, true);
        return res.json({ 
          apiKey: existingApiKey, 
          existing: true,
          message: 'API key sent to your email address'
        });
      } catch (emailError) {
        console.error('Failed to send existing API key email:', emailError);
        return res.json({ 
          apiKey: existingApiKey, 
          existing: true,
          message: 'API key retrieved, but email sending failed'
        });
      }
    }

    // 2. Email does not exist, create a new record
    const apiKey = generateApiKey();
    await base('Users').create([
      {
        fields: {
          'Email': normalizedEmail,
          'API Key': apiKey,
          'Created': new Date().toISOString()
        }
      }
    ]);

    // Send API key via email
    try {
      await sendApiKeyEmail(normalizedEmail, apiKey, false);
      res.json({ 
        apiKey, 
        existing: false,
        message: 'Account created successfully! API key sent to your email.'
      });
    } catch (emailError) {
      console.error('Failed to send new API key email:', emailError);
      res.json({ 
        apiKey, 
        existing: false,
        message: 'Account created successfully, but email sending failed. Please save your API key.'
      });
    }

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to register. Please try again later.' });
  }
});

// Log-time endpoint (placeholder)
app.post('/api/log-time', async (req, res) => {
  const { apiKey, durationMinutes, description, mediaUrls } = req.body;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }

  try {
    // Validate API key first
    const userRecords = await base('Users').select({
      filterByFormula: `{API Key} = '${apiKey}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const userEmail = userRecords[0].fields.Email;

    // Log the time entry (you can expand this to actually save to Airtable)
    console.log(`Time log for ${userEmail}:`, {
      duration: durationMinutes,
      description,
      mediaUrls,
      timestamp: new Date().toISOString()
    });

    // Here you would typically save to your TimeLogs table
    // await base('TimeLogs').create([...]);

    res.json({ 
      message: 'Time logged successfully',
      loggedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Log time error:', err);
    res.status(500).json({ error: 'Failed to log time' });
  }
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
      return res.json({ 
        valid: true,
        email: records[0].fields.Email
      });
    } else {
      return res.json({ valid: false });
    }
  } catch (err) {
    console.error('Airtable validation error:', err);
    return res.status(500).json({ valid: false, error: 'Database error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});