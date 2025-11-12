const jwt = require('jsonwebtoken');

exports.authenticate = (req, res, next) => {
    const token = req.cookies.tokenUser;
    console.debug('cookies present:', req.cookies ? Object.keys(req.cookies) : 'no cookies');
    if (!token) return res.status(401).json({ message: 'Chưa đăng nhập' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.id, email: decoded.email };
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Token không hợp lệ hoặc hết hạn' });
    }
};
