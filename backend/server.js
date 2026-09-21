// Scaffold for NitiFlow backend server
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: [
    'https://niti-flow.vercel.app',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

// Mount Routes
app.use('/api/voice', require('./routes/voice'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/priorities', require('./routes/priorities'));
app.use('/api/wards', require('./routes/wards'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/aria', require('./routes/aria'));
app.use('/api/stats', require('./routes/stats'));

// Temporary debug route
app.get('/api/debug/complaints', async (req, res) => {
  const data = await db.query('SELECT * FROM complaints WHERE status = "open"');
  res.json(data);
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date()
  });
});

// ------------------------------------------------------------------
// INTENTIONAL BUG FOR ISSUESCOUT TESTING
// This route uses an undefined variable, causing a ReferenceError.
// ------------------------------------------------------------------
app.get('/api/test-error', (req, res) => {
  const result = undefinedVariable + 1; // <-- Intentional bug
  res.json({ result });
});

// ------------------------------------------------------------------
// Global Error Handler (FIXED: registered BEFORE app.listen)
// ------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.stack);

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
