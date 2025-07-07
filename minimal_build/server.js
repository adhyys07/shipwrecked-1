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
    console.log(`API key email sent successfully !`);
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
  const { id, email } = req.body;
  if (!id || !email) {
    return res.status(400).json({ error: 'ID and email are required' });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address' });
  }

  // Basic ID validation (you can customize this)
  if (id.trim().length < 2) {
    return res.status(400).json({ error: 'ID must be at least 2 characters long' });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    const normalizedId = id.trim();

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
          'slack_id': normalizedId,
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

// Log-time endpoint
app.post('/api/log-time', async (req, res) => {
  const { apiKey, timeSpent, description, photosCDN, videoCDN, pname } = req.body;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  if (!pname) {
    return res.status(400).json({ error: 'Project name (pname) required' });
  }

  try {
    // Validate API key and get user info
    const userRecords = await base('Users').select({
      filterByFormula: `{API Key} = '${apiKey}'`,
      maxRecords: 1
    }).firstPage();

    if (userRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const user = userRecords[0].fields;
    const userEmail = user.Email;
    const userSlackId = user.slack_id || user.ID || '';
    const userApiKey = user['API Key'];

    // Save log to TimeLogs table, now including pname
    await base('TimeLogs').create([
      {
        fields: {
          'slack_id': userSlackId,
          'Email': userEmail,
          'logdur': timeSpent,
          'photocdn': photosCDN,
          'videocdn': videoCDN,
          'description': description,
          'pname': pname,
          'Logged At': new Date().toISOString()
        }
      }
    ]);

    // --- Update total time in Projects table ---
    // Fetch all logs for this user and project
    const logs = await base('TimeLogs').select({
      filterByFormula: `AND({Email} = '${userEmail}', {pname} = '${pname}')`
    }).all();
    // Sum up all logdur (assume HH:MM:SS format)
    let totalMs = 0;
    logs.forEach(log => {
      const dur = log.fields['logdur'];
      if (typeof dur === 'string' && dur.match(/^\d{2}:\d{2}:\d{2}$/)) {
        const [h, m, s] = dur.split(':').map(Number);
        totalMs += ((h * 3600) + (m * 60) + s) * 1000;
      }
    });
    // Find the project record
    const projectRecords = await base('Projects').select({
      filterByFormula: `AND({Email} = '${userEmail}', {pname} = '${pname}')`,
      maxRecords: 1
    }).firstPage();
    if (projectRecords.length > 0) {
      // Convert totalMs to HH:MM:SS
      const totalSeconds = Math.floor(totalMs / 1000);
      const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
      const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
      const s = String(totalSeconds % 60).padStart(2, '0');
      const totalTimeStr = `${h}:${m}:${s}`;
      await base('Projects').update([{
        id: projectRecords[0].id,
        fields: {
          'totaltime': totalTimeStr, // Use the exact field name in Airtable
          'Last Update': new Date().toISOString()
        }
      }]);
    }
    // --- End update total time ---

    res.json({ 
      message: 'Time logged successfully',
      loggedAt: new Date().toISOString(),
      totaltime: totalMs // Return totaltime to frontend
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

// Create Project endpoint
app.post('/api/create-project', async (req, res) => {
  const { name, type, level, apiKey, createdAt } = req.body;
  if (!name || !type || !level || !apiKey) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  try {
    // Look up user info by API key
    const userRecords = await base('Users').select({
      filterByFormula: `{API Key} = '${apiKey}'`,
      maxRecords: 1
    }).firstPage();
    if (userRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const user = userRecords[0].fields;
    const userEmail = user.Email;
    const userSlackId = user.slack_id || user.ID || '';
    // Save project to Projects table
    await base('Projects').create([
      {
        fields: {
          'pname': name,
          'ptype': type,
          'plevel': level,
          'Email': userEmail,
          'slack_id': userSlackId,
          'Created': createdAt || new Date().toISOString()
        }
      }
    ]);
    res.json({ message: 'Project created successfully' });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Fetch projects for a user by API key or email
app.get('/api/projects', async (req, res) => {
  const apiKey = req.query.apiKey;
  const emailParam = req.query.email;
  let userEmail = null;
  try {
    if (emailParam) {
      userEmail = emailParam.toLowerCase();
    } else if (apiKey) {
      // Find user by API key
      const userRecords = await base('Users').select({
        filterByFormula: `{API Key} = '${apiKey}'`,
        maxRecords: 1
      }).firstPage();
      if (userRecords.length === 0) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
      userEmail = userRecords[0].fields.Email.toLowerCase();
    } else {
      return res.status(400).json({ error: 'API key or email required' });
    }
    // Fetch projects for this user
    const projects = await base('Projects').select({
      filterByFormula: `LOWER({Email}) = '${userEmail}'`,
      sort: [{field: 'Created', direction: 'desc'}]
    }).all();
    const projectList = projects.map(p => ({
      id: p.id,
      name: p.fields['pname'] || '',
      type: p.fields['ptype'] || '',
      level: p.fields['plevel'] || ''
    }));
    res.json({ projects: projectList });
  } catch (err) {
    console.error('Fetch projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Add endpoint to get total time for a project for the user
app.get('/api/project-total-time', async (req, res) => {
  const { apiKey, pname } = req.query;
  if (!apiKey || !pname) {
    return res.status(400).json({ error: 'API key and project name required' });
  }
  try {
    // Find user by API key
    const userRecords = await base('Users').select({
      filterByFormula: `{API Key} = '${apiKey}'`,
      maxRecords: 1
    }).firstPage();
    if (userRecords.length === 0) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    const userEmail = userRecords[0].fields.Email;
    // Fetch the project record
    const projectRecords = await base('Projects').select({
      filterByFormula: `AND({Email} = '${userEmail}', {pname} = '${pname}')`,
      maxRecords: 1
    }).firstPage();
    let totalTimeStr = '00:00:00';
    if (projectRecords.length > 0) {
      totalTimeStr = projectRecords[0].fields['totaltime'] || '00:00:00';
    }
    // Convert HH:MM:SS to ms for frontend
    const [h, m, s] = totalTimeStr.split(':').map(Number);
    const totalMs = ((h || 0) * 3600 + (m || 0) * 60 + (s || 0)) * 1000;
    res.json({ totalTime: totalMs });
  } catch (err) {
    console.error('Project total time error:', err);
    res.status(500).json({ error: 'Failed to fetch total time' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});