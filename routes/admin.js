//routes/admin.js

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/user');
const { isLoggedIn, isAdmin, isAdminOrEmployee } = require('../middlewares/auth'); // Middleware mới
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình Multer cho ảnh sản phẩm
const productStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './public/images/products'; // Thư mục mới
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const productUpload = multer({ storage: productStorage });

// --- TRANG ADMIN CHÍNH (LAYOUT) ---
// Cả Admin và Nhân viên đều có thể truy cập
router.get('/', isLoggedIn, isAdminOrEmployee, async (req, res) => {
    try {
        // Nhân viên vào thẳng trang đơn hàng nếu không có query
        if (req.session.role === 'employee' && !req.query.page) {
            return res.redirect('/admin?page=orders');
        }
        
        const page = req.query.page || 'statistics'; // Trang mặc định cho Admin
        const categories = await Category.find({}).lean();
        
        let locals = {
            title: 'Trang Quản Trị',
            currentPage: page,
            username: req.session.username,
            userRole: req.session.role, //
            CONFIG: { // Gửi CONFIG mới
                CATEGORIES: categories
            }
        };

        let bodyPartial;
        
        // Phân quyền xem trang
        if (page === 'statistics' && req.session.role === 'admin') {
            bodyPartial = 'statistics';
            // Logic thống kê mới (theo đề cương)
            const totalProducts = await Product.countDocuments();
            const totalCustomers = await User.countDocuments({ role: 'customer' });
            const totalOrders = await Order.countDocuments();
            
            const revenueAgg = await Order.aggregate([
                { $match: { status: 'Hoàn thành' } },
                { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
            ]);
            
            locals.statsData = {
                totalProducts,
                totalCustomers,
                totalOrders,
                totalRevenue: revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0
            };

        } else if (page === 'products') { // Admin & Employee
            bodyPartial = 'products'; // Trang quản lý sản phẩm
        } else if (page === 'categories' && req.session.role === 'admin') { // Chỉ Admin
            bodyPartial = 'categories'; // Trang quản lý danh mục
        } else if (page === 'orders') { // Admin & Employee
            bodyPartial = 'orders'; // Trang quản lý đơn hàng
        } else if (page === 'employees' && req.session.role === 'admin') { // Chỉ Admin
            bodyPartial = 'employees'; // Trang quản lý nhân viên
        } else {
            // Nếu không có quyền hoặc trang không tồn tại
            if (req.session.role === 'employee') {
                return res.redirect('/admin?page=orders');
            }
            return res.redirect('/admin?page=statistics');
        }

        locals.bodyPartial = bodyPartial;
        res.render('admin/layout', locals); // Dùng layout admin cũ
    } catch (error) {
        console.error('Lỗi khi tải trang admin:', error);
        res.status(500).send('Lỗi Server.');
    }
});


// --- CÁC API CHO ADMIN & EMPLOYEE ---

// === QUẢN LÝ SẢN PHẨM ===

// API: Lấy danh sách sản phẩm (Hỗ trợ tìm kiếm cho Nhân viên/Admin)
router.get('/api/products', isLoggedIn, isAdminOrEmployee, async (req, res) => {
    try {
        let filter = {};
        const { q } = req.query; // Lấy tham số tìm kiếm 'q'
        
        if (q) {
            filter.name = { $regex: q, $options: 'i' }; // Tìm theo tên
        }

        const products = await Product.find(filter) // Áp dụng bộ lọc
                                .populate('category', 'name')
                                .populate('createdBy', 'username')
                                .sort({ createdAt: -1 })
                                .lean();
        res.json({ success: true, products });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Thêm sản phẩm mới (Admin & Employee)
router.post('/api/products/add', isLoggedIn, isAdminOrEmployee, productUpload.single('image'), async (req, res) => {
    try {
        // variants là một JSON string: [{"name": "Loại 1", "price": 100, "unit": "kg"}]
        const { name, description, category, variants } = req.body;
        
        if (!name || !description || !category || !variants || !req.file) {
            if (req.file) fs.unlink(req.file.path, () => {});
            return res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin.' });
        }

        const newProduct = new Product({
            name,
            description,
            category,
            image: '/images/products/' + req.file.filename,
            variants: JSON.parse(variants), // Chuyển chuỗi JSON thành mảng
            createdBy: req.session.userId
        });
        await newProduct.save();
        res.json({ success: true, message: 'Thêm sản phẩm thành công!' });
    } catch (error) {
        if (req.file) fs.unlink(req.file.path, () => {});
        console.error('Lỗi thêm sản phẩm:', error);
        if (error.code === 11000) {
             return res.status(400).json({ success: false, message: 'Tên sản phẩm đã tồn tại.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Lấy chi tiết 1 sản phẩm (cho modal sửa)
router.get('/api/products/:id', isLoggedIn, isAdminOrEmployee, async (req, res) => {
     try {
        const product = await Product.findById(req.params.id).lean();
        if (!product) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        }
        res.json({ success: true, product });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Sửa sản phẩm (Admin & Employee)
router.post('/api/products/edit/:id', isLoggedIn, isAdminOrEmployee, productUpload.single('image'), async (req, res) => {
    try {
        const { name, description, category, variants } = req.body;
        const updates = {
            name,
            description,
            category,
            variants: JSON.parse(variants)
        };

        if (req.file) {
            updates.image = '/images/products/' + req.file.filename;
            // (Cần logic xóa ảnh cũ)
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        }
        res.json({ success: true, message: 'Cập nhật thành công!' });
    } catch (error) {
        console.error('Lỗi sửa sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Xóa sản phẩm (chỉ Admin)
router.delete('/api/products/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        }
        // (Cần logic xóa ảnh)
        res.json({ success: true, message: 'Xóa sản phẩm thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});


// === QUẢN LÝ ĐƠN HÀNG (Admin & Employee) ===

// API: Lấy danh sách đơn hàng (Hỗ trợ tìm kiếm)
router.get('/api/orders', isLoggedIn, isAdminOrEmployee, async (req, res) => {
    try {
        let filter = {};
        const { q, status } = req.query; // Lấy tham số tìm kiếm 'q' và lọc 'status'

        if (status && status !== 'all') {
            filter.status = status; // Lọc theo trạng thái
        }
        
        if (q) {
            // Tìm kiếm theo tên hoặc SĐT của khách hàng
            filter['shippingAddress.phone'] = { $regex: q, $options: 'i' };
            // (Bạn có thể mở rộng để tìm theo tên, email...)
        }

        const orders = await Order.find(filter) // Áp dụng bộ lọc
            .populate('customer', 'username email')
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, orders });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Cập nhật trạng thái đơn hàng
router.post('/api/orders/:id/status', isLoggedIn, isAdminOrEmployee, async (req, res) => {
    try {
        const { status } = req.body;
        // Nhân viên không được phép HỦY hoặc HOÀN TRẢ đơn
        if (req.session.role === 'employee' && (status === 'Đã hủy' || status === 'Hoàn trả')) {
             return res.status(403).json({ success: false, message: 'Bạn không có quyền hủy đơn.' });
        }
        
        const updatedOrder = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
        }
        res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});


// === QUẢN LÝ DANH MỤC (Chỉ Admin) ===

router.get('/api/categories', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const categories = await Category.find({}).lean();
        res.json({ success: true, categories });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

router.post('/api/categories/add', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { name, description } = req.body;
        const newCategory = new Category({ name, description });
        await newCategory.save();
        res.json({ success: true, message: 'Thêm danh mục thành công!' });
    } catch (error) {
         if (error.code === 11000) {
             return res.status(400).json({ success: false, message: 'Tên danh mục đã tồn tại.' });
        }
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// (Thêm API cho Sửa/Xóa Category tại đây)


// === QUẢN LÝ NGƯỜI DÙNG (Chỉ Admin) ===

// API: Lấy danh sách Người dùng (Khách hàng & Nhân viên)
router.get('/api/users', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { q, role } = req.query;
        let filter = { role: { $ne: 'admin' } }; // Luôn loại trừ Admin

        if (q) {
            filter.$or = [
                { username: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } }
            ];
        }
        if (role && role !== 'all') {
            filter.role = role;
        }

        const users = await User.find(filter).select('-password').sort({ createdAt: -1 }).lean();
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Tạo tài khoản Nhân viên
router.post('/api/users/add-employee', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { username, password, email } = req.body;
        
        const userExist = await User.findOne({ $or: [{ username }, { email }] });
        if (userExist) {
            return res.status(400).json({ success: false, message: 'Tên người dùng hoặc email đã tồn tại.' });
        }

        const newEmployee = new User({
            username,
            password, // Model sẽ tự hash
            email,
            role: 'employee' //
        });
        await newEmployee.save();
        res.json({ success: true, message: 'Tạo tài khoản nhân viên thành công!' });
    } catch (error) {
        console.error('Lỗi tạo nhân viên:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Xóa/Khóa tài khoản
router.delete('/api/users/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role === 'admin') {
             return res.status(403).json({ success: false, message: 'Không thể xóa tài khoản này.' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Xóa người dùng thành công.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API: Xóa đánh giá (Admin)
router.delete('/api/products/:productId/ratings/:ratingId', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { productId, ratingId } = req.params;
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        }
        product.ratings.pull(ratingId); // Xóa sub-document
        await product.save();
        res.json({ success: true, message: 'Xóa đánh giá thành công.' });
    } catch (error) {
         res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

module.exports = router;