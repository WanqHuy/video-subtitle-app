let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch (e) {
  try {
    bcrypt = require('bcrypt');
  } catch (err) {
    bcrypt = null;
  }
}

const User = require('../models/User');

// Hàm kiểm tra định dạng mật khẩu: Tối thiểu 8 ký tự, phải gồm chữ cái và số
const validatePassword = (password) => {
  if (!password || password.length < 8) {
    return 'Mật khẩu phải có độ dài tối thiểu 8 ký tự!';
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return 'Mật khẩu phải bao gồm cả chữ cái và số để đảm bảo bảo mật!';
  }
  return null;
};

exports.getLogin = (req, res) => {
  if (req.session.user) return res.redirect('/workspace');
  res.render('auth/login', { title: 'Đăng Nhập' });
};

exports.postLogin = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.render('auth/login', { 
        title: 'Đăng Nhập', 
        error: 'Email hoặc mật khẩu không chính xác!',
        email 
      });
    }

    let isMatch = false;
    if (bcrypt && user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
    }

    if (!isMatch) {
      return res.render('auth/login', { 
        title: 'Đăng Nhập', 
        error: 'Email hoặc mật khẩu không chính xác!',
        email 
      });
    }

    // Xử lý "Ghi nhớ tài khoản"
    if (rememberMe) {
      // Duy trì phiên đăng nhập trong 30 ngày
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
    } else {
      // Phiên đăng nhập mặc định: 1 ngày
      req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      tier: user.tier || 'free',
      remainingMinutes: user.remainingMinutes
    };

    res.redirect('/workspace');
  } catch (err) {
    res.render('auth/login', { title: 'Đăng Nhập', error: err.message });
  }
};

exports.getRegister = (req, res) => {
  if (req.session.user) return res.redirect('/workspace');
  res.render('auth/register', { title: 'Đăng Ký' });
};

exports.postRegister = async (req, res) => {
  try {
    const { name, email, password, agreeTerms } = req.body;

    // 1. Kiểm tra tick chọn điều khoản sử dụng
    if (!agreeTerms) {
      return res.render('auth/register', { 
        title: 'Đăng Ký', 
        error: 'Bạn cần đồng ý với Điều khoản sử dụng và Chính sách dịch vụ để tiếp tục!',
        name,
        email
      });
    }

    // 2. Validate độ mạnh mật khẩu
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.render('auth/register', { 
        title: 'Đăng Ký', 
        error: passwordError,
        name,
        email
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.render('auth/register', { 
        title: 'Đăng Ký', 
        error: 'Email này đã được sử dụng. Vui lòng chọn email khác!',
        name
      });
    }

    const hashedPassword = bcrypt ? await bcrypt.hash(password, 10) : password;

    const newUser = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'user',
      tier: 'free',
      remainingMinutes: 30
    });

    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      tier: newUser.tier,
      remainingMinutes: newUser.remainingMinutes
    };

    res.redirect('/workspace');
  } catch (err) {
    res.render('auth/register', { title: 'Đăng Ký', error: err.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
};

exports.getChangePassword = (req, res) => {
  res.render('auth/change-password', { title: 'Đổi Mật Khẩu' });
};

exports.postChangePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user.id || req.session.user._id;

    // 1. Validate mật khẩu mới
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.render('auth/change-password', {
        title: 'Đổi Mật Khẩu',
        error: passwordError
      });
    }

    // 2. Kiểm tra mật khẩu xác nhận
    if (newPassword !== confirmPassword) {
      return res.render('auth/change-password', {
        title: 'Đổi Mật Khẩu',
        error: 'Mật khẩu xác nhận không khớp với mật khẩu mới!'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.redirect('/login');
    }

    // 3. Kiểm tra mật khẩu hiện tại
    let isMatch = false;
    if (bcrypt && user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(currentPassword, user.password);
    } else {
      isMatch = user.password === currentPassword;
    }

    if (!isMatch) {
      return res.render('auth/change-password', {
        title: 'Đổi Mật Khẩu',
        error: 'Mật khẩu hiện tại không chính xác!'
      });
    }

    const hashedNewPassword = bcrypt ? await bcrypt.hash(newPassword, 10) : newPassword;
    user.password = hashedNewPassword;
    await user.save();

    res.render('auth/change-password', {
      title: 'Đổi Mật Khẩu',
      success: 'Cập nhật mật khẩu thành công! Hãy ghi nhớ mật khẩu mới của bạn.'
    });
  } catch (err) {
    res.render('auth/change-password', {
      title: 'Đổi Mật Khẩu',
      error: `Lỗi: ${err.message}`
    });
  }
};