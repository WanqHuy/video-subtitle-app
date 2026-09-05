const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');

// Cấu hình lưu trữ file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
  }
});
const upload = multer({ storage });

const packageController = require('../controllers/packageController');
const authController = require('../controllers/authController');
const cartController = require('../controllers/cartController');
const adminController = require('../controllers/adminController');
const subtitleController = require('../controllers/subtitleController');
const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

// Public: Trang chủ & Xác thực
router.get('/', packageController.getHome);
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/logout', authController.logout);

// YÊU CẦU ĐĂNG NHẬP: Gói dịch vụ & Chi tiết
router.get('/packages', requireAuth, packageController.getAllPackages);
router.get('/packages/:id', requireAuth, packageController.getPackageDetail);

// YÊU CẦU ĐĂNG NHẬP: Giỏ hàng & Mua hàng
router.get('/cart', requireAuth, cartController.getCart);
router.post('/cart/add', requireAuth, cartController.addToCart);
router.get('/cart/remove/:id', requireAuth, cartController.removeFromCart);
router.post('/cart/checkout', requireAuth, cartController.checkout);

// YÊU CẦU ĐĂNG NHẬP: Công cụ tạo phụ đề
router.get('/workspace', requireAuth, subtitleController.getWorkspace);
router.post('/workspace/upload', requireAuth, upload.single('videoFile'), subtitleController.processVideo);
router.post('/workspace/render', requireAuth, subtitleController.renderFinalVideo);

// YÊU CẦU ĐĂNG NHẬP: Quản trị (Admin)
router.get('/admin', requireAdmin, adminController.getDashboard);
router.get('/admin/packages/create', requireAdmin, adminController.getCreatePackage);
router.post('/admin/packages/create', requireAdmin, adminController.postCreatePackage);
router.get('/admin/packages/edit/:id', requireAdmin, adminController.getEditPackage);
router.post('/admin/packages/edit/:id', requireAdmin, adminController.postEditPackage);
router.get('/admin/packages/delete/:id', requireAdmin, adminController.deletePackage);
module.exports = router;