const express = require('express');
const app = express();
const cors = require('cors');
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const morgan = require('morgan');
const api = require('./api');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { createServer } = require('http');
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
	hots: 'localhost',
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

io.use(ios(sessionMiddleware, { autoSave: true }));

app.use(morgan('combined'));
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
	console.log(socket.id);
	let uid = socket.handshake.query.uid;
	console.log('connection uid', uid);
	if (uid !== 'null') {
		uid = Number(uid);
		const sid = socket.id;

		const [result] = await connection.query('SELECT * FROM SOCKET_SESSIONS WHERE uid=?', uid);

		console.log(result);

		if (result.length !== 0) {
			await connection.query('UPDATE SOCKET_SESSIONS SET sid=? where uid= ?', [sid, uid]);

			console.log('socket_sessions UPDATE');
		} else {
			await connection.query('INSERT INTO SOCKET_SESSIONS SET uid=?, sid=?', [uid, sid]);
			console.log('socket_sessions INSERT	');
		}
	}

	socket.on('msg', data => {
		console.log(socket.id);
		console.log(data);
		socket.broadcast.emit('broadcastMsg', data);
	});

	socket.on('enter', async (data, callback) => {
		const { username, nickname, profileImage } = data;
		console.log('socket.on enter : ', username, nickname, profileImage);
		if (!username) return;
		await connection.query(`INSERT INTO chat_hall set username=?, nickname=?, profileImage=?`, [username, nickname, profileImage]);
		const [result] = await connection.query(`SELECT * FROM chat_hall`);
		callback('success');
		io.of('/').emit('someone_entered', result);
	});

	socket.on('someone_send_message', async ({ sender, receiver, message }) => {
		console.log('in somone_send_message : ', sender, receiver, message);
		await connection.query('INSERT INTO chatting_logs set sender=?, receiver=?, message=?', [sender, receiver, message]);
		const [[{ sid: other }]] = await connection.query('SELECT * FROM socket_sessions where uid =? ', receiver);

		if (other) {
			io.to(other).emit('someone_send_message', { sender, receiver, message, time: new Date() });
		}
	});

	socket.on('disconnect', reason => {
		console.log('in socket disconnect');
		console.log(reason);
		console.log(socket.id);
	});
});

// app.get('/request_add_friends/:uid', (req, res) => {
// 	const { uid } = req.params;
// 	connection.query(
// 		'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
// 		uid,
// 		(err, result) => {
// 			if (err) {
// 				console.error(err);
// 			}
// 			res.send(result);
// 		}
// 	);
// });

// app.get('/search_user/:targetId/:uid', (req, res) => {
// 	connection.query('SELECT uid,name, profileImage,statusMessage from Users where userId = ? ', req.params.targetId, (err, result) => {
// 		console.log(result);
// 		if (result.length === 0) {
// 			res.send([]);
// 			return;
// 		}
// 		if (result[0].uid === Number(req.params.uid)) {
// 			res.send([]);
// 		} else {
// 			res.send(result);
// 		}
// 	});
// });

// app.post('/toggle_random_chatting', (req, res) => {
// 	console.log(req.body);
// 	connection.query(
// 		`UPDATE Users SET useRandomChatting = ${req.body.useRandomChatting} where uid = ? `,
// 		req.body.uid,
// 		(error, results) => {
// 			console.log(results);
// 		}
// 	);
// });

// // socket.io  Part
// function requestRandomList(tags, requestUser) {
// 	if (tags !== '') {
// 		new Promise((resolve, reject) => {
// 			tags = tags.split('@$@$');
// 			let list = new Set();
// 			for (let tag of tags) {
// 				connection.query(
// 					"SELECT uid, nickname, randomProfileImage, tags from users where uid != ? AND tags LIKE '%" + tag + "%'",
// 					requestUser,
// 					(err, result) => {
// 						if (err) console.error(err);
// 						result.forEach(res => {
// 							list.add(Object.values(res).join('-'));
// 						});
// 					}
// 				);
// 			}
// 			resolve(list);
// 		}).then(result => {
// 			console.log('in promis', result);
// 		});
// 	}
// }
// io.on('connection', socket => {
// 	socket.on('login', (uid, callback) => {
// 		// MainPage.js 최초 랜더링할 때 해당 유저 정보를 전해준다
// 		// 로그인 하면 Users db의 status 컬럼 수정
// 		socket.broadcast.emit('friend_login', uid);

