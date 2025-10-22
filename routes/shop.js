// routes/shop.js 

const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const User = require('../models/user');
const { isLoggedIn, isCustomer } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Cấu hình Multer cho avatar 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = './public/images/avatars';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- CÁC TRANG CỬA HÀNG (KHÁCH HÀNG) ---

// GET / : Trang chủ & Tìm kiếm sản phẩm 
router.get('/', async (req, res) => {
    try {
        let filter = {};
        const { q, category } = req.query; // Lấy query tìm kiếm
        let currentCategory = 'Tất cả';

        if (q) {
            filter.name = { $regex: q, $options: 'i' };
        }
        if (category) {
            const cat = await Category.findOne({ name: category });
            if (cat) {
                filter.category = cat._id;
                currentCategory = cat.name;
            }
        }

        const products = await Product.find(filter).populate('category').lean();
        const categories = await Category.find({}).lean();
        
        res.render('shop/index', { // Cần tạo view 'shop/index.ejs'
            title: 'Trang chủ',
            products,
            categories,
            currentCategory
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi server');
    }
});

// GET /product/:id : Trang chi tiết sản phẩm (Giữ lại trang chi tiết)
router.get('/product/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category')
            .populate('ratings.userId', 'username avatar') // Lấy thông tin người review
            .lean(); 

        if (!product) {
            return res.status(404).send('Không tìm thấy sản phẩm');
        }

        // Tính toán đánh giá trung bình
        let averageRating = 0;
        if (product.ratings && product.ratings.length > 0) {
            averageRating = product.ratings.reduce((acc, r) => acc + r.stars, 0) / product.ratings.length;
        }

        // Kiểm tra xem user có quyền review không
        let canReview = false;
        let hasReviewed = false;
        if (req.session.userId) {
            // 1. Đã mua hàng và đơn hàng đã "Hoàn thành"?
            const hasPurchased = await Order.findOne({
                customer: req.session.userId,
                'items.product': req.params.id,
                status: 'Hoàn thành'
            });
            // 2. Đã đánh giá sản phẩm này chưa?
            hasReviewed = product.ratings.some(r => r.userId._id.toString() === req.session.userId);
            
            if (hasPurchased && !hasReviewed) {
                canReview = true;
            }
        }

        res.render('shop/detail', { // Cần tạo view 'shop/detail.ejs'
            title: product.name,
            product: product,
            averageRating: averageRating.toFixed(1),
            canReview: canReview,
            hasReviewed: hasReviewed
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi server');
    }
});

// POST /product/:id/rate : Xử lý gửi Đánh giá
router.post('/product/:id/rate', isCustomer, async (req, res) => {
    try {
        const { stars, comment } = req.body;
        const productId = req.params.id;
        const userId = req.session.userId;

        // Xác minh lại quyền review
        const hasPurchased = await Order.findOne({
            customer: userId,
            'items.product': productId,
            status: 'Hoàn thành'
        });

        if (!hasPurchased) {
            return res.status(403).send('Bạn phải mua hàng đã hoàn thành mới được đánh giá.');
        }
        
        const product = await Product.findById(productId);
        const hasReviewed = product.ratings.some(r => r.userId.toString() === userId);
        
        if (hasReviewed) {
            return res.status(400).send('Bạn đã đánh giá sản phẩm này rồi.');
        }

        // Thêm đánh giá mới
        product.ratings.push({ 
            userId: userId, 
            stars: stars, 
            comment: comment, 
            isVerifiedPurchase: true // Đánh dấu đây là đánh giá thật
        });
        
        await product.save();
        res.redirect(`/product/${productId}`);
    } catch (error) {
        console.error('Lỗi khi đánh giá:', error);
        res.redirect(`/product/${productId}`);
    }
});


// --- CÁC TRANG CÁ NHÂN (PROFILE) ---

// GET /profile : HIỂN THỊ TRANG CÁ NHÂN (lấy từ food.js cũ)
router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId).lean();
        if (!user) {
            return res.redirect('/login');
        }

        // LẤY LỊCH SỬ ĐƠN HÀNG
        const orders = await Order.find({ customer: req.session.userId })
                                .populate('items.product', 'name image')
                                .sort({ createdAt: -1 })
                                .lean();
        
        res.render('shop/profile', { // Cần tạo view 'shop/profile.ejs'
            title: 'Trang cá nhân',
            user: user,
            orders: orders // Truyền đơn hàng sang
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi Server');
    }
});

