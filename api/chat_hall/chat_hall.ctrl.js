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
