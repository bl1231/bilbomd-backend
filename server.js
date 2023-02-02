require('dotenv').config();
const express = require('express');
const emoji = require('node-emoji');
const app = express();
const path = require('path');
const cors = require('cors');
const corsOptions = require('./config/corsOptions');
const { logger, logEvents } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const verifyJWT = require('./middleware/verifyJWT');
const cookieParser = require('cookie-parser');
const credentials = require('./middleware/credentials');
const mongoose = require('mongoose');
const connectDB = require('./config/dbConn');
const PORT = process.env.PORT || 3500;

// Connect to MongoDB
connectDB();

// custom middleware logger
app.use(logger);

// Handle options credentials check - before CORS!
// and fetch cookies credentials requirement
// comment out after watching MERN tutorial
// now included in corsOptions below,
// app.use(credentials);

// Cross Origin Resource Sharing
// prevents unwanted clients from accessing our backend API.
app.use(cors(corsOptions));

// built-in middleware to handle urlencoded FORM data
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// built-in middleware for JSON
app.use(express.json({ limit: '5mb' }));

// middleware for COOKIES
app.use(cookieParser());

// serve static files
app.use('/', express.static(path.join(__dirname, '/public')));

// "public" routes
app.use('/', require('./routes/root'));
app.use('/register', require('./routes/register'));
app.use('/verify', require('./routes/verify'));
app.use('/magicklink', require('./routes/magicklink'));
app.use('/auth', require('./routes/auth'));
app.use('/refresh', require('./routes/refresh'));
app.use('/logout', require('./routes/logout'));

// testing API endpoints without authentication
app.use('/jobs', require('./routes/api/jobs'));
app.use('/upload', require('./routes/upload'));

// app.use(verifyJWT);
app.use('/employees', require('./routes/api/employees'));
app.use('/users', require('./routes/api/users'));

app.all('*', (req, res) => {
  res.status(404);
  if (req.accepts('html')) {
    res.sendFile(path.join(__dirname, 'views', '404.html'));
  } else if (req.accepts('json')) {
    res.json({ error: '404 Not Found' });
  } else {
    res.type('txt').send('404 Not Found');
  }
});

// log dem errors
app.use(errorHandler);

// Only listen for traffic if we are actually connected to MongoDB.
mongoose.connection.once('connected', () => {
  console.log(emoji.get('rocket'), 'Connected to MongoDB', emoji.get('rocket'));
  app.listen(PORT, () =>
    console.log(emoji.get('white_check_mark'), `BilboMD Backend Server running on port ${PORT}`)
  );
});

mongoose.connection.on('error', (err) => {
  console.log(err);
  logEvents(`${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`, 'mongo_error.log');
});
