const express = require('express');
const cors = require('cors');
const app = express();
const bcrypt = require('bcrypt');
const multer = require('multer');
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');

const io = new Server(server, {
	cors: {
		origin: '*',
		methods: ['GET', 'POST'],
	},
});
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, './profiles');
	},
	filename: function (req, file, cb) {
		cb(null, Date.now() + '.' + file.mimetype.split('/')[1]);
	},
});
const signUp = multer({
	storage,
});
const mysql = require('mysql');
const options = {
	host: 'localhost',
	user: 'root',
	password: '1234',
	database: 'connect',
};
const session = require('express-session');
app.use(cors());

const MySQLStore = require('express-mysql-session')(session);
const sessionStore = new MySQLStore(options);
const PORT = 4000;
let connectedUsers = {};
const connection = mysql.createConnection(options);
connection.connect();

app.use(express.json());
app.use(express.static('profiles'));
app.use(
	session({
		secret: 'connectSecret',
		resave: false,
		saveUninitialized: true,
		store: sessionStore,
	})
);

app.post('/info_check', (req, res) => {
	connection.query('SELECT tel FROM Users', (error, results) => {
		const lists = results.map(el => el.tel);

		if (lists.includes(req.body.tel)) res.send('exist');
		else res.send('next');
	});
});

app.post('/sign_in', (req, res) => {
	const { userId } = req.body;

	connection.query('SELECT uid, userId, password FROM Users where userId = ?', userId, (error, results) => {
		const { uid } = results[0];
		const lists = results.reduce((acc, cur) => {
			acc[cur.uid] = cur.password;
			return acc;
		}, {});

		if (Object.keys(lists).includes(uid.toString())) {
			if (req.body.password == 1 || req.body.password == 2) res.send(uid.toString());
			else if (bcrypt.compareSync(req.body.password, lists[uid])) {
				req.session.uid = uid;
				req.session.isLogined = true;
				req.session.save(function () {
					res.send(uid.toString());
				});
			} else {
				res.send('failure');
			}
		} else {
			res.send('not exist');
		}
	});
});
app.get('/request_add_friends/:uid', (req, res) => {
	const { uid } = req.params;
	connection.query(
		'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
		uid,
		(err, result) => {
			if (err) {
				console.error(err);
			}
			res.send(result);
		}
	);
});

app.post(
	'/sign_up',
	signUp.fields([
		{
			name: 'profileImage',
			maxCount: 1,
		},
		{
			name: 'randomProfileImage',
			maxCount: 1,
		},
	]),
	(req, res) => {
		const info = {
			...req.body,
		};
		info.password = bcrypt.hashSync(req.body.password, 10);
		console.log(req.files);
		if (req.files['profileImage']) {
			const profileImage = req.files.profileImage[0];
			info.profileImage = profileImage.filename;
		}
		if (req.files['randomProfileImage']) {
			const randomProfileImage = req.files.randomProfileImage[0];
			info.randomProfileImage = randomProfileImage.filename;
		}
		console.log(info);
		connection.query('INSERT INTO Users SET ?', info, (error, results) => {
			if (error) throw error;
			console.log(results.insertId);
		});
		res.send();
	}
);
app.get('/search_user/:targetId/:uid', (req, res) => {
	connection.query('SELECT uid,name, profileImage,statusMessage from Users where userId = ? ', req.params.targetId, (err, result) => {
		console.log(result);
		if (result.length === 0) {
			res.send([]);
			return;
		}
		if (result[0].uid === Number(req.params.uid)) {
			res.send([]);
		} else {
			res.send(result);
		}
	});
});

app.post('/toggle_random_chatting', (req, res) => {
	console.log(req.body);
	connection.query(
		`UPDATE Users SET useRandomChatting = ${req.body.useRandomChatting} where uid = ? `,
		req.body.uid,
		(error, results) => {
			console.log(results);
		}
	);
});

// socket.io  Part

