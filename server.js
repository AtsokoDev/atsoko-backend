const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { addClient, removeClient } = require('./services/sse');
const { authenticate } = require('./middleware/auth');

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
const noteTypesRouter = require('./routes/note-types');
const propertyVersionsRouter = require('./routes/property-versions');
const activityLogsRouter    = require('./routes/activity-logs');

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
app.use('/api/note-types', noteTypesRouter);
app.use('/api/property-versions', propertyVersionsRouter);
app.use('/api/activity-logs',     activityLogsRouter);

// ─── Server-Sent Events endpoint ────────────────────────────────────────────
// EventSource cannot set custom headers, so we also accept token via ?token=
// The authenticate middleware already reads from Authorization header;
// here we normalise the query-param token into the header before calling it.
app.get('/api/events', (req, res, next) => {
  // Inject token from query param into header so authenticate() can read it
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
}, authenticate, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const clientId = `${req.user.id}_${Date.now()}`;
  addClient(clientId, res);

  // Send initial handshake so the client knows the connection is live
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`);

  // Heartbeat every 25 s to keep the connection alive through proxies/load-balancers
  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* client gone */ }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(clientId);
  });
});
// ────────────────────────────────────────────────────────────────────────────

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
