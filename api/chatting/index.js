const chatting = require('express').Router();
const chattingCtrl = require('./chatting.ctrl');

chatting.get('/logs', chattingCtrl.requestChattingLogs);
chatting.get('/list', chattingCtrl.requestChattingList);
chatting.post('/chat_list', chattingCtrl.closeChat);
module.exports = chatting;
