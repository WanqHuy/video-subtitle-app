const Package = require('../models/Package');
const Order = require('../models/Order');

exports.getCart = (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  res.render('cart', { title: 'Giỏ Hàng', cart, total });
};

exports.addToCart = async (req, res) => {
  const { packageId } = req.body;
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
      quantity: 1
    });
  }
  res.redirect('/cart');
};

exports.removeFromCart = (req, res) => {
  const { id } = req.params;
  if (req.session.cart) {
    req.session.cart = req.session.cart.filter((item) => item.id !== id);
  }
  res.redirect('/cart');
};

exports.checkout = async (req, res) => {
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/cart');

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = await Order.create({
    user: req.session.user ? req.session.user.id : null,
    userEmail: req.session.user ? req.session.user.email : 'Khách vãng lai',
    items: cart.map(item => ({
      packageId: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    })),
    total
  });

  req.session.cart = [];
  res.render('checkout-success', {
    title: 'Thanh Toán Thành Công',
    order: {
      id: order._id,
      total: order.total,
      date: new Date(order.createdAt).toLocaleString('vi-VN')
    }
  });
};