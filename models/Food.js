const mongoose = require('mongoose');

const FoodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Tên món ăn là bắt buộc.'], // Tên món ăn là bắt buộc
        trim: true,
        unique: true, // <--- THÊM DÒNG NÀY ĐỂ TÊN MÓN ĂN LÀ DUY NHẤT
        maxlength: [100, 'Tên món ăn không được quá 100 ký tự.']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Mô tả không được quá 500 ký tự.']
    },
    image: {
        type: String,
        required: [true, 'Ảnh minh họa là bắt buộc.'],
        default: '/images/default-food.png'
    },
    province: {
        type: String,
        required: [true, 'Tỉnh/Thành phố là bắt buộc.'],
        trim: true
    },
    region: { 
        type: String,
        required: [true, 'Vùng miền là bắt buộc.'],
        trim: true
    },
    suggestedAt: {
        type: String,
        required: [true, 'Gợi ý thử tại là bắt buộc.'], // <-- THÊM DÒNG NÀY ĐỂ TRƯỜNG LÀ BẮT BUỘC
        trim: true,
        maxlength: [200, 'Gợi ý thử tại không được quá 200 ký tự.'] // Có thể thêm maxlength nếu muốn
    },
    category: {
        type: String,
        required: [true, 'Danh mục là bắt buộc.'],
        enum: ['Tôm', 'Cua', 'Ghẹ', 'Mực', 'Bạch tuộc', 'Cá', 'Bề bề', 'Ốc', 'Sò', 'Các loại khác'],
        trim: true
    },
    otherCategoryName: { 
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ratings: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            stars: {
                type: Number,
                min: 1,
                max: 5,
                required: true
            },
            comment: {
                type: String,
                trim: true,
                maxlength: [300, 'Bình luận không được quá 300 ký tự.']
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }
    ]
}, {
    timestamps: true
});

FoodSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Food', FoodSchema);
