const express = require('express');
const app = express();

// Configure port from environment variable or default to 3000
const PORT = process.env.PORT || 3000;

// Root endpoint returning "Hello world"
app.get('/', (req, res) => {
  res.send('Hello world');
});

// Evening endpoint returning "Good evening"
app.get('/evening', (req, res) => {
  res.send('Good evening');
});

// Error handling for undefined routes
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});