const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true }, // 
  password: { type: String, required: true }, // 
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // 
  avatar: { type: String, default: '/images/avatars/default-avatar.png' }, // Default avatar
  email: { type: String, unique: true, sparse: true, trim: true, lowercase: true }, // Email field, unique but allows multiple nulls
  bio: { type: String, maxlength: 500 }, // Bio field
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema); //