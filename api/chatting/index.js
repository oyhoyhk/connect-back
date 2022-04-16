const chatting = require('express').Router();
const chattingCtrl = require('./chatting.ctrl');

chatting.get('/logs', chattingCtrl.requestChattingLogs);

module.exports = chatting;
