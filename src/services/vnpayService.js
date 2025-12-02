const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment');
const vnpayConfig = require('../../config/vnpay');

/**
 * Sắp xếp object theo key (VNPay yêu cầu)
 */
function sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort();
    keys.forEach(key => {
        sorted[key] = encodeURIComponent(obj[key]).replace(/%20/g, '+');
    });
    return sorted;
}

/**
 * Tạo URL thanh toán VNPay
 */
exports.buildPaymentUrl = (params) => {
    const {
        amount,
        orderId,
        orderInfo,
        orderType = 'other',
        ipAddr,
        locale = 'vn',
        returnUrl
    } = params;

    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const expireDate = moment(date).add(15, 'minutes').format('YYYYMMDDHHmmss');

    let vnp_Params = {
        vnp_Version: '2.1.0',
        vnp_Command: 'pay',
        vnp_TmnCode: vnpayConfig.vnp_TmnCode,
        vnp_Locale: locale,
        vnp_CurrCode: 'VND',
        vnp_TxnRef: orderId,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: orderType,
        vnp_Amount: amount * 100, // VNPay yêu cầu amount * 100
        vnp_ReturnUrl: returnUrl || vnpayConfig.vnp_ReturnUrl,
        vnp_IpAddr: ipAddr,
        vnp_CreateDate: createDate,
        vnp_ExpireDate: expireDate
    };

    vnp_Params = sortObject(vnp_Params);

    const signData = querystring.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac("sha512", vnpayConfig.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;

    const paymentUrl = vnpayConfig.vnp_Url + '?' + querystring.stringify(vnp_Params, { encode: false });
    
    return paymentUrl;
};

/**
 * Verify secure hash từ VNPay callback
 */
exports.verifyReturnUrl = (vnp_Params) => {
    const secureHash = vnp_Params['vnp_SecureHash'];
    
    // Clone params để không modify original
    const paramsToVerify = { ...vnp_Params };
    delete paramsToVerify['vnp_SecureHash'];
    delete paramsToVerify['vnp_SecureHashType'];

    const sortedParams = sortObject(paramsToVerify);
    const signData = querystring.stringify(sortedParams, { encode: false });
    
    const hmac = crypto.createHmac("sha512", vnpayConfig.vnp_HashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    
    return secureHash === signed;
};


exports.getResponseMessage = (responseCode) => {
    const messages = {
        '00': 'Giao dịch thành công',
        '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
        '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
        '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
        '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
        '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
        '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
        '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
        '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
        '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
        '75': 'Ngân hàng thanh toán đang bảo trì.',
        '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
        '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)'
    };
    
    return messages[responseCode] || 'Lỗi không xác định';
};
