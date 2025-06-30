const express = require('express');
const validateApiKey = require('./middleware/auth');
const { timeLogsTable } = require('./airtable');

const app = express();
app.use(express.json());

app.post('/api/log-time', validateApiKey, async (req, res) => {
  const { durationMinutes, description, mediaUrls } = req.body;

  try {
    await timeLogsTable.create({
      fields: {
        apiKey: req.apiKey,
        durationMinutes,
        description,
        mediaUrls: mediaUrls?.join(', ') || ''
      }
    });

    res.json({ message: 'Time logged successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log time' });
  }
});

app.listen(3001, () => {
  console.log('Main time logger server running on http://localhost:3001');
});
