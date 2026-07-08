// Scaffold for NitiFlow backend server
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
  origin: process.env.NEXT_PUBLIC_FRONTEND_URL || '*'
}));
app.use(express.json());

// Mount Routes
app.use('/api/voice', require('./routes/voice'));
app.use('/api/complaints', require('./routes/complaints'));
app.use('/api/priorities', require('./routes/priorities'));
app.use('/api/wards', require('./routes/wards'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/aria', require('./routes/aria'));
app.use('/api/stats', require('./routes/stats'));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Global Error]', err.stack);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});
