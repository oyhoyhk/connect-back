const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
// const morgan = require('morgan');
const api = require('./api');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { createServer } = require('http');
const path = require('path');
const ios = require('express-socket.io-session');
require('dotenv').config();
const connection = require('./lib/createMysqlConnection');
const httpServer = createServer(app);
app.use(cors());
const io = new Server(httpServer, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});

const options = {
	host: 'localhost',
	user: 'root',
	password: '1234',
	database: 'connectDB',
};

const sessionStore = new MySQLStore(options);
const sessionMiddleware = session({
	secret: 'secret key',
	store: sessionStore,
	resave: false,
	saveUninitialized: true,
	connectionLimit: 500,
});
app.use(sessionMiddleware);
const buildDirectory = path.join(__dirname, '../connect-frontend/build');
app.use(express.static(buildDirectory));
io.use(ios(sessionMiddleware, { autoSave: true }));

// app.use(morgan('combined'));
const PORT = 4000;
app.use(cookieParser());
app.use(express.json());
app.use(express.static('profiles'));
// 모든 라우터에서 io 이용 가능
app.use((req, res, next) => {
	req.io = io;
	return next();
});

app.use('/api', api);
io.on('connection', async socket => {
	const session = socket.request.session;
	let uid = socket.handshake.query.uid;
	if (uid !== 'null') {
		uid = Number(uid);
		const sid = socket.id;

		const [result] = await connection.query('SELECT * FROM SOCKET_SESSIONS WHERE uid=?', uid);

		if (result.length !== 0) {
			await connection.query('UPDATE SOCKET_SESSIONS SET sid=? where uid= ?', [sid, uid]);
		} else {
			await connection.query('INSERT INTO SOCKET_SESSIONS SET uid=?, sid=?', [uid, sid]);
		}
	}

	socket.on('msg', data => {
		socket.broadcast.emit('broadcastMsg', data);
	});

	socket.on('enter', async (data, callback) => {
		const { username, nickname, profileImage } = data;
		if (!username) return;
		await connection.query(`INSERT INTO chat_hall set username=?, nickname=?, profileImage=?`, [username, nickname, profileImage]);
		const [result] = await connection.query(`SELECT * FROM chat_hall`);
		callback('success');
		io.emit('someone_entered', result);
	});

	socket.on('someone_send_message', async ({ sender, receiver, message }) => {
		await connection.query('INSERT INTO chatting_logs set sender=?, receiver=?, message=?', [sender, receiver, message]);
		const [result] = await connection.query('SELECT * FROM SOCKET_SESSIONS where uid =? ', receiver);

		await connection.query(
			`INSERT INTO chat_list (sender, receiver, last_message, new_messages) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE last_message = ?, created_at = now(), new_messages = 0`,
			[sender, receiver, message, message, sender, receiver]
		);
		await connection.query(
			`INSERT INTO chat_list (sender, receiver, last_message, new_messages) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE last_message = ?, created_at = now(), new_messages = new_messages + 1`,
			[receiver, sender, message, message, receiver, sender]
		);
		if (result.length === 0) return;

		const [{ sid: other }] = result;
		if (other) {
			const [chatList] = await connection.query(
				`SELECT receiver as uid, nickname, profileImage, name as chat_name, last_message, new_messages, created_at from chat_list left join users on idx=receiver where sender=? order by created_at desc`,
				receiver
			);
			io.to(other).emit('someone_send_message', { sender, message, chatList });
		}
	});
	socket.on('leave_chat_hall', async username => {
		if (!username) return;
		await connection.query('DELETE FROM chat_hall WHERE username = ?', username);
		socket.broadcast.emit('someone_left', username);
	});
});
app.get('/*', function (req, res, next) {
	res.sendFile(path.join(__dirname, '../connect-frontend/build', 'index.html'));
});
const Listening = () => {
	console.log(`Listening on: http://localhost:${PORT}`);
};

httpServer.listen(PORT, Listening);
