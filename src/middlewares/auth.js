// middlewares/auth.js
const jwt = require('jsonwebtoken');
const Account = require('../models/account');
const Role = require('../models/role');

module.exports.requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.tokenUser;
    if (!token) return res.status(401).json({ message: "Bạn chưa đăng nhập!" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const account = await Account.findById(decoded.id).populate('roleId');

    if (!account || account.status === 'inactive') {
      return res.status(403).json({ message: "Tài khoản không hợp lệ!" });
    }

    req.user = { id: account._id, role: account.roleId.name };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ!" });
  }
};

module.exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Bạn không có quyền truy cập!" });
    }
    next();
  };
};
