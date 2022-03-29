const multer = require('multer');

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
signUp.fields([
	{
		name: 'profileImage',
		maxCount: 1,
	},
]);

module.exports = signUp.single('profileImage');
