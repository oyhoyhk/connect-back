const connection = require('../../lib/createMysqlConnection');

exports.requestChattingLogs = async (req, res) => {
	const sender = Number(req.query.sender);
	const receiver = Number(req.query.receiver);
	await connection.query('UPDATE chat_list set new_messages=0 where sender=? and receiver=?', [sender, receiver]);
	let [result] = await connection.query(
		'SELECT * from chatting_logs where sender=? && receiver=? or sender=? && receiver=? ORDER BY created_at DESC LIMIT 10',
		[sender, receiver, receiver, sender]
	);

	result = result.map(message => {
		let temp = {};
		if (message.sender === sender) {
			temp.type = 'send';
		} else {
			temp.type = 'received';
		}
		temp.msg = message.message;
		temp.time = message.created_at;
		return temp;
	});
	result.sort((a, b) => a.time - b.time);
	res.send(result);
};

exports.requestChattingList = async (req, res) => {
	const uid = Number(req.query.uid);
	const [result] = await connection.query(
		`SELECT receiver as uid, nickname, profileImage, name as chat_name, last_message, new_messages, created_at from chat_list left join users on idx=receiver where sender=? order by created_at desc`,
		uid
	);
	// let [result] = await connection.query(
	// 	`SELECT id as uid, nickname, profileImage, chat_name, last_message, created_at from (SELECT CAST(replace(replace(id, ?, ''), '-','') as SIGNED) as id, name as chat_name, last_message, created_at FROM chat_list where id like '%?%') as R left join users on users.idx=id ORDER BY created_at desc`,
	// 	[uid, uid]
	// );
	res.send(result);
};
