const express = require('express');
const bodyParser = require('body-parser'); // Or use express.json() directly
const authRoutes = require('./backend/routes/authRoutes'); // Import auth routes
const userRoutes = require('./backend/routes/userRoutes'); // Import user routes
const adminRoutes = require('./backend/routes/adminRoutes'); // Import admin routes

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json()); // For parsing application/json
// Alternatively, if using Express 4.16.0+
// app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.send('Hello World! Welcome to Auto WhatsApp Status API.');
});

// API routes
app.use('/api/auth', authRoutes); // Use auth routes
app.use('/api/user', userRoutes); // Use user routes
app.use('/api/admin', adminRoutes); // Use admin routes

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
