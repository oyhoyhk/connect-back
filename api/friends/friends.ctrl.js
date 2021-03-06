const connection = require('../../lib/createMysqlConnection');

exports.loadTags = async (req, res) => {
	const { uid } = req.params;

	const [result] = await connection.query('SELECT tags FROM users where idx =? ', uid);
	const tags = result[0].tags;
	res.send(tags);
};

exports.addTag = async (req, res) => {
	const { tags, uid } = req.body;
	await connection.query('UPDATE users SET tags=? where idx= ?', [tags, uid]);
	return res.status(200);
};

exports.removeTag = async (req, res) => {
	const { tags, uid } = req.body;
	await connection.query('UPDATE users SET tags=? where idx= ?', [tags, uid]);
	return res.status(200);
};

exports.getRecommend = async (req, res) => {
	const filter = req.query.filter.split('_').filter(el => el !== '');
	const uid = Number(req.query.uid);
	if (!filter || !uid) return;
	const [result] = await connection.query(
		`select uid, nickname, profileImage, tags FROM (select * FROM (select uid from socket_sessions where uid not in (select fuid as uid from friends_list where uid=?)) as R where uid not in (select other as uid from block_list where uid=?) and uid not like ?) as RR join users on uid=idx `,
		[uid, uid, uid]
	);
	let filterResult = [];

	if (filter.length !== 0) {
		for (let tag of filter) {
			for (let person of result) {
				if (person.tag && person.tags.includes(tag) && !filterResult.includes(person)) filterResult.push(person);
			}
		}
	}
	if (filterResult.length > 10) filterResult = RandomizeResult(filterResult);
	else {
		while (filterResult.length < 10 && result.length > 0) {
			const rand = Math.floor(Math.random() * result.length);
			let [target] = result.splice(rand, 1);

			if (!filterResult.includes(target)) filterResult.push(target);
		}
	}

	res.send(filterResult);
};

