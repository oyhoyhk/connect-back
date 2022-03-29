const auth = require('express').Router();
const authCtrl = require('./auth.ctrl');

const multerMiddleware = require('../../lib/createMulterMiddleware');

auth.post('/login', authCtrl.login);
auth.post('/register', multerMiddleware, authCtrl.register);
auth.get('/check', authCtrl.check);
auth.post('/duplicate_check', authCtrl.duplicateCheck);
auth.post('/logout', authCtrl.logout);
module.exports = auth;
