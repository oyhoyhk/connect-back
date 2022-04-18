const chatting = require('express').Router();
const chattingCtrl = require('./chatting.ctrl');

chatting.get('/logs', chattingCtrl.requestChattingLogs);
chatting.get('/list', chattingCtrl.requestChattingList);

module.exports = chatting;
