const jwt = require("jsonwebtoken");
const Account = require("../models/account");

module.exports.infoUser = async (req, res, next) => {
  try {
    const token = req.cookies.tokenUser;

    if (!token) {
      return next(); // không có token -> tiếp tục, user = undefined
    }

    // Xác minh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm account tương ứng
    const account = await Account.findOne({
      _id: decoded.id,
      deleted: false,
      status: "active"
    }).select("-password");

    if (account) {
      res.locals.user = account;
    }
  } catch (err) {
    // Token hết hạn hoặc không hợp lệ
    if (err.name === "TokenExpiredError") {
      console.warn("JWT token expired");
    } else if (err.name === "JsonWebTokenError") {
      console.warn("Invalid JWT token");
    }
  }

  next();
};
