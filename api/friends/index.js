const friends = require('express').Router();

const friendsCtrl = require('./friends.Ctrl');

friends.get('/tags/:uid', friendsCtrl.loadTags);
friends.post('/tags', friendsCtrl.addTag);
friends.patch('/tags', friendsCtrl.removeTag);
friends.get('/recommend', friendsCtrl.getRecommend);
friends.post('/request', friendsCtrl.friendRequest);
friends.get('/friends_list', friendsCtrl.requestFriendsList);
module.exports = friends;