// 		const updateLoginState = mysql.format('UPDATE Users SET status=true where uid =?;', uid);
// 		const getMyInfo = mysql.format(
// 			'SELECT uid, nickname, profileImage, randomProfileImage, statusMessage, tags, tel, useRandomChatting from Users WHERE uid = ?;',
// 			uid
// 		);
// 		const getReceivedAddFriends = mysql.format(
// 			'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid;',
// 			uid
// 		);
// 		const getFriendsList = mysql.format(
// 			'SELECT fuid as uid, name, profileImage, statusMessage, status from friends JOIN Users where friends.uid=? AND Users.uid=friends.fuid;',
// 			uid
// 		);
// 		const getListAddFriends = mysql.format(
// 			'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ;',
// 			uid
// 		);
// 		const getChattingList = mysql.format(
// 			'select result.* from (select  Distinct(uid), name, profileImage, list.msg from users join (select filter.* from (select * from messages where sender=? or receiver=? order by time desc limit 18446744073709551615) as filter group by room) as list on users.uid=list.sender or users.uid=list.receiver group by uid) as result where uid != ?;',
// 			[uid, uid, uid]
// 		);

// 		connection.query(
// 			updateLoginState + getMyInfo + getReceivedAddFriends + getFriendsList + getListAddFriends + getChattingList,
// 			(err, result) => {
// 				if (err) throw err;
// 				const userData = {
// 					...result[1][0],
// 				};
// 				userData.receivedAddFriends = result[2];
// 				userData.friendsList = result[3];
// 				userData.addFriends = result[4];
// 				userData.chatList = result[5];
// 				connectedUsers[uid] = socket.id;

// 				console.log(connectedUsers);
// 				if (userData.useRandomChatting) {
// 					console.log('랜덤 채팅 사용');
// 					requestRandomList(userData.tags, userData.uid);
// 				}
// 				userData.addFriends = result;
// 				userData.sid = socket.id;
// 				console.log(connectedUsers[uid], socket.id);
// 				io.emit('connectedUsers', Object.keys(connectedUsers).length);
// 				callback({
// 					result: true,
// 					data: '로그인 성공',
// 					userData,
// 				});
// 			}
// 		);
// 	});

// 	socket.on('send_message', (msg, sender, receiver, callback) => {
// 		const room = `${Math.min(sender, receiver)}-${Math.max(sender, receiver)}`;
// 		const saveMsg = mysql.format(`INSERT INTO messages SET room=?, sender=?, receiver=?, msg=?;`, [
// 			room,
// 			Number(sender),
// 			receiver,
// 			msg,
// 		]);
// 		const loadMsg = mysql.format(
// 			'select result.* from (select  Distinct(uid), name, profileImage, list.msg from users join (select filter.* from (select * from messages where sender=? or receiver=? order by time desc limit 18446744073709551615) as filter group by room) as list on users.uid=list.sender or users.uid=list.receiver group by uid) as result where uid != ?;',
// 			[sender, sender, sender]
// 		);
// 		connection.query(saveMsg + loadMsg, (err, result) => {
// 			if (err) {
// 				console.error(err);
// 			}
// 			callback({ result: result[1] });
// 			if (connectedUsers[receiver]) {
// 				socket.to(connectedUsers[receiver]).emit('received_msg', sender, msg);
// 			}
// 		});
// 	});
// 	socket.on('updateTags', (uid, tags) => {
// 		console.log(uid, tags);
// 		connection.query('UPDATE Users SET tags = ? where uid=?', [tags, uid], (err, result) => {
// 			if (err) console.error(err);
// 		});
// 	});
// 	socket.on('logout', uid => {
// 		delete connectedUsers[uid];
// 		connection.query('UPDATE Users SET status=false where uid = ?', uid, (err, result) => {
// 			if (err) console.error(err);
// 		});
// 		socket.broadcast.emit('connectedUsers', Object.keys(connectedUsers).length, {
// 			targetId: uid,
// 			status: 'logout',
// 		});
// 		socket.broadcast.emit('friend_logout', uid);
// 	});
// });

