require('dotenv').config();
const express = require('express');
const path = require('path');
const searchRoutes = require('./routes/searchRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Routes first so '/' renders the EJS view
app.use('/', searchRoutes);

// Static assets (CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
