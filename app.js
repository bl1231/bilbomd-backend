require('dotenv').config();
const createError = require('http-errors');
const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const corsOptions = require('./config/corsOptions');
const cookieParser = require('cookie-parser');
const credentials = require('./middleware/credentials');
const { logger } = require('./middleware/logEvents');
const verifyJWT = require('./middleware/verifyJWT'); // for protecting routes
const mongoose = require('mongoose');
const connectDB = require('./config/dbConn')
//const indexRouter = require('./routes/index');
//const usersRouter = require('./routes/users');

// Connect to MongoDB Database
connectDB();

// view engine setup - probaby delete this since this app will not likely have 
// web pages. ??
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// logger from YouTube tutorials
app.use(logger);

// Handle options credentials check - before CORS!
// and fetch cookies credentials requirement
app.use(credentials);

// Cross Origin Resource Sharing
app.use(cors(corsOptions));

// built-in middleware to handle json
app.use(express.json());

// built-in middleware to handle urlencoded form data
app.use(express.urlencoded({ extended: false }));

// middleware for cookies
app.use(cookieParser());

// serve static files
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/', require('./routes/root'));
app.use('/register', require('./routes/register'));
app.use('/auth', require('./routes/auth'));
app.use('/refresh', require('./routes/refresh'));
app.use('/logout', require('./routes/logout'));

// verify everything below here
app.use(verifyJWT);
app.use('/employees', require('./routes/api/employees'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

mongoose.connection.once('open', () => {
  console.log('connected to mongoDB')
})
// How to prevent app listening when not connected to DB?
module.exports = app;
