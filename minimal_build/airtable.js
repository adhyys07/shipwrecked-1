const Airtable = require('airtable');

// Replace with your real values
const base = new Airtable({ apiKey: 'patRt81WjTZzm9GOF.66aaff18dcc849e34dcd119ff6082cd1cd063869a1b09cf855db0ee1fd645cde' }).base('appcyyyoDv1ymsibp');

const usersTable = base('MinimalTestBase');

module.exports = { usersTable };
 