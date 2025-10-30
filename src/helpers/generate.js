// Genarates random string for token used in account model
const jwt = require('jsonwebtoken');

module.exports.generateJWTToken = (account, extraPayload = {}) => {
  const payload = {
    id: account._id,
    email: account.email,
    roleId: account.roleId,
    ...extraPayload // <-- thêm để hỗ trợ mục đích đặc biệt (reset_password, verify_email,...)
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};


// Genarates random number for OTP
module.exports.generateRandomNumber = (length) => {
  const character = "0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += character.charAt(Math.floor(Math.random() * character.length));
  }
  return result;
}