// POST /profile/edit : XỬ LÝ CẬP NHẬT THÔNG TIN (lấy từ food.js cũ)
router.post('/profile/edit', isLoggedIn, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { username, email, phone, address, bio } = req.body;
        
        const updates = { username, email, phone, address, bio };
        const user = await User.findById(userId);

        // Xử lý upload avatar mới
        if (req.file) {
            updates.avatar = '/images/avatars/' + req.file.filename;
            
            if (user.avatar && user.avatar !== '/images/avatars/default-avatar.png') {
                fs.unlink(path.join(__dirname, '../public', user.avatar), err => {
                    if (err && err.code !== 'ENOENT') { 
                        console.error("Lỗi xóa avatar cũ:", err);
                    }
                });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updates, { 
            new: true, 
            runValidators: true 
        });

        if (!updatedUser) {
            return res.status(404).send('Không tìm thấy người dùng');
        }

        req.session.username = updatedUser.username;
        res.redirect('/profile'); 

    } catch (error) {
        console.error('Lỗi khi cập nhật hồ sơ:', error);
        if (error.code === 11000) { // Lỗi trùng lặp
             return res.redirect('/profile');
        }
        res.status(500).send('Lỗi server');
    }
});


// --- CÁC TRANG GIỎ HÀNG & THANH TOÁN ---

// POST /cart/add : Thêm vào giỏ hàng
router.post('/cart/add', isLoggedIn, async (req, res) => {
    const { productId, variantId, quantity } = req.body;
    
    if (!req.session.cart) {
        req.session.cart = { items: [], total: 0 };
    }
    const cart = req.session.cart;

    try {
        const product = await Product.findById(productId);
        const variant = product.variants.id(variantId);

        if (!product || !variant) {
            return res.status(404).send('Sản phẩm không hợp lệ');
        }

        const existingItemIndex = cart.items.findIndex(item => 
            item.product._id.toString() === productId && 
            item.variant._id.toString() === variantId
        );

        const qty = parseFloat(quantity);
        if (!qty || qty <= 0) {
            return res.redirect('back');
        }

        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += qty;
        } else {
            cart.items.push({
                product: { _id: product._id, name: product.name, image: product.image },
                variant: { _id: variant._id, name: variant.name, price: variant.price, unit: variant.unit },
                quantity: qty
            });
        }
        
        cart.total = cart.items.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
        
        res.redirect('/cart');
    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi server');
    }
});

// GET /cart : Trang giỏ hàng
router.get('/cart', (req, res) => {
    const cart = req.session.cart || { items: [], total: 0 };
    res.render('shop/cart', { title: 'Giỏ hàng', cart }); // Cần tạo view 'shop/cart.ejs'
});

// POST /cart/update : Cập nhật số lượng giỏ hàng
router.post('/cart/update', (req, res) => {
    const { itemIndex, quantity } = req.body;
    const cart = req.session.cart;
    const qty = parseFloat(quantity);

    if (cart && cart.items[itemIndex] && qty > 0) {
        cart.items[itemIndex].quantity = qty;
        cart.total = cart.items.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
    }
    res.redirect('/cart');
});

// GET /cart/remove/:itemIndex : Xóa sản phẩm khỏi giỏ hàng
router.get('/cart/remove/:itemIndex', (req, res) => {
    const { itemIndex } = req.params;
    const cart = req.session.cart;

    if (cart && cart.items[itemIndex]) {
        cart.items.splice(itemIndex, 1);
        cart.total = cart.items.reduce((sum, item) => sum + (item.variant.price * item.quantity), 0);
    }
    res.redirect('/cart');
});

// GET /checkout : Trang thanh toán
router.get('/checkout', isCustomer, async (req, res) => {
    const cart = req.session.cart;
    if (!cart || cart.items.length === 0) {
        return res.redirect('/cart');
    }
    const user = await User.findById(req.session.userId).lean();
    res.render('shop/checkout', { title: 'Thanh toán', cart, user }); // Cần tạo view 'shop/checkout.ejs'
});

// POST /checkout : Xử lý Đặt hàng
router.post('/checkout', isCustomer, async (req, res) => {
    const cart = req.session.cart;
    const { name, address, phone, paymentMethod } = req.body;

    if (!cart || cart.items.length === 0) {
        return res.redirect('/cart');
    }

    try {
        const orderItems = cart.items.map(item => ({
            product: item.product._id,
            variant: item.variant, // Lưu trữ thông tin biến thể
            quantity: item.quantity
        }));

        const order = new Order({
            customer: req.session.userId,
            items: orderItems,
            total: cart.total,
            shippingAddress: { name, address, phone },
            paymentMethod: paymentMethod // 'COD' hoặc 'Online'
        });

        await order.save();
        
        req.session.cart = null; // Xóa giỏ hàng
        res.render('shop/order-success', { title: 'Đặt hàng thành công' }); // Cần tạo view 'shop/order-success.ejs'

    } catch (error) {
        console.error(error);
        res.status(500).send('Lỗi khi đặt hàng');
    }
});

module.exports = router;