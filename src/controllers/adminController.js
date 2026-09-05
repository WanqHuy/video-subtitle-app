const Package = require('../models/Package');

exports.getDashboard = async (req, res) => {
  try {
    const packages = await Package.find().lean();
    res.render('admin/dashboard', { title: 'Quản Trị Hệ Thống', packages });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.getCreatePackage = (req, res) => {
  res.render('admin/create-package', { title: 'Thêm Gói Mới' });
};

exports.postCreatePackage = async (req, res) => {
  try {
    const { name, price, durationMinutes, accuracy, description } = req.body;
    await Package.create({
      name,
      price: Number(price),
      durationMinutes: Number(durationMinutes),
      accuracy,
      description
    });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.getEditPackage = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id).lean();
    if (!pkg) return res.redirect('/admin');
    res.render('admin/edit-package', { title: 'Sửa Gói Dịch Vụ', pkg });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.postEditPackage = async (req, res) => {
  try {
    const { name, price, durationMinutes, accuracy, description } = req.body;
    await Package.findByIdAndUpdate(req.params.id, {
      name,
      price: Number(price),
      durationMinutes: Number(durationMinutes),
      accuracy,
      description
    });
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send(err.message);
  }
};

exports.deletePackage = async (req, res) => {
  try {
    await Package.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send(err.message);
  }
};