const Patient = require('../models/patient');
const md5 = require('md5');
// [POST] /patients/register
module.exports.register = async (req, res) => {
    const existEmail = await Patient.findOne({
      email: req.body.email
    })
    if(existEmail) {
        return res.status(400).json({ message: "Email đã tồn tại!" });
    } else {
        req.body.password = md5(req.body.password);
        const patient = new Patient(req.body);
        await patient.save();
        res.cookie("tokenUser", patient.tokenUser);
        res.status(201).json({ message: "Đăng ký thành công!" });
    }
}

// [POST] /patients/login
module.exports.login = async (req, res) => {
    const email = req.body.email;
    const password = req.body.password;
    const patient = await Patient.findOne({
      email: email,
      deleted: false
    })
    if(!patient) {
        return res.status(400).json({ message: "Email không tồn tại!" });
    }
    if(md5(password) !== patient.password) {
        return res.status(400).json({ message: "Sai mật khẩu!" });
    }
    if(patient.status === 'inactive') {
        return res.status(400).json({ message: "Tài khoản đang bị khóa!" });
    }
    res.cookie("tokenUser", patient.tokenUser);
    res.status(200).json({ message: "Đăng nhập thành công!" });
}

// [GET] /patients/logout
module.exports.logout = async (req, res) => {
    res.clearCookie("tokenUser");
    res.status(200).json({ message: "Đăng xuất thành công!" });
}

