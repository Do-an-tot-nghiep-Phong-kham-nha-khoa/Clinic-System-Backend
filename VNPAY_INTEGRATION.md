# VNPay Payment Integration Guide

## Overview
This document explains how to test the VNPay payment integration in the Clinic System.

## VNPay Sandbox Configuration

The system is configured with VNPay Sandbox credentials:
- **TMN Code**: CGWCHHNB
- **Hash Secret**: RAOEXHYVSDDIIENYWSBJLOESFRIWQBXC
- **Payment URL**: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
- **Return URL**: http://localhost:3000/api/invoices/vnpay/return

## Test Cards

Use these test cards in VNPay Sandbox:

### NCB Bank (Domestic Card)
- **Card Number**: 9704198526191432198
- **Cardholder Name**: NGUYEN VAN A
- **Issue Date**: 07/15
- **OTP**: 123456

### International Card (Visa/Master)
- **Card Number**: 4111111111111111
- **CVV**: 123
- **Expiry**: Any future date

## Payment Flow

1. **Patient initiates payment**
   - Go to `/patient/invoices`
   - Find a pending invoice
   - Click "Thanh toán VNPay" button

2. **System generates payment URL**
   - Creates a payment record in database with status "pending"
   - Generates secure HMAC SHA512 signature
   - Redirects to VNPay payment page

3. **Customer completes payment on VNPay**
   - Enter test card details
   - Complete OTP verification
   - VNPay processes payment

4. **VNPay redirects back to system**
   - Hits `/api/invoices/vnpay/return` endpoint
   - System verifies the signature
   - Updates payment status and invoice status
   - Redirects to frontend `/patient/payment-result`

5. **Payment confirmation (IPN)**
   - VNPay sends IPN to `/api/invoices/vnpay/ipn`
   - System verifies and confirms payment
   - Prevents duplicate confirmations

## Testing Steps

### Prerequisites
1. Backend running on `http://localhost:3000`
2. Frontend running on `http://localhost:5173`
3. Database connected
4. Patient account logged in

### Step-by-step Testing

1. **Start the servers**
   ```bash
   # Backend
   cd Clinic-System-Backend
   npm start

   # Frontend
   cd Clinic-System-Frontend
   npm run dev
   ```

2. **Login as patient**
   - Navigate to `http://localhost:5173/login`
   - Use patient credentials

3. **Create a pending invoice** (if needed)
   - Book an appointment
   - Complete the treatment
   - Invoice will be generated automatically

4. **Test VNPay payment**
   - Go to `/patient/invoices`
   - Click "Thanh toán VNPay" on a pending invoice
   - You'll be redirected to VNPay sandbox
   - Use test card: `9704198526191432198`
   - OTP: `123456`
   - Complete payment

5. **Verify payment result**
   - After payment, you'll be redirected to `/patient/payment-result`
   - Check payment status
   - Go back to invoices list
   - Invoice status should be "Paid"

6. **Check database**
   ```javascript
   // In MongoDB
   db.invoices.findOne({ invoiceNumber: "INV-XXXXX" })
   
   // Should see:
   {
     status: "Paid",
     payments: [{
       method: "vnpay",
       amount: 150000,
       status: "success",
       provider: "vnpay",
       providerPaymentId: "INV123456_timestamp",
       providerTransactionNo: "14193327",
       paid_at: ISODate("2024-01-01T10:00:00Z"),
       meta: {
         vnp_ResponseCode: "00",
         vnp_BankCode: "NCB",
         vnp_CardType: "ATM",
         message: "Giao dịch thành công"
       }
     }]
   }
   ```

## Response Codes

| Code | Message | Description |
|------|---------|-------------|
| 00 | Giao dịch thành công | Payment successful |
| 07 | Trừ tiền thành công. Giao dịch bị nghi ngờ | Suspicious transaction |
| 09 | Giao dịch không thành công | Transaction failed |
| 10 | Giao dịch không thành công | Transaction failed |
| 11 | Đã hết hạn chờ thanh toán | Payment timeout |
| 12 | Thẻ bị khóa | Card locked |
| 13 | Sai mật khẩu xác thực | Wrong OTP |
| 24 | Hủy giao dịch | Transaction cancelled |
| 51 | Tài khoản không đủ số dư | Insufficient balance |
| 65 | Tài khoản vượt quá hạn mức | Limit exceeded |

## Troubleshooting

### Payment URL not generated
- Check if invoice exists and is pending
- Verify patient has permission (must be appointment booker)
- Check console logs for errors

### Invalid signature error
- Verify VNP_HASH_SECRET in `.env`
- Check parameter sorting in vnpayService.js
- Ensure all required parameters are included

### Redirect not working
- Check FRONTEND_URL in `.env`
- Verify PaymentResult route is registered
- Check browser console for errors

### Payment status not updated
- Check backend logs for vnpayReturn execution
- Verify database connection
- Check if providerPaymentId matches

## Security Notes

1. **Never commit real credentials** to version control
2. **HMAC SHA512 signature** is required for all requests
3. **Parameter sorting** must be alphabetical for signature
4. **IPN endpoint** prevents duplicate confirmations
5. **Production credentials** must be obtained from VNPay merchant portal

## Production Deployment

When deploying to production:

1. Register merchant account at https://vnpay.vn
2. Get production credentials (TMN Code, Hash Secret)
3. Update `.env` file:
   ```env
   VNP_TMN_CODE=your_production_tmn_code
   VNP_HASH_SECRET=your_production_hash_secret
   VNP_URL=https://vnpayment.vn/paymentv2/vpcpay.html
   VNP_RETURN_URL=https://yourdomain.com/api/invoices/vnpay/return
   FRONTEND_URL=https://yourdomain.com
   ```
4. Update VNPay merchant portal with your IPN URL
5. Test thoroughly before going live

## References

- VNPay Documentation: https://sandbox.vnpayment.vn/apis/docs/
- Test Cards: https://sandbox.vnpayment.vn/apis/vnpay-test-data.html
- Response Codes: https://sandbox.vnpayment.vn/apis/docs/bang-ma-loi/
