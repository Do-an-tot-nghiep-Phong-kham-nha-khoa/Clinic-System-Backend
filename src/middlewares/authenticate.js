const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  const token = req.cookies.tokenUser;
  if (!token) return res.status(401).json({ message: "Chưa đăng nhập" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Thêm role vào req.user từ decoded token
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role, // Thêm role
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc hết hạn" });
  }
};
