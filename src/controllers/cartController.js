const mongoose = require('mongoose');
const Package = require('../models/Package');
const Order = require('../models/Order');
const User = require('../models/User');
const { sendNewOrderAlert } = require('../services/telegramService');

const BANK_CONFIG = {
  bankId: 'MB',
  accountNo: '00426032006',
  accountName: 'NGUYEN QUANG HUY'
};

exports.getCart = (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render('cart', { title: 'Giỏ Hàng', cart, total });
};

exports.addToCart = async (req, res) => {
  try {
    const { packageId } = req.body;
    if (!packageId || !mongoose.Types.ObjectId.isValid(packageId)) {
      return res.redirect('/packages');
    }

    const pkg = await Package.findById(packageId).lean();
    if (!pkg) return res.redirect('/packages');

    if (!req.session.cart) req.session.cart = [];
    const existing = req.session.cart.find((i) => i.id === String(pkg._id));

    if (existing) {
      existing.quantity += 1;
    } else {
      req.session.cart.push({
        id: String(pkg._id),
        name: pkg.name,
        price: pkg.price,
        durationMinutes: Number(pkg.durationMinutes) || 0,
        quantity: 1
      });
    }
    res.redirect('/cart');
  } catch (err) {
    res.redirect('/packages');
  }
};

exports.removeFromCart = (req, res) => {
  const { id } = req.params;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter((item) => item.id !== id);
  }
  res.redirect('/cart');
};

exports.checkout = async (req, res) => {
  try {
    const cart = req.session.cart || [];
    if (cart.length === 0) return res.redirect('/cart');

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalMinutes = cart.reduce((sum, item) => sum + (Number(item.durationMinutes) || 0) * item.quantity, 0);
    const paymentCode = `SUB${Math.floor(1000 + Math.random() * 9000)}`;

    const currentUserId = req.session.user ? (req.session.user.id || req.session.user._id) : null;

    const order = await Order.create({
      user: currentUserId,
      userEmail: req.session.user ? req.session.user.email : 'guest@example.com',
      items: cart.map((item) => ({
        packageId: item.id,
        name: item.name,
        price: item.price,
        durationMinutes: item.durationMinutes,
        quantity: item.quantity
      })),
      total,
      addedMinutes: totalMinutes,
      paymentCode,
      status: 'Pending'
    });

    req.session.cart = [];
    await sendNewOrderAlert(order);

    res.redirect(`/order/payment/${order._id}`);
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.getPaymentPage = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.redirect('/packages');
    }

    const order = await Order.findById(orderId).lean();
    if (!order) return res.redirect('/packages');

    if (order.status === 'Completed') {
      return res.redirect(`/order/success/${order._id}`);
    }

    const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?amount=${order.total}&addInfo=${order.paymentCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

    res.render('payment-qr', {
      title: 'Thanh Toán VietQR',
      order,
      qrUrl,
      bankInfo: BANK_CONFIG
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.checkOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.json({ status: 'Invalid' });
    }

    const order = await Order.findById(orderId).lean();
    if (!order) return res.json({ status: 'NotFound' });

    res.json({ status: order.status });
  } catch (err) {
    res.status(500).json({ status: 'Error' });
  }
};

exports.notifyTransfer = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.redirect('/packages');

    const qrUrl = `https://img.vietqr.io/image/${BANK_CONFIG.bankId}-${BANK_CONFIG.accountNo}-compact2.png?amount=${order.total}&addInfo=${order.paymentCode}&accountName=${encodeURIComponent(BANK_CONFIG.accountName)}`;

    res.render('payment-qr', {
      title: 'Đang Chờ Xác Nhận',
      order,
      isWaitingApproval: true,
      qrUrl,
      bankInfo: BANK_CONFIG
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.getSuccessPage = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).lean();
    if (!order) return res.redirect('/');

    // Cập nhật session user
    if (req.session.user) {
      const dbUser = await User.findById(req.session.user.id || req.session.user._id).lean();
      if (dbUser) {
        req.session.user.remainingMinutes = dbUser.remainingMinutes;
        req.session.user.tier = dbUser.tier;
      }
    }

    res.render('checkout-success', {
      title: 'Thanh Toán Hoàn Tất',
      order: {
        id: order._id,
        total: order.total,
        addedMinutes: order.addedMinutes,
        date: new Date(order.createdAt).toLocaleString('vi-VN')
      }
    });
  } catch (err) {
    res.status(500).send(err.message);
  }
};