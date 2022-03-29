const api = require('express').Router();
const authRouter = require('./auth/');
const chatHallRouter = require('./chat_hall');
const friendsRouter = require('./friends');

api.use('/auth', authRouter);
api.use('/chat_hall', chatHallRouter);
api.use('/friends', friendsRouter);
module.exports = api;
