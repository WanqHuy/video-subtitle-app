const { v4: uuidv4 } = require('uuid');

let packages = [
  {
    id: 'pkg-1',
    name: 'Gói Cơ Bản (Starter Sub)',
    price: 99000,
    durationMinutes: 60,
    accuracy: '95%',
    description: 'Phù hợp làm video ngắn TikTok, Reels. Tự động xuất file SRT và VTT tiêu chuẩn.'
  },
  {
    id: 'pkg-2',
    name: 'Gói Chuyên Nghiệp (Pro Creator)',
    price: 249000,
    durationMinutes: 300,
    accuracy: '99%',
    description: 'Hỗ trợ video dài YouTube, nhận diện 50+ ngôn ngữ, dịch tự động sang tiếng Anh.'
  },
  {
    id: 'pkg-3',
    name: 'Gói Doanh Nghiệp (Studio Unlimited)',
    price: 799000,
    durationMinutes: 1200,
    accuracy: '99.9%',
    description: 'Xử lý video 4K tốc độ cao, hỗ trợ tách từng người nói (Speaker Diarization).'
  }
];

let users = [];
let orders = [];

module.exports = {
  // Package CRUD
  getAllPackages: () => packages,
  getPackageById: (id) => packages.find(p => p.id === id),
  createPackage: (pkg) => {
    const newPkg = { id: `pkg-${Date.now()}`, ...pkg, price: Number(pkg.price), durationMinutes: Number(pkg.durationMinutes) };
    packages.push(newPkg);
    return newPkg;
  },
  updatePackage: (id, updatedData) => {
    const idx = packages.findIndex(p => p.id === id);
    if (idx !== -1) {
      packages[idx] = { ...packages[idx], ...updatedData, price: Number(updatedData.price), durationMinutes: Number(updatedData.durationMinutes) };
      return packages[idx];
    }
    return null;
  },
  deletePackage: (id) => {
    packages = packages.filter(p => p.id !== id);
  },

  // User
  findUserByEmail: (email) => users.find(u => u.email === email),
  createUser: (user) => {
    const newUser = { id: uuidv4(), ...user, role: users.length === 0 ? 'admin' : 'user' };
    users.push(newUser);
    return newUser;
  },

  // Order
  createOrder: (order) => {
    const newOrder = { id: `ORD-${Date.now()}`, ...order, date: new Date().toLocaleString('vi-VN') };
    orders.push(newOrder);
    return newOrder;
  }
};