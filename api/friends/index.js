const friends = require('express').Router();

const friendsCtrl = require('./friends.ctrl');

friends.get('/tags/:uid', friendsCtrl.loadTags);
friends.post('/tags', friendsCtrl.addTag);
friends.patch('/tags', friendsCtrl.removeTag);
friends.get('/recommend', friendsCtrl.getRecommend);
friends.post('/request', friendsCtrl.friendRequest);
friends.get('/friends_list', friendsCtrl.requestFriendsList);
friends.get('/messages', friendsCtrl.requestMessagesList);
friends.post('/messages', friendsCtrl.acceptFriendRequest);
friends.delete('/messages', friendsCtrl.refuseFriendRequest);
friends.post('/block', friendsCtrl.blockUser);
friends.get('/block_list', friendsCtrl.requestBlockList);
friends.delete('/block_list', friendsCtrl.cancelBlock);
friends.delete('/friends', friendsCtrl.deleteFriend);

module.exports = friends;
