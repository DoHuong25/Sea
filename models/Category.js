//models/Category.js 

const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên danh mục là bắt buộc.'],
    unique: true,
    trim: true,
    enum: ['Hải sản Tươi', 'Hải sản Khô'] 
  },
  description: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);