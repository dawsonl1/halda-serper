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
const staticDir = path.join(__dirname, '..', 'public');
app.use(express.static(staticDir));
// Also serve static files under the /default prefix so that
// /default/styles.css and /default/app.js resolve correctly
// for the API Gateway stage.
app.use('/default', express.static(staticDir));

// Wrap the Express app with serverless-http so it can handle
// API Gateway / Lambda events.
//
// When using API Gateway stages (e.g. /default), the incoming path
// may look like /default/ or /default/parse. Express only knows
// about / and /parse, so we strip the stage prefix using basePath.
//
// You can override the base path via the LAMBDA_BASE_PATH env var
// if you rename the stage in API Gateway.
const basePath = process.env.LAMBDA_BASE_PATH || '/default';

module.exports.handler = serverless(app, {
  basePath,
});