// app.post('/get_msgs', (req, res) => {
// 	const { sender, receiver } = req.body;
// 	const room = `${Math.min(sender, receiver)}-${Math.max(sender, receiver)}`;
// 	connection.query(`SELECT * from messages where room=?`, room, (err, result) => {
// 		if (err) console.error(err);
// 		res.send(result);
// 	});
// });
// app.delete('/cancel_add_friend/', (req, res) => {
// 	const { sender, receiver } = req.body;
// 	connection.query('DELETE from add_friends where receiver=? AND sender=?', [receiver, sender], (err, results) => {
// 		if (err) {
// 			console.error('in /cancel_add_friend/', err);
// 		}
// 		connection.query(
// 			'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
// 			sender,
// 			(err, result) => {
// 				//친구요청 취소 했을 때 상대방이 접속 중이라면 상대방의 요청 받은 친구요청 리스트 갱신
// 				if (connectedUsers[receiver]) {
// 					connection.query(
// 						'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
// 						receiver,
// 						(err, result) => {
// 							if (err) {
// 								console.error(err);
// 							}
// 							console.log('친구요청 취소했을 때 상대방에게 취소 푸시');
// 							console.log('상대방 : ', receiver, 'sid :', connectedUsers[receiver]);
// 							io.to(connectedUsers[receiver]).emit('canceled_add_friend', result);
// 						}
// 					);
// 				}
// 				res.send(result);
// 			}
// 		);
// 	});
// });
// app.post('/send_add_friend_request', (req, res) => {
// 	console.log(req.body);
// 	connection.query('SELECT * from add_friends where sender=? and receiver = ?', [req.body.sender, req.body.receiver], (err, result) => {
// 		if (result.length === 0) {
// 			connection.query('INSERT INTO add_friends SET ?', req.body, (err, result) => {
// 				if (err) {
// 					console.error(err);
// 				}
// 				connection.query(
// 					// 친구 추가를 신청한 사람의 프론트 화면 최신화를 위해 다시 db 조회
// 					'SELECT RECEIVER, name, profileImage,statusMessage  from add_friends JOIN Users where receiver=Users.uid AND sender=? ',
// 					req.body.sender,
// 					(err, result) => {
// 						// 친구요청받았던 사람이 로그인해있다면 변경사항 전송
// 						if (connectedUsers[req.body.receiver]) {
// 							connection.query(
// 								'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
// 								req.body.receiver,
// 								(err, result) => {
// 									if (err) console.error(err);
// 									io.to(connectedUsers[req.body.receiver]).emit('receive_add_friend', result);
// 								}
// 							);
// 						}

// 						// 친구 요청한 사람의 요청 리스트 업데이트
// 						res.send(result);
// 					}
// 				);
// 			});
// 		} else {
// 			res.send('');
// 		}
// 	});
// });

