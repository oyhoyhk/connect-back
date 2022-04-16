const connection = require('../../lib/createMysqlConnection');

exports.requestChattingLogs = async (req, res) => {
	const sender = Number(req.query.sender);
	const receiver = Number(req.query.receiver);

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
	let wrapper = {};
	wrapper.other = receiver;
	wrapper.list = result.sort((a, b) => a.time - b.time);
	res.send(wrapper);
};
