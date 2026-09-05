const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const session = require('express-session');

const connectDB = require('./src/config/db');
const webRoutes = require('./src/routes/web');
const User = require('./src/models/User');
const { initTelegramBot } = require('./src/services/telegramService');

const app = express();
const PORT = process.env.PORT || 5000;

// Cấu hình Template Engine Handlebars
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'src/views/layouts'),
    partialsDir: path.join(__dirname, 'src/views/partials'),
    helpers: {
      formatCurrency: (value) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0),
      eq: (a, b) => a === b
    }
  })
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Middlewares xử lý request & static files
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, 'public/outputs')));

// Cấu hình Session
app.use(
  session({
    secret: 'web-auto-sub-secret-key-production',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  })
);

// Middleware đồng bộ số phút, vai trò & giỏ hàng sang Views
app.use(async (req, res, next) => {
  if (req.session.user) {
    try {
      const dbUser = await User.findById(req.session.user.id).lean();
      if (dbUser) {
        req.session.user.remainingMinutes = dbUser.remainingMinutes;
        req.session.user.role = dbUser.role;
        res.locals.currentUser = dbUser;
      } else {
        res.locals.currentUser = req.session.user;
      }
    } catch (err) {
      res.locals.currentUser = req.session.user;
    }
  } else {
    res.locals.currentUser = null;
  }

  res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  next();
});

// Đăng ký Routes chính
app.use('/', webRoutes);

// Khởi động server (chỉ gọi app.listen đúng 1 lần)
const server = app.listen(PORT, () => {
  console.log(`✓ Server đang chạy tại: http://localhost:${PORT}`);
  // Khởi động Bot Telegram
  initTelegramBot();
});

// Xử lý bắt lỗi nếu cổng PORT bị chiếm
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`✗ Cổng ${PORT} đang bị chiếm dụng. Vui lòng dừng tiến trình Node cũ!`);
  } else {
    console.error('✗ Lỗi Server:', err.message);
  }
});

// Kết nối cơ sở dữ liệu MongoDB Atlas ở chế độ nền
connectDB();