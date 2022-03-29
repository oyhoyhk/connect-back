const connection = require('../../lib/createMysqlConnection');

let guestCount = 0;

exports.guestNumber = (req, res) => {
	guestCount++;
	res.send('guest#' + guestCount);
};

exports.userInfo = async (req, res) => {
	const [result] = await connection.query('SELECT * FROM chat_hall');
	console.log('in userinfo', result);
	res.send(result);
};

exports.leaveChatHall = async (req, res) => {
	const { username } = req.body;
	if (!username) return;
	await connection.query('DELETE FROM chat_hall WHERE username = ?', username);
	req.io.emit('someone_left', username);
};
