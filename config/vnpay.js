module.exports = {
    vnp_TmnCode: process.env.VNP_TMN_CODE || "CGWCHHNB", // Mã website test
    vnp_HashSecret: process.env.VNP_HASH_SECRET || "RAOEXHYVSDDIIENYWSBJLOESFRIWQBXC", // Secret key test
    vnp_Url: process.env.VNP_URL || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    vnp_Api: process.env.VNP_API || "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
    vnp_ReturnUrl: process.env.VNP_RETURN_URL || "http://localhost:3000/invoices/vnpay/return",
    frontend_Url: process.env.FRONTEND_URL || "http://localhost:8000", // Frontend URL
};
