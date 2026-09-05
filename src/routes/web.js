const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const packageController = require('../controllers/packageController');
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const cartController = require('../controllers/cartController');
const subtitleController = require('../controllers/subtitleController');

const { requireAuth, requireAdmin } = require('../middlewares/authMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Routes Công Khai
router.get('/', packageController.getHome);
router.get('/packages', packageController.getAllPackages);
router.get('/packages/:id', packageController.getPackageDetail);

// Routes Đăng Nhập / Đăng Ký / Đổi Mật Khẩu
router.get('/login', authController.getLogin);
router.post('/login', authController.postLogin);
router.get('/register', authController.getRegister);
router.post('/register', authController.postRegister);
router.get('/logout', authController.logout);

// Routes Đổi Mật Khẩu (Bắt buộc đã đăng nhập)
router.get('/change-password', requireAuth, authController.getChangePassword);
router.post('/change-password', requireAuth, authController.postChangePassword);

// Routes Giỏ Hàng & Thanh Toán
router.get('/cart', cartController.getCart);
router.post('/cart/add', cartController.addToCart);
router.get('/cart/remove/:id', cartController.removeFromCart);
router.post('/checkout', requireAuth, cartController.checkout);
router.post('/cart/checkout', requireAuth, cartController.checkout);

// Routes Kiểm tra & Xác nhận thanh toán
router.get('/order/payment/:orderId', requireAuth, cartController.getPaymentPage);
router.post('/order/confirm/:orderId', requireAuth, cartController.notifyTransfer);
router.get('/order/check-status/:orderId', cartController.checkOrderStatus);
router.get('/order/success/:orderId', requireAuth, cartController.getSuccessPage);

// Routes Studio AI Workspace
router.get('/workspace', requireAuth, subtitleController.getWorkspace);
router.post('/workspace/upload', requireAuth, upload.single('videoFile'), subtitleController.uploadVideo);
router.post('/workspace/render', requireAuth, subtitleController.renderVideo);

// Routes Quản Trị Hệ Thống (Admin Only)
router.get('/admin', requireAdmin, adminController.getDashboard);
router.get('/admin/packages/create', requireAdmin, adminController.getCreatePackage);
router.post('/admin/packages/create', requireAdmin, adminController.postCreatePackage);
router.get('/admin/packages/edit/:id', requireAdmin, adminController.getEditPackage);
router.post('/admin/packages/edit/:id', requireAdmin, adminController.postEditPackage);
router.get('/admin/packages/delete/:id', requireAdmin, adminController.deletePackage);

module.exports = router;