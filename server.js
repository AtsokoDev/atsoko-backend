const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const propertiesRouter = require('./routes/properties');
const statsRouter = require('./routes/stats');
const uploadRouter = require('./routes/upload');
const tipsRouter = require('./routes/tips');
const faqRouter = require('./routes/faq');
const contactRouter = require('./routes/contact');
const authRouter = require('./routes/auth');
const optionsRouter = require('./routes/options');
const propertyRequestsRouter = require('./routes/property-requests');
const propertyNotesRouter = require('./routes/property-notes');
const propertyWorkflowRouter = require('./routes/property-workflow');

app.use('/api/properties', propertiesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/tips', tipsRouter);
app.use('/api/faq', faqRouter);
app.use('/api/contact', contactRouter);
app.use('/api/auth', authRouter);
app.use('/api/options', optionsRouter);
app.use('/api/property-requests', propertyRequestsRouter);
app.use('/api/property-notes', propertyNotesRouter);
app.use('/api/property-workflow', propertyWorkflowRouter);

// Serve static images
app.use('/images', express.static('public/images'));

// Health check
app.get('/', (req, res) => {
  res.json({
    message: 'Backend API is running',
    version: '1.0.0',
    status: 'OK'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server is running!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📦 Backend API:   http://localhost:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
});
