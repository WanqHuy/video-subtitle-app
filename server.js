require('dotenv').config(); // BẮT BUỘC Ở DÒNG 1 để đọc file .env trước tiên
const express = require('express');
const { engine } = require('express-handlebars');
const path = require('path');
const session = require('express-session');

const connectDB = require('./src/config/db');
const webRoutes = require('./src/routes/web');

const app = express();
const PORT = process.env.PORT || 5000;

// Kết nối Cơ sở dữ liệu MongoDB
connectDB();

// Handlebars Engine Setup
app.engine(
  'hbs',
  engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'src/views/layouts'),
    partialsDir: path.join(__dirname, 'src/views/partials'),
    helpers: {
      formatCurrency: (value) =>
        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value),
      eq: (a, b) => a === b // Helper so sánh dùng kiểm tra role admin
    }
  })
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'src/views'));

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'web-auto-sub-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
  })
);

// Middleware truyền thông tin user và cart cho toàn bộ views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.isAdmin = req.session.user && req.session.user.role === 'admin';
  const cart = req.session.cart || [];
  res.locals.cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  next();
});

// Routes
app.use('/', webRoutes);

app.listen(PORT, () => {
  console.log(`Server đang chạy tại: http://localhost:${PORT}`);
});