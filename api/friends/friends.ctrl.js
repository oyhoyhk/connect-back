const connection = require('../../lib/createMysqlConnection');

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
	if (!filter || !uid) return;
	const [queryResult1] = await connection.query(`SELECT data from SESSIONS`);
	const [friendsListQuery] = await connection.query(
		'SELECT idx as uid from users where users.idx in (SELECT fuid as uid FROM friends_list where uid=?)',
		uid
	);
	const friendsList = friendsListQuery.map(el => el.uid);
	const data = queryResult1
		.reduce((result, cur) => {
			cur = JSON.parse(cur.data);
			if (cur.user) {
				result.push(cur.user.uid);
			}
			return result;
		}, [])
		.filter(num => num !== uid && !friendsList.includes(num));

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
	} else {
		while (result.length !== 10 && searchResult.length !== 0) {
			const rand = Math.floor(Math.random() * searchResult.length);
			const [randomUser] = searchResult.splice(rand, 1);
			result.push(randomUser);
		}
	}
	res.send(result);
};

exports.friendRequest = async (req, res) => {
	let { sender, receiver } = req.body;
	delete sender.username;
	const [searchResult, fields] = await connection.query('SELECT * FROM messages WHERE SENDER=? AND RECEIVER=? ', [
		sender.uid,
		receiver.uid,
	]);
	if (searchResult.length !== 0) return res.status(409);

	await connection.query('INSERT INTO messages SET SENDER=?, SENDER_INFO=?, RECEIVER=?, RECEIVER_INFO=?, TYPE="friend"', [
		sender.uid,
		JSON.stringify(sender),
		receiver.uid,
		JSON.stringify(receiver),
	]);

	const [[{ sid }]] = await connection.query('SELECT sid from socket_sessions where uid = ? ', receiver.uid);
	if (sid) {
		const data = {
			info: sender,
			type: 'received',
			time: new Date().toISOString(),
		};
		req.io.to(sid).emit('friend_request', data);
	}
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
	const [received] = await connection.query('SELECT SENDER_INFO as info, CREATED_AT FROM messages where RECEIVER=?', uid);
	const [sendered] = await connection.query('SELECT RECEIVER_INFO as info, CREATED_AT FROM messages where SENDER=?', uid);

	received.forEach(el => (el.type = 'received'));
	sendered.forEach(el => (el.type = 'sendered'));

	const result = received.concat(sendered).sort((a, b) => a.CREATED_AT - b.CREATED_AT);
	console.log(result);
	res.send(result);
};

exports.acceptFriendRequest = async (req, res) => {
	const { sender, receiver } = req.body;

	await connection.query('INSERT INTO friends_list set uid=?, fuid=?', [sender, receiver]);
	await connection.query('INSERT INTO friends_list set uid=?, fuid=?', [receiver, sender]);

	await connection.query('DELETE FROM messages WHERE RECEIVER=? AND SENDER=?', [receiver, sender]);

	const response = {};

	const [messagesList] = await connection.query('SELECT * from messages WHERE RECEIVER=? OR SENDER=?', [receiver, receiver]);

	const [friendsList] = await connection.query(
		'SELECT idx as uid, nickname, profileImage, tags from users where users.idx in (SELECT fuid as uid FROM friends_list where uid=?)',
		receiver
	);
	response.messagesList = messagesList;
	response.friendsList = friendsList;
	const [[{ sid }]] = await connection.query(`SELECT sid FROM SOCKET_SESSIONS where uid=?`, sender);
	const [[receiverInfo]] = await connection.query('SELECT idx as uid, nickname, profileImage, tags FROM USERS where idx=?', receiver);
	req.io.to(sid).emit('friend_request_accepted', receiverInfo);
	res.send(response);
};

exports.refuseFriendRequest = async (req, res) => {
	const sender = Number(req.query.sender);
	const receiver = Number(req.query.receiver);
	await connection.query('DELETE FROM messages WHERE RECEIVER=? AND SENDER=?', [receiver, sender]);
	const [messagesList] = await connection.query('SELECT * from messages WHERE RECEIVER=? OR SENDER=?', [receiver, receiver]);

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
