const chatHall = require('express').Router();
const chatHallCtrl = require('./chat_hall.ctrl');

chatHall.get('/guest_number', chatHallCtrl.guestNumber);
chatHall.get('/user_info', chatHallCtrl.userInfo);
module.exports = chatHall;