// //친구요청 수락
// app.get('/accept_add_friend/:receiver/:sender', (req, res) => {
// 	//receiver : 요청을 받았던 사람 , sender : 친구 요청을 했던 사람
// 	const { sender, receiver } = req.params;
// 	const response = {};
// 	console.log(sender, receiver);
// 	// friend DB에 친구를 둘다 각각 저장함
// 	// user | friend
// 	//  A   |    B
// 	//  B   |    A
// 	connection.query('INSERT INTO friends set uid=?, fuid=?', [sender, receiver], (err, result) => {
// 		connection.query('INSERT INTO friends set uid=?, fuid=?', [receiver, sender], (err, result) => {
// 			// 친구 요청을 받은 사람의 대기 중인 친구 요청 목록에서 해당 요청 삭제
// 			connection.query('DELETE from add_friends where sender=? AND receiver=?', [sender, receiver], (err, result) => {
// 				// 친구 추가 신청한 사람이 접속 중일 때 SENDER에 대한 socket 통신
// 				if (connectedUsers[sender]) {
// 					const senderData = {};
// 					// 신청한 사람의 친구 리스트 및 친구 신청 리스트 갱신
// 					connection.query(
// 						'SELECT receiver as uid, name, profileImage, statusMessage from add_friends join Users where sender = ? AND receiver=Users.uid',
// 						sender,
// 						(err, result) => {
// 							if (err) console.error(err);
// 							senderData.addFriends = result;
// 							// 신청한 사람의 친구리스트 갱신
// 							connection.query(
// 								'SELECT fuid as uid, name, profileImage, statusMessage, status from friends join Users where friends.uid = ? AND Users.uid=friends.fuid',
// 								sender,
// 								(err, result) => {
// 									if (err) console.error(err);
// 									senderData.friendsList = result;
// 									connection.query('SELECT name from Users where uid=?', sender, (err, result) => {
// 										const senderName = result[0].name;
// 										io.to(connectedUsers[sender]).emit('add_friend_accepted', senderData, senderName);
// 									});
// 								}
// 							);
// 						}
// 					);
// 				}

// 				// 친구 신청을 받은 사람에게 response
// 				// 갱신된 대기 중인 친구 요청 목록에 user 정보를 join 시켜 응답으로 보낼 객체인 response에 receivedAddFriends 프로퍼티에 할당
// 				// 아래 두 query는 친구 요청을 수락한 유저에게 하는 응답에 담아서 보낸다.
// 				// 요청이 수락된 상대방(친구 요청을 신청한 유저)는 접속 여부에 따라 socket에서 데이터를 보낸다.
// 				connection.query(
// 					'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
// 					receiver,
// 					(err, result) => {
// 						if (err) console.error(err);
// 						response.receivedAddFriends = result;
// 						// 갱신된 친구 목록에 user 정보를 join 시켜 응답으로 보낼 객체인 response에 friendsList 프로퍼티에 할당
// 						connection.query(
// 							'SELECT fuid as uid, name, profileImage, statusMessage, status from friends join Users where friends.uid = ? AND Users.uid=friends.fuid',
// 							receiver,
// 							(err, result) => {
// 								if (err) console.error(err);
// 								response.friendsList = result;
// 								res.send(response);
// 							}
// 						);
// 					}
// 				);
// 			});
// 		});
// 	});

// 	// 성공했으면 수락한 사람에게 데이터 전송(친구 리스트 , 대기중인 친구 신청 리스트), 대기중인 친구 리스트 테이블 갱신
// });
// //친구요청 거절
// app.get('/refuse_add_friend/:receiver/:sender', (req, res) => {
// 	//receiver : 요청을 받았던 사람 , sender : 친구 요청을 했던 사람
// 	const { sender, receiver } = req.params;

// 	connection.query('DELETE FROM add_friends where sender =? AND receiver = ?', [sender, receiver], (err, result) => {
// 		if (err) console.error(err);
// 		if (connectedUsers[sender]) {
// 			connection.query(
// 				'SELECT receiver as uid, name, profileImage, statusMessage, status from add_friends join Users where sender = ? AND receiver=Users.uid',
// 				sender,
// 				(err, result) => {
// 					if (err) console.error(err);
// 					connection.query('SELECT name FROM Users WHERE uid=?', receiver, (err, name) => {
// 						name = name[0].name;
// 						io.to(connectedUsers[sender]).emit('add_friend_refused', result, name);
// 					});
// 				}
// 			);
// 		}
// 		connection.query(
// 			'SELECT sender as uid, name, profileImage, statusMessage from add_friends join Users where receiver = ? AND sender=Users.uid',
// 			receiver,
// 			(err, result) => {
// 				if (err) console.error(err);
// 				res.send(result);
// 			}
// 		);
// 	});
// });

const Listening = () => {
	console.log(`Listening on: http://localhost:${PORT}`);
};

httpServer.listen(PORT, Listening);
