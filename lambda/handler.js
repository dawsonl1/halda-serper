const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const searchRoutes = require('../routes/searchRoutes');
require('dotenv').config();

// Create a fresh Express app instance for Lambda. This mirrors index.js
// but does not call app.listen; instead we export a Lambda handler.
const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes
app.use('/', searchRoutes);

// Static assets (CSS/JS)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Wrap the Express app with serverless-http so it can handle
// API Gateway / Lambda events.
module.exports.handler = serverless(app);
