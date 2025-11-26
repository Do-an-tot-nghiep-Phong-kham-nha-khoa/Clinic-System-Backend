// Kiểm tra email
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

// Chuẩn hóa dữ liệu
function trimFields(obj, fields) {
  fields.forEach(key => {
    if (typeof obj[key] === "string") {
      obj[key] = obj[key].trim();
    }
  });
}

module.exports.register = (req, res, next) => {
  trimFields(req.body, ["fullName", "email", "password"]);

  const { fullName, email, password } = req.body;

  if (!fullName) {
    return res.status(400).json({ message: "Vui lòng nhập họ và tên" });
  }

  if (!email) {
    return res.status(400).json({ message: "Vui lòng nhập email" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email không hợp lệ" });
  }

  if (!password) {
    return res.status(400).json({ message: "Vui lòng nhập mật khẩu" });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: "Mật khẩu phải ít nhất 6 ký tự!" });
  }

  next();
};

module.exports.login = (req, res, next) => {
  trimFields(req.body, ["email", "password"]);

  const { email, password } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Vui lòng nhập email" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email không hợp lệ" });
  }

  if (!password) {
    return res.status(400).json({ message: "Vui lòng nhập mật khẩu" });
  }

  next();
};

module.exports.forgotPassword = (req, res, next) => {
  trimFields(req.body, ["email"]);

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Vui lòng nhập email" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: "Email không hợp lệ" });
  }

  next();
};

module.exports.resetPassword = (req, res, next) => {
  trimFields(req.body, ["newPassword", "confirmPassword"]);

  const { newPassword, confirmPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: "Vui lòng nhập mật khẩu!" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "Mật khẩu phải ít nhất 6 ký tự!" });
  }

  if (!confirmPassword) {
    return res.status(400).json({ message: "Vui lòng xác nhận mật khẩu!" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Mật khẩu xác nhận không khớp!" });
  }

  next();
};
