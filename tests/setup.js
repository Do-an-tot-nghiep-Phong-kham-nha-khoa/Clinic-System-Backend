const mongoose = require('mongoose');

// Connect to a test database before tests
beforeAll(async () => {
  const mongoUri = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/test-db';
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
});

// Clear all collections after each test
afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Close the connection after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});