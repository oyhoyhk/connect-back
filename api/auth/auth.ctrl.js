const connection = require('../../lib/createMysqlConnection');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) return res.status(409).send('wrong info');
	const [[result]] = await connection.query(`SELECT idx, password, nickname, profileImage FROM users where username = ?`, username);
	if (!result) return res.status(400).send('error');

	const match = bcrypt.compareSync(password, result.password);
	if (match) {
		const info = {
			username,
			uid: result.idx,
			nickname: result.nickname,
			profileImage: result.profileImage,
		};
		req.session.user = info;
		req.session.save(err => {
			if (err) {
				console.log(err);
				return res.status(500);
			}
			req.io.emit('someone_login', result.idx);
			res.send(info);
		});
	}
};

exports.duplicateCheck = async (req, res) => {
	const { username } = req.body;

	const [[result]] = await connection.query(`SELECT EXISTS (SELECT * FROM users WHERE USERNAME = ? ) as exist`, username);
	res.send(result.exist.toString());
};

exports.register = async (req, res) => {
	const info = { ...req.body };
	info.password = bcrypt.hashSync(req.body.password, 10);
	info.profileImage = req.file ? req.file.filename : '';

	if (info.nickname === '') info.nickname = info.username;

	const [result] = await connection.query(`INSERT INTO users SET ?`, info);
	console.log(result);

	info.uid = result.insertId;
	delete info.password;
	req.session.user = info;
	req.session.save(err => {
		if (err) {
			console.log(err);
			return res.status(500);
		}
		req.io.emit('someone_login', result.insertId);
		res.send(info);
	});
};

exports.check = (req, res) => {
	if (!req.session.user) {
		return res.status(401);
	}
	console.log('in check', req.session);
	return res.send(req.session.user);
};

exports.logout = async (req, res) => {
	console.log('logout', req.query);
	const uid = Number(req.query.uid);
	if (isNaN(uid)) return res.status(404);
	await connection.query('DELETE FROM SOCKET_SESSIONS where uid=?', uid);

	const [result] = await connection.query('SELECT * FROM SOCKET_SESSIONS');

	req.session.destroy(err => {
		if (err) {
			console.error(err);
			return res.status(500);
		}
		req.io.emit('someone_logout', uid);
	});
	res.send('hi');
};

exports.modify = async (req, res) => {
	const info = { ...req.body };
	console.log(info);
};
