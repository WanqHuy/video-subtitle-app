const dns = require('dns');
// Ép Node.js dùng DNS Google để không bị nhà mạng chặn kết nối tới Atlas
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');

// Dán trực tiếp chuỗi kết nối (Bỏ qua phụ thuộc file .env)
const ATLAS_URI = 'mongodb+srv://admin:admin@cluster0.cjf6bj4.mongodb.net/video_subtitle_db?retryWrites=true&w=majority&appName=Cluster0';

const connectDB = async () => {
  try {
    console.log('--- Bắt đầu kết nối tới MongoDB Atlas ---');
    
    const conn = await mongoose.connect(ATLAS_URI, {
      serverSelectionTimeoutMS: 8000
    });

    console.log(`✓ MongoDB Connected thành công: ${conn.connection.host}`);
  } catch (error) {
    console.error('✗ Chi tiết lỗi kết nối:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;