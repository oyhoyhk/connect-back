const mysql = require('mysql2');
const options = {
	host: 'localhost',
	user: 'root',
	password: '1234',
	database: 'connectDB',
	multipleStatements: true,
};
const pool = mysql.createPool(options);
const connection = pool.promise();

module.exports = connection;
