const connection = require('../../lib/createMysqlConnection');
const { search } = require('../chat_hall');

exports.loadTags = async (req, res) => {
	const { uid } = req.params;

	const [result] = await connection.query('SELECT tags FROM users where idx =? ', uid);
	const tags = result[0].tags;
	res.send(tags);
};

exports.addTag = async (req, res) => {
	const { tags, uid } = req.body;
	const [result] = await connection.query('UPDATE users SET tags=? where idx= ?', [tags, uid]);
	console.log('in addTags : ', result);
	return res.status(200);
};

exports.removeTag = async (req, res) => {
	const { tags, uid } = req.body;
	const [result] = await connection.query('UPDATE users SET tags=? where idx= ?', [tags, uid]);
	return res.status(200);
};

exports.getRecommend = async (req, res) => {
	const filter = req.query.filter.split('_').filter(el => el !== '');
	const uid = Number(req.query.uid);
	if (!filter && !uid) return;
	const [queryResult1] = await connection.query(`SELECT data from SESSIONS`);
	const data = queryResult1
		.reduce((result, cur) => {
			cur = JSON.parse(cur.data);
			if (cur.user) {
				result.push(cur.user.uid);
			}
			return result;
		}, [])
		.filter(num => num !== uid);
	if (data.length === 0) return;
	const [searchResult] = await connection.query(
		'SELECT idx as uid, username, nickname, profileImage, tags from users where users.idx IN (' + connection.escape(data) + ')'
	);
	if (!searchResult) return;
	let result = [];
	if (filter.length !== 0) {
		result = searchResult.filter(data => {
			for (let tag of filter) {
				if (data.tags && data.tags.includes(tag)) return true;
			}
			return false;
		});
	}
	if (result.length > 10) {
		result = RandomizeResult(result);
	} else if (result.length === 0) {
		result = RandomizeResult(searchResult);
	}
	res.send(result);
};

exports.friendRequest = async (req, res) => {
	let { sender, receiver } = req.body;
	delete sender.username;
	const [searchResult, fields] = await connection.query('SELECT * FROM friend_request WHERE SENDER=? AND RECEIVER=? ', [
		sender.uid,
		receiver.uid,
	]);
	if (searchResult.length !== 0) return res.status(409);

	await connection.query('INSERT INTO friend_request SET SENDER=?, SENDER_INFO=?, RECEIVER=?, RECEIVER_INFO=?', [
		sender.uid,
		JSON.stringify(sender),
		receiver.uid,
		JSON.stringify(receiver),
	]);

	const [[{ sid }]] = await connection.query('SELECT sid from socket_sessions where uid = ? ', receiver.uid);
	req.io.to(sid).emit('friend_request', sender);

	return res.status(200);
};
exports.requestFriendsList = async (req, res) => {
	const uid = Number(req.query.uid);

	const [result] = await connection.query(
		'SELECT idx as uid, nickname, profileImage, tags from users where users.idx in (SELECT fuid as uid FROM friends_list where uid=?)',
		uid
	);

	res.send(result);
};
exports.requestMessagesList = async (req, res) => {
	const uid = Number(req.query.uid);
	if (isNaN(uid)) return;
	const [result] = await connection.query('SELECT SENDER_INFO FROM friend_request where RECEIVER=?', uid);
	console.log(result);
	res.send(result);
};

exports.acceptFriendRequest = async (req, res) => {
	const { sender, receiver } = req.body;

	await connection.query('INSERT INTO friends_list set uid=?, fuid=?', [sender, receiver]);
	await connection.query('INSERT INTO friends_list set uid=?, fuid=?', [receiver, sender]);

	await connection.query('DELETE FROM friend_request WHERE RECEIVER=? AND SENDER=?', [receiver, sender]);

	const response = {};

	const [messagesList] = await connection.query('SELECT * from friend_request WHERE RECEIVER=?', receiver);

	const [friendsList] = await connection.query(
		'SELECT idx as uid, nickname, profileImage, tags from users where users.idx in (SELECT fuid as uid FROM friends_list where uid=?)',
		receiver
	);
	response.messagesList = messagesList;
	response.friendsList = friendsList;

	res.send(response);
};

exports.refuseFriendRequest = async (req, res) => {
	const sender = Number(req.query.sender);
	const receiver = Number(req.query.receiver);
	await connection.query('DELETE FROM friend_request WHERE RECEIVER=? AND SENDER=?', [receiver, sender]);
	const [messagesList] = await connection.query('SELECT * from friend_request WHERE RECEIVER=?', receiver);

	res.send(messagesList);
};
function RandomizeResult(list) {
	let result = [];

	for (let i = 0; i < 10; i++) {
		let rand = Math.floor(Math.random() * list.length);
		result.push(list.splice(rand, 1)[0]);
		if (list.length === 0) break;
	}
	return result;
}
