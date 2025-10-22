//  models/Product.js 
const mongoose = require('mongoose');
// --- ĐỊNH NGHĨA BIẾN THỂ (VARIANT) ---
// Schema cho các loại khác nhau của cùng một sản phẩm
const VariantSchema = new mongoose.Schema({
    name: { // Tên của biến thể (ví dụ: "Cua thịt (Loại 1)", "Size lớn (5 con/kg)")
        type: String,
        required: true,
        trim: true
    },
    price: { // Giá của riêng biến thể này
        type: Number,
        required: true
    },
    unit: { // Đơn vị tính cho biến thể này (ví dụ: kg, con, gói)
        type: String,
        required: true,
        default: 'kg'
    }
    
});


// --- ĐỊNH NGHĨA SẢN PHẨM  ---
const productSchema = new mongoose.Schema({
    name: { // Tên chung của sản phẩm 
        type: String,
        required: [true, 'Tên sản phẩm là bắt buộc.'],
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true,
        required: [true, 'Mô tả là bắt buộc.']
    },
    image: {
        type: String,
        required: [true, 'Ảnh minh họa là bắt buộc.']
    },
    category: { // Liên kết tới danh mục "Hải sản Tươi" hoặc "Hải sản Khô"
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    
    // Mảng các loại khác nhau của sản phẩm
    variants: [VariantSchema],
    
    // --- PHẦN ĐÁNH GIÁ  ---
    ratings: [
        {
            userId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            stars: {
                type: Number,
                min: [1, 'Số sao phải từ 1 đến 5.'],
                max: [5, 'Số sao phải từ 1 đến 5.'],
                required: [true, 'Số sao đánh giá là bắt buộc.']
            },
            comment: {
                type: String,
                trim: true,
                maxlength: [300, 'Bình luận không được quá 300 ký tự.']
            },
            createdAt: {
                type: Date,
                default: Date.now
            },
            //  Trường xác thực đã mua hàng
            isVerifiedPurchase: {
                type: Boolean,
                default: false 
            }
        }
    ],
    createdBy: { // Người thêm sản phẩm (Admin hoặc Nhân viên)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);