exports.friendRequest = async (req, res) => {
	let { sender, receiver } = req.body;
	delete sender.username;
	const [searchResult] = await connection.query('SELECT * FROM messages WHERE SENDER=? AND RECEIVER=? ', [sender.uid, receiver.uid]);
	if (searchResult.length !== 0) return res.status(409);

	await connection.query('INSERT INTO messages SET SENDER=?, SENDER_INFO=?, RECEIVER=?, RECEIVER_INFO=?, TYPE="friend"', [
		sender.uid,
		JSON.stringify(sender),
		receiver.uid,
		JSON.stringify(receiver),
	]);
	const [[{ sid }]] = await connection.query('SELECT sid from SOCKET_SESSIONS where uid = ? ', receiver);
	if (sid) {
		const data = {
			info: sender,
			type: 'received',
			time: new Date().toISOString().slice(0, 10).split('-').join('.'),
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
	const [sessions] = await connection.query(`SELECT uid from SOCKET_SESSIONS`);
	const users = sessions.map(session => session.uid);
	result.forEach(user => {
		if (users.includes(user.uid)) user.status = true;
		else user.status = false;
	});
	result.sort((a, b) => {
		if (a.status && !b.status) return -1;
		else if (!a.status && b.status) return 1;
	});
	res.send(result);
};
exports.requestMessagesList = async (req, res) => {
	const uid = Number(req.query.uid);
	if (isNaN(uid)) return;
	const [received] = await connection.query('SELECT SENDER_INFO as info, CREATED_AT FROM messages where RECEIVER=?', uid);
	const [sendered] = await connection.query('SELECT RECEIVER_INFO as info, CREATED_AT FROM messages where SENDER=?', uid);

	received.forEach(el => (el.type = 'received'));
	sendered.forEach(el => (el.type = 'sendered'));

	const result = received.concat(sendered).sort((a, b) => b.CREATED_AT - a.CREATED_AT);
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
	if (sid) {
		const [[receiverInfo]] = await connection.query('SELECT idx as uid, nickname, profileImage, tags FROM USERS where idx=?', receiver);
		req.io.to(sid).emit('friend_request_accepted', receiverInfo);
	}
	res.send(response);
};

exports.refuseFriendRequest = async (req, res) => {
	const sender = Number(req.query.sender);
	const receiver = Number(req.query.receiver);
	const type = req.query.type;
	await connection.query('DELETE FROM messages WHERE RECEIVER=? AND SENDER=?', [receiver, sender]);

	const [received] = await connection.query(
		'SELECT SENDER_INFO as info, CREATED_AT FROM messages where RECEIVER=?',
		type === 'refuse' ? receiver : sender
	);
	const [sendered] = await connection.query(
		'SELECT RECEIVER_INFO as info, CREATED_AT FROM messages where SENDER=?',
		type === 'refuse' ? receiver : sender
	);

	received.forEach(el => (el.type = 'received'));
	sendered.forEach(el => (el.type = 'sendered'));

	const [[{ sid }]] = await connection.query(`SELECT sid FROM SOCKET_SESSIONS where uid=?`, type === 'refuse' ? sender : receiver);
	if (sid && type === 'refuse') {
		req.io.to(sid).emit('friend_request_refused', receiver);
	}
	if (sid && type === 'cancel') {
		req.io.to(sid).emit('friend_request_canceled', sender);
	}
	const result = received.concat(sendered).sort((a, b) => b.CREATED_AT - a.CREATED_AT);
	res.send(result);
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

exports.blockUser = async (req, res) => {
	const { uid, other, tags } = req.body;
	const filter = tags.split('_').filter(el => el !== '');
	await connection.query(`INSERT INTO block_list set uid=?, other=?`, [uid, other]);

	const [result] = await connection.query(
		`select uid, nickname, profileImage, tags FROM (select * FROM (select uid from socket_sessions where uid not in (select fuid as uid from friends_list where uid=?)) as R where uid not in (select other as uid from block_list where uid=?) and uid not like ?) as RR join users on uid=idx `,
		[uid, uid, uid]
	);

	let filterResult = [];

	if (filter.length !== 0) {
		for (let tag of filter) {
			for (let person of result) {
				if (person.tag && person.tags.includes(tag) && !filterResult.includes(person)) filterResult.push(person);
			}
		}
	}
	if (filterResult.length > 10) filterResult = RandomizeResult(filterResult);
	else {
		while (filterResult.length < 10 && result.length > 0) {
			const rand = Math.floor(Math.random() * result.length);
			let [target] = result.splice(rand, 1);

			if (!filterResult.includes(target)) filterResult.push(target);
		}
	}

	res.send(filterResult);
};

exports.requestBlockList = async (req, res) => {
	let { uid } = req.query;
	if (uid === 'undefined') return;
	uid = Number(uid);
	const [result] = await connection.query(
		`SELECT uid, nickname, profileImage FROM (SELECT other as uid FROM block_list where uid=?) as R join users on uid=idx`,
		[uid]
	);
	res.send(result);
};

exports.cancelBlock = async (req, res) => {
	const { uid, other } = req.query;

	await connection.query(`DELETE FROM block_list where uid=? and other=?`, [uid, other]);

	const [result] = await connection.query(
		`SELECT uid, nickname, profileImage FROM (SELECT other as uid FROM block_list where uid=?) as R join users on uid=idx`,
		[uid]
	);

	res.send(result);
};

exports.deleteFriend = async (req, res) => {
	const { uid, fuid } = req.query;

	await connection.query(`DELETE FROM friends_list where uid=? and fuid=?`, [uid, fuid]);
	await connection.query(`DELETE FROM friends_list where uid=? and fuid=?`, [fuid, uid]);

	const [result] = await connection.query(
		'SELECT idx as uid, nickname, profileImage, tags from users where users.idx in (SELECT fuid as uid FROM friends_list where uid=?)',
		uid
	);

	const [sessions] = await connection.query(`SELECT uid from SOCKET_SESSIONS`);
	const users = sessions.map(session => session.uid);
	result.forEach(user => {
		if (users.includes(user.uid)) user.status = true;
		else user.status = false;
	});
	result.sort((a, b) => {
		if (a.status && !b.status) return -1;
		else if (!a.status && b.status) return 1;
	});

	console.log(result);
	return res.send(result);
};
