// Genarates random string for token used in account model
module.exports.generateRandomString = (length) => {
  const character = "ABCDEFGHIKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for(let i = 0; i < length; i++) {
    result += character.charAt(Math.floor(Math.random() * character.length));
  }
  return result;
}

// Genarates random number for OTP
module.exports.generateRandomNumber = (length) => {
  const character = "0123456789";
  let result = "";
  for(let i = 0; i < length; i++) {
    result += character.charAt(Math.floor(Math.random() * character.length));
  }
  return result;
}