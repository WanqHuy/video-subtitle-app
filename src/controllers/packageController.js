const Package = require('../models/Package');

exports.getHome = async (req, res) => {
  try {
    const packages = await Package.find().lean();
    res.render('home', { title: 'AI Subtitle - Trang Chủ', packages });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find().lean();
    res.render('packages', { title: 'Danh Sách Gói Dịch Vụ', packages });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.getPackageDetail = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).lean();
    if (!pkg) return res.status(404).send('Không tìm thấy gói.');
    res.render('package-detail', { title: pkg.name, pkg });
  } catch (err) {
    res.status(500).send(err.message);
  }
};