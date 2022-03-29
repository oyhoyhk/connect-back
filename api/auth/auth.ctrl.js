const connection = require('../../lib/createMysqlConnection');
const bcrypt = require('bcrypt');

exports.login = async (req, res) => {
	const { username, password } = req.body;
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
			res.send(info);
		});
	}
};

exports.duplicateCheck = async (req, res) => {
	const { username } = req.body;

	const [[result]] = await connection.query(`SELECT EXISTS(SELECT * FROM users WHERE USERNAME = ? ) as exist`, username);
	res.send(result.exist.toString());
};

exports.register = (req, res) => {
	const info = { ...req.body };
	info.password = bcrypt.hashSync(req.body.password, 10);
	info.profileImage = req.file ? req.file.filename : '';

	if (info.nickname === '') info.nickname = info.username;

	connection.query(`INSERT INTO users SET ?`, info, (err, result) => {
		if (err) {
			console.error('In auth.ctrl.js register INSERT query');
			console.error(err);
			return;
		}
		info.uid = result.insertId;
		delete info.password;
		req.session.user = info;
		req.session.save(err => {
			if (err) {
				console.log(err);
				return res.status(500);
			}
			res.send(info);
		});
	});
};

exports.check = (req, res) => {
	if (!req.session.user) {
		return res.status(401);
	}
	console.log('in check', req.session);
	return res.send(req.session.user);
};

exports.logout = (req, res) => {
	console.log('logout');
	req.session.destroy(err => {
		if (err) {
			console.error(err);
			return res.status(500);
		}
		res.send();
	});
};
