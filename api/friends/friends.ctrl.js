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
	const [searchResult, fields] = await connection.query('SELECT * FROM friend_request WHERE SENDER=? AND RECEIVER=? ', [
		sender.uid,
		receiver,
	]);
	if (searchResult.length !== 0) return res.status(409);

	await connection.query('INSERT INTO friend_request SET SENDER=?, RECEIVER=?', [sender.uid, receiver]);

	const [[{ sid }]] = await connection.query('SELECT sid from socket_sessions where uid = ? ', receiver);
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
function RandomizeResult(list) {
	let result = [];

	for (let i = 0; i < 10; i++) {
		let rand = Math.floor(Math.random() * list.length);
		result.push(list.splice(rand, 1)[0]);
		if (list.length === 0) break;
	}
	return result;
}
