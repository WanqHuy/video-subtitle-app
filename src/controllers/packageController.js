const mongoose = require('mongoose');
const Package = require('../models/Package');

exports.getHome = async (req, res) => {
  try {
    const packages = await Package.find().lean();
    res.render('home', { title: 'AI Subtitle - Trang Chủ', packages });
  } catch (err) {
    console.error('Lỗi getHome:', err.message);
    res.status(500).send(err.message);
  }
};

exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find().lean();
    res.render('packages', { title: 'Danh Sách Gói Dịch Vụ', packages });
  } catch (err) {
    console.error('Lỗi getAllPackages:', err.message);
    res.status(500).send(err.message);
  }
};

exports.getPackageDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Ngăn chặn tìm kiếm nếu ID truyền vào bị rỗng hoặc không phải ObjectId hợp lệ
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.warn('ID gói dịch vụ không hợp lệ:', id);
      return res.redirect('/packages');
    }

    const pkg = await Package.findById(id).lean();
    if (!pkg) return res.redirect('/packages');

    res.render('package-detail', { title: pkg.name, pkg });
  } catch (err) {
    console.error('Lỗi getPackageDetail:', err.message);
    res.status(500).send(err.message);
  }
};