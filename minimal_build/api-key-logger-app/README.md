### Step 1: Set Up Airtable

1. Create a new base in Airtable named "UserAPIKeys".
2. Create a table named "Users" with the following fields:
   - `Email` (Single line text)
   - `API Key` (Single line text)

### Step 2: Create a Backend Server

1. **Install Dependencies**:
   Create a new directory for your backend and run the following commands to initialize a new Node.js project and install the necessary packages:

   ```bash
   mkdir user-api
   cd user-api
   npm init -y
   npm install express body-parser cors dotenv airtable
   ```

2. **Create the Server**:
   Create a file named `server.js` and add the following code:

   ```javascript
   const express = require('express');
   const bodyParser = require('body-parser');
   const cors = require('cors');
   const Airtable = require('airtable');
   const crypto = require('crypto');
   require('dotenv').config();

   const app = express();
   const PORT = process.env.PORT || 5000;

   // Airtable configuration
   const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

   app.use(cors());
   app.use(bodyParser.json());

   // Generate a unique API key
   function generateApiKey() {
       return crypto.randomBytes(16).toString('hex');
   }

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
   ```

3. **Environment Variables**:
   Create a `.env` file in the root of your backend directory and add your Airtable API key and base ID:

   ```plaintext
   AIRTABLE_API_KEY=your_airtable_api_key
   AIRTABLE_BASE_ID=your_airtable_base_id
   ```

### Step 3: Frontend Integration

1. **Modify the Frontend Code**:
   In your existing `index.html`, add a registration form to collect the user's email and a button to submit the form. Below is an example of how you might implement this:

   ```html
   <div id="registrationDialog" style="display:none;">
       <form id="registrationForm">
           <h3>Register for API Key</h3>
           <input type="email" id="userEmail" placeholder="Enter your email" required />
           <button type="submit">Register</button>
       </form>
       <div id="apiKeyDisplay" style="display:none;"></div>
   </div>

   <button id="registerBtn">Get API Key</button>

   <script>
       document.getElementById('registerBtn').onclick = function() {
           document.getElementById('registrationDialog').style.display = 'block';
       };

       document.getElementById('registrationForm').onsubmit = async function(e) {
           e.preventDefault();
           const email = document.getElementById('userEmail').value;

           try {
               const response = await fetch('http://localhost:5000/api/register', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ email })
               });

               const result = await response.json();

               if (response.ok) {
                   document.getElementById('apiKeyDisplay').innerText = `Your API Key: ${result.apiKey}`;
                   document.getElementById('apiKeyDisplay').style.display = 'block';
               } else {
                   alert(`Error: ${result.error}`);
               }
           } catch (err) {
               console.error('Error:', err);
               alert('Failed to register. See console for details.');
           }
       };
   </script>
   ```

### Step 4: Testing

1. **Run the Backend Server**:
   In your terminal, navigate to the backend directory and run:

   ```bash
   node server.js
   ```

2. **Open Your Frontend**:
   Open your `index.html` file in a web browser. Click the "Get API Key" button, enter your email, and submit the form. You should see your unique API key displayed.

### Conclusion

This setup allows users to register with their email and receive a unique API key stored in Airtable. You can further expand this system by adding authentication, logging hours, and more features as needed. Make sure to handle errors and edge cases in a production environment.