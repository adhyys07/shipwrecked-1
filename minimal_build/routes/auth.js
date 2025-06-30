const express = require('express');
const router = express.Router();
const { usersTable } = require('../airtable');

router.post('/api/register', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    await usersTable.create({
      fields: {
        email: email
      }
    });

    res.json({ message: 'API Key will be sent to your email shortly.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

module.exports = router;
