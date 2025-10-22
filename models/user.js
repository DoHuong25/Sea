// models/user.js 
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); // Import bcrypt để hash mật khẩu

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  
  // SỬA ĐỔI: Cập nhật 3 vai trò theo đề cương
  role: { 
    type: String, 
    enum: ['customer', 'employee', 'admin'], // 3 vai trò mới
    default: 'customer' // Người dùng đăng ký mặc định là khách hàng
  }, 
  
  // CÁC TRƯỜNG DÀNH CHO TRANG CÁ NHÂN (PROFILE)
  email: { 
    type: String, 
    unique: true, 
    sparse: true, 
    trim: true, 
    lowercase: true 
  },
  avatar: { 
    type: String, 
    default: '/images/avatars/default-avatar.png' 
  },
  bio: { 
    type: String, 
    maxlength: 500 
  },
  phone: { 
    type: String, 
    trim: true 
  },
  address: { 
    type: String, 
    trim: true 
  }
  
}, { 
  timestamps: true // Tự động thêm createdAt và updatedAt
});

// THÊM MỚI: Tự động hash mật khẩu trước khi lưu
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('User', userSchema);