io.on('connection', socket => {
	socket.on('login', (uid, callback) => {
		// MainPage.js 최초 랜더링할 때 해당 유저 정보를 전해준다
		// 로그인 하면 Users db의 status 컬럼 수정
		socket.broadcast.emit('friend_login', uid);
		connection.query('UPDATE Users SET status=true where uid =?', uid, err => {
			connection.query(
				'SELECT uid, nickname, profileImage, randomProfileImage, statusMessage, tags, tel, useRandomChatting from Users WHERE uid = ?',
				uid,
				(err, result) => {
					const userData = {
						...result[0],
					};
					console.log(userData.uid + '님 로그인');

					//요청받은 친구추가 데이터를 전송할 userData에 추가
					connection.query(
						'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
						userData.uid,
						(err, result) => {
							if (err) {
								console.err(err);
							}
							userData.receivedAddFriends = result;
							// 친구리스트 데이터 userData에 추가
							connection.query(
								'SELECT fuid as uid, name, profileImage, statusMessage, status from friends JOIN Users where friends.uid=? AND Users.uid=friends.fuid',
								uid,
								(err, result) => {
									if (err) console.error(err);
									userData.friendsList = result;
									// 요청한 친구추가 데이터를 전송할 userData에 추가
									connection.query(
										'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
										uid,
										(err, result) => {
											if (err) {
												console.error(err);
											}
											connectedUsers[uid] = socket.id;

											console.log(connectedUsers);

											userData.addFriends = result;
											userData.sid = socket.id;
											console.log(connectedUsers[uid], socket.id);
											io.emit('connectedUsers', Object.keys(connectedUsers).length);
											callback({
												result: true,
												data: '로그인 성공',
												userData,
											});
										}
									);
								}
							);
						}
					);
				}
			);
		});
	});

	socket.on('send_message', (msg, sender, receiver) => {
		connection.query(`INSERT INTO messages SET sender=?, receiver=?, msg=?`, [Number(sender), receiver, msg], (err, result) => {
			if (err) {
				console.error(err);
			}
			if (connectedUsers[receiver]) {
				socket.to(connectedUsers[receiver]).emit('received_msg', sender, msg);
			}
		});
	});

	socket.on('logout', uid => {
		delete connectedUsers[uid];
		connection.query('UPDATE Users SET status=false where uid = ?', uid, (err, result) => {
			if (err) console.error(err);
		});
		socket.broadcast.emit('connectedUsers', Object.keys(connectedUsers).length, { targetId: uid, status: 'logout' });
		socket.broadcast.emit('friend_logout', uid);
	});

	app.post('/get_msgs', (req, res) => {
		const { sender, receiver } = req.body;

		connection.query(
			`SELECT * from messages where sender=? AND receiver=? OR receiver=? AND sender = ?`,
			[sender, receiver, sender, receiver],
			(err, result) => {
				if (err) console.error(err);
				res.send(result);
			}
		);
	});
	app.delete('/cancel_add_friend/', (req, res) => {
		const { sender, receiver } = req.body;
		connection.query('DELETE from add_friends where receiver=? AND sender=?', [receiver, sender], (err, results) => {
			if (err) {
				console.error('in /cancel_add_friend/', err);
			}
			connection.query(
				'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
				sender,
				(err, result) => {
					//친구요청 취소 했을 때 상대방이 접속 중이라면 상대방의 요청 받은 친구요청 리스트 갱신
					if (connectedUsers[receiver]) {
						connection.query(
							'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
							receiver,
							(err, result) => {
								if (err) {
									console.error(err);
								}
								console.log('친구요청 취소했을 때 상대방에게 취소 푸시');
								console.log('상대방 : ', receiver, 'sid :', connectedUsers[receiver]);
								io.to(connectedUsers[receiver]).emit('canceled_add_friend', result);
							}
						);
					}
					res.send(result);
				}
			);
		});
	});
	app.post('/send_add_friend_request', (req, res) => {
		console.log(req.body);
		connection.query(
			'SELECT * from add_friends where sender=? and receiver = ?',
			[req.body.sender, req.body.receiver],
			(err, result) => {
				if (result.length === 0) {
					connection.query('INSERT INTO add_friends SET ?', req.body, (err, result) => {
						if (err) {
							console.error(err);
						}
						connection.query(
							// 친구 추가를 신청한 사람의 프론트 화면 최신화를 위해 다시 db 조회
							'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
							req.body.sender,
							(err, result) => {
								// 친구요청받았던 사람이 로그인해있다면 변경사항 전송
								if (connectedUsers[req.body.receiver]) {
									connection.query(
										'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
										req.body.receiver,
										(err, result) => {
											if (err) console.error(err);
											io.to(connectedUsers[req.body.receiver]).emit('receive_add_friend', result);
										}
									);
								}

								// 친구 요청한 사람의 요청 리스트 업데이트
								res.send(result);
							}
						);
					});
				} else {
					res.send('');
				}
			}
		);
	});

	//친구요청 수락
	app.get('/accept_add_friend/:receiver/:sender', (req, res) => {
		//receiver : 요청을 받았던 사람 , sender : 친구 요청을 했던 사람
		const { sender, receiver } = req.params;
		const response = {};
		console.log(sender, receiver);
		// friend DB에 친구를 둘다 각각 저장함
		// user | friend
		//  A   |    B
		//  B   |    A
		connection.query('INSERT INTO friends set uid=?, fuid=?', [sender, receiver], (err, result) => {
			connection.query('INSERT INTO friends set uid=?, fuid=?', [receiver, sender], (err, result) => {
				// 친구 요청을 받은 사람의 대기 중인 친구 요청 목록에서 해당 요청 삭제
				connection.query('DELETE from add_friends where sender=? AND receiver=?', [sender, receiver], (err, result) => {
					// 친구 추가 신청한 사람이 접속 중일 때 SENDER에 대한 socket 통신
					if (connectedUsers[sender]) {
						const senderData = {};
						// 신청한 사람의 친구 리스트 및 친구 신청 리스트 갱신
						connection.query(
							'SELECT receiver as uid, name, profileImage, statusMessage from add_friends join Users where sender = ? AND receiver=Users.uid',
							sender,
							(err, result) => {
								if (err) console.error(err);
								senderData.addFriends = result;
								// 신청한 사람의 친구리스트 갱신
								connection.query(
									'SELECT fuid as uid, name, profileImage, statusMessage, status from friends join Users where friends.uid = ? AND Users.uid=friends.fuid',
									sender,
									(err, result) => {
										if (err) console.error(err);
										senderData.friendsList = result;
										connection.query('SELECT name from Users where uid=?', sender, (err, result) => {
											const senderName = result[0].name;
											io.to(connectedUsers[sender]).emit('add_friend_accepted', senderData, senderName);
										});
									}
								);
							}
						);
					}

					// 친구 신청을 받은 사람에게 response
					// 갱신된 대기 중인 친구 요청 목록에 user 정보를 join 시켜 응답으로 보낼 객체인 response에 receivedAddFriends 프로퍼티에 할당
					// 아래 두 query는 친구 요청을 수락한 유저에게 하는 응답에 담아서 보낸다.
					// 요청이 수락된 상대방(친구 요청을 신청한 유저)는 접속 여부에 따라 socket에서 데이터를 보낸다.
					connection.query(
						'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
						receiver,
						(err, result) => {
							if (err) console.error(err);
							response.receivedAddFriends = result;
							// 갱신된 친구 목록에 user 정보를 join 시켜 응답으로 보낼 객체인 response에 friendsList 프로퍼티에 할당
							connection.query(
								'SELECT fuid as uid, name, profileImage, statusMessage, status from friends join Users where friends.uid = ? AND Users.uid=friends.fuid',
								receiver,
								(err, result) => {
									if (err) console.error(err);
									response.friendsList = result;
									res.send(response);
								}
							);
						}
					);
				});
			});
		});

		// 성공했으면 수락한 사람에게 데이터 전송(친구 리스트 , 대기중인 친구 신청 리스트), 대기중인 친구 리스트 테이블 갱신
	});
	//친구요청 거절
	app.get('/refuse_add_friend/:receiver/:sender', (req, res) => {
		//receiver : 요청을 받았던 사람 , sender : 친구 요청을 했던 사람
		const { sender, receiver } = req.params;

		connection.query('DELETE FROM add_friends where sender =? AND receiver = ?', [sender, receiver], (err, result) => {
			if (err) console.error(err);
			if (connectedUsers[sender]) {
				connection.query(
					'SELECT receiver as uid, name, profileImage, statusMessage, status from add_friends join Users where sender = ? AND receiver=Users.uid',
					sender,
					(err, result) => {
						if (err) console.error(err);
						connection.query('SELECT name FROM Users WHERE uid=?', receiver, (err, name) => {
							name = name[0].name;
							io.to(connectedUsers[sender]).emit('add_friend_refused', result, name);
						});
					}
				);
			}
			connection.query(
				'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
				receiver,
				(err, result) => {
					if (err) console.error(err);
					res.send(result);
				}
			);
		});
	});
});

const Listening = () => {
	console.log(`Listening on: http://localhost:${PORT}`);
};

server.listen(PORT, Listening);
