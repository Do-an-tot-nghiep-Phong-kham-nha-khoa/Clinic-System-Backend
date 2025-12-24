const { MongoMemoryServer } = require('mongodb-memory-server');

// Start an in-memory Mongo if no MONGO_URL is provided (so tests default to in-memory DB)
let _mongod;
beforeAll(async () => {
	_mongod = await MongoMemoryServer.create();
	process.env.MONGO_URL = _mongod.getUri();
	global.__MONGOD__ = _mongod;
});

afterAll(async () => {
	if (_mongod) {
		try {
			await _mongod.stop();
		} catch (e) {
			// ignore
		}
		delete global.__MONGOD__;
	}
});
