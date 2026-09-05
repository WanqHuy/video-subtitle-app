const bcrypt = require('bcryptjs');
const User = require('../models/User');

exports.getLogin = (req, res) => {
  res.render('auth/login', { 
    title: 'Đăng Nhập', 
    infoMessage: req.query.message || null 
  });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render('auth/login', {
        title: 'Đăng Nhập',
        error: 'Email hoặc mật khẩu không chính xác!'
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.redirect('/');
  } catch (error) {
    res.render('auth/login', { title: 'Đăng Nhập', error: error.message });
  }
};

exports.getRegister = (req, res) => res.render('auth/register', { title: 'Đăng Ký' });

exports.postRegister = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) {
      return res.render('auth/register', {
        title: 'Đăng Ký',
        error: 'Email này đã tồn tại trên hệ thống!'
      });
    }

    // Tài khoản đăng ký đầu tiên trong hệ thống sẽ tự động cấp quyền Admin
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'admin' : 'user';

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role
    });

    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role
    };

    res.redirect('/');
  } catch (error) {
    res.render('auth/register', { title: 'Đăng Ký', error: error.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/login');
};