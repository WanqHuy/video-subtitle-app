module.exports = {
  // Bắt buộc phải đăng nhập
  requireAuth: (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login?message=Vui lòng đăng nhập để tiếp tục sử dụng tính năng!');
    }
    next();
  },

  // Bắt buộc quyền Admin (User thường vào sẽ bị từ chối)
  requireAdmin: (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login?message=Vui lòng đăng nhập quyền Quản trị viên!');
    }
    if (req.session.user.role !== 'admin') {
      return res.status(403).render('auth/login', {
        title: 'Từ Chối Truy Cập',
        error: 'Bạn không có quyền truy cập vào khu vực Quản Trị (Admin Only)!'
      });
    }
    next();
  }
};