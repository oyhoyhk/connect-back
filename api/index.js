const api = require('express').Router();
const authRouter = require('./auth/');
const chatHallRouter = require('./chat_hall');
const friendsRouter = require('./friends');
const chattingRouter = require('./chatting');

api.use('/auth', authRouter);
api.use('/chat_hall', chatHallRouter);
api.use('/friends', friendsRouter);
api.use('/chatting', chattingRouter);
module.exports = api;
