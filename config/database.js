// Kết nối với CSDL MongoDB sử dụng MongoDBCompass

const mongoose = require('mongoose');

module.exports.connect = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("Connect successfully");
    } catch (error) {
        console.log("Connect Error");
    }
}
module.exports.connectMockDB = async () => {
    try {
        await mongoose.connect(process.env.MOCK_DB_URL)
        console.log("Connect to Mock DB successfully");
    } catch (error) {
        console.log("Connect to Mock DB Error");
    }
}
