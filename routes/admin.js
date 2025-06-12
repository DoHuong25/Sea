const express = require('express');
const router = express.Router();
const Food = require('../models/Food'); // Import Food model
const User = require('../models/user'); // Import User model
const { isLoggedIn, isAdmin } = require('../middlewares/auth'); // Đảm bảo các middleware này đã được import và định nghĩa đúng
const multer = require('multer'); // Import multer cho xử lý file upload trong admin routes
const path = require('path');
const fs = require('fs');

// Cấu hình các vùng miền và tỉnh/thành phố
const REGIONS_DATA = {
    "Bắc": [
        "Hà Nội", "Hải Phòng", "Hải Dương", "Hưng Yên", "Vĩnh Phúc", "Bắc Ninh",
        "Thái Bình", "Nam Định", "Ninh Bình", "Quảng Ninh", "Phú Thọ", "Tuyên Quang",
        "Lào Cai", "Yên Bái", "Lai Châu", "Sơn La", "Hòa Bình", "Cao Bằng", "Bắc Kạn",
        "Lạng Sơn", "Thái Nguyên", "Bắc Giang", "Điện Biên", "Hà Giang"
    ],
    "Trung": [
        "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Thừa Thiên Huế",
        "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa",
        "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"
    ],
    "Nam": [
        "TP Hồ Chí Minh", "Bình Phước", "Bình Dương", "Đồng Nai", "Tây Ninh", "Bà Rịa – Vũng Tàu",
        "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", "Đồng Tháp",
        "An Giang", "Kiên Giang", "Cần Thơ", "Hậu Giang", "Sóc Trăng", "Bạc Liêu",
        "Cà Mau"
    ]
};

// Hàm lấy tất cả tỉnh thành hoặc theo vùng miền
const getProvincesByRegion = (region) => {
    if (region && REGIONS_DATA[region]) {
        return REGIONS_DATA[region];
    }
    let allProvinces = [];
    for (const reg in REGIONS_DATA) {
        allProvinces = allProvinces.concat(REGIONS_DATA[reg]);
    }
    return [...new Set(allProvinces)].sort();
};

// Hàm trợ giúp để lấy vùng miền từ tên tỉnh/thành phố
const getRegionFromProvince = (provinceName) => {
    for (const regionKey in REGIONS_DATA) {
        if (REGIONS_DATA[regionKey].includes(provinceName)) {
            return regionKey;
        }
    }
    return null;
};

// Cấu hình để gửi cho frontend
const CONFIG = {
    CATEGORIES: Food.schema.path('category').enumValues, // Lấy từ enum của Food model
    REGIONS: Object.keys(REGIONS_DATA), // Lấy danh sách vùng miền từ keys của REGIONS_DATA
    PROVINCES: getProvincesByRegion().map(name => ({ name: name, region: getRegionFromProvince(name) })) // Gửi cả tên và vùng miền
};


// Route chính cho trang quản trị Admin
// Đảm bảo chỉ người dùng đã đăng nhập VÀ có vai trò admin mới có thể truy cập
router.get('/', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const page = req.query.page || 'statistics'; // Trang mặc định là 'statistics'
        let locals = {
            title: 'Trang Quản Trị',
            currentPage: page,
            username: req.session.username, // Lấy username từ session
            user: req.user, // Lấy toàn bộ thông tin user từ req (do middleware isAdmin/isLoggedIn thêm vào)
            CONFIG: CONFIG, // Truyền cấu hình danh mục, vùng miền, tỉnh/thành phố cho frontend
            filters: { // Các bộ lọc mặc định cho bảng món ăn/người dùng
                status: req.query.status || 'all',
                category: req.query.category || 'all',
                region: req.query.region || 'all',
                province: req.query.province || 'all',
                name: req.query.q || '', // Lọc theo tên món ăn
                location: req.query.location || '', // Lọc theo vùng miền/tỉnh thành
                role: req.query.userRole || 'all' // Cho user filter
            }
        };

        // Xác định phần nội dung động cần chèn vào layout
        let bodyPartial;
        if (page === 'statistics') {
            bodyPartial = 'statistics'; // Sẽ include views/admin/statistics.ejs
            // Nếu là trang thống kê, fetch dữ liệu thống kê
            const pendingFoods = await Food.countDocuments({ status: 'pending' });
            const totalFoods = await Food.countDocuments();
            const totalUsers = await User.countDocuments();

            // Phân bố món ăn theo danh mục
            const categoryDistribution = await Food.aggregate([
                { $match: { status: 'approved' } }, // Chỉ tính các món đã duyệt
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            // Top món ăn có đánh giá cao nhất (avgRating > 0 và có ít nhất 1 đánh giá)
            const topFoods = await Food.aggregate([
                { $match: { status: 'approved', 'ratings.0': { $exists: true } } }, // Chỉ món đã duyệt và có ít nhất 1 đánh giá
                {
                    $addFields: {
                        avgRating: { $avg: "$ratings.stars" },
                        totalRatings: { $size: "$ratings" }
                    }
                },
                { $sort: { avgRating: -1, totalRatings: -1 } }, // Sắp xếp theo rating và số lượt đánh giá
                { $limit: 5 } // Top 5
            ]);

            // Top người dùng tích cực nhất (đăng nhiều món ăn nhất)
            const topUsers = await Food.aggregate([
                { $match: { status: 'approved' } },
                { $group: { _id: "$createdBy", foodCount: { $sum: 1 } } },
                { $sort: { foodCount: -1 } },
                { $limit: 5 }, // Top 5
                {
                    $lookup: {
                        from: 'users',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'userDetails'
                    }
                },
                { $unwind: '$userDetails' },
                { $project: { _id: 0, username: '$userDetails.username', foodCount: 1 } }
            ]);

            locals.statsData = {
                pendingFoods,
                totalFoods,
                totalUsers,
                categoryDistribution,
                topFoods,
                topUsers
            };
        } else if (page === 'all-foods') {
            bodyPartial = 'foods'; // Sẽ include views/admin/foods.ejs
            // Dữ liệu foods sẽ được fetch qua API bởi frontend sau khi trang được tải
        } else if (page === 'users') {
            bodyPartial = 'users'; // Sẽ include views/admin/users.ejs
            // Dữ liệu users sẽ được fetch qua API bởi frontend sau khi trang được tải
        } else {
            // Fallback nếu page không hợp lệ, có thể chuyển hướng về thống kê hoặc trang lỗi
            return res.redirect('/admin?page=statistics');
        }

        // Truyền tên partial cần include vào locals
        locals.bodyPartial = bodyPartial;

        // Render trang layout chính
        res.render('admin/layout', locals); 
    } catch (error) {
        console.error('Lỗi khi tải trang admin:', error);
        res.status(500).send('Lỗi Server khi tải trang quản trị.');
    }
});

// API để lấy dữ liệu thống kê (dùng cho AJAX)
router.get('/api/dashboard-data', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const pendingFoods = await Food.countDocuments({ status: 'pending' });
        const totalFoods = await Food.countDocuments();
        const totalUsers = await User.countDocuments();

        const categoryDistribution = await Food.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const topFoods = await Food.aggregate([
            { $match: { status: 'approved', 'ratings.0': { $exists: true } } },
            {
                $addFields: {
                    avgRating: { $avg: "$ratings.stars" },
                    totalRatings: { $size: "$ratings" }
                }
            },
            { $sort: { avgRating: -1, totalRatings: -1 } },
            { $limit: 5 }
        ]);

        const topUsers = await Food.aggregate([
            { $match: { status: 'approved' } },
            { $group: { _id: "$createdBy", foodCount: { $sum: 1 } } },
            { $sort: { foodCount: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDetails' } },
            { $unwind: '$userDetails' },
            { $project: { _id: 0, username: '$userDetails.username', foodCount: 1 } }
        ]);

        res.json({
            success: true,
            data: {
                stats: { pendingFoods, totalFoods, totalUsers },
                categoryDistribution,
                topFoods,
                topUsers
            }
        });
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu dashboard API:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy dữ liệu dashboard.' });
    }
});


// API để lấy danh sách món ăn cho trang Admin (có thể lọc)
router.get('/api/foods', isLoggedIn, isAdmin, async (req, res) => {
    try {
        let filter = {};
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        if (req.query.category && req.query.category !== 'all') {
            filter.category = req.query.category;
        }
        if (req.query.region && req.query.region !== 'all') {
            const provincesInRegion = getProvincesByRegion(req.query.region);
            if (provincesInRegion.length > 0) {
                filter.province = { $in: provincesInRegion };
            }
        }
        if (req.query.province && req.query.province !== 'all') {
            filter.province = req.query.province;
        }
        if (req.query.q) { // Tìm kiếm theo tên món ăn
            filter.name = { $regex: req.query.q, $options: 'i' };
        }
        if (req.query.location) { // Tìm kiếm kết hợp theo vùng miền hoặc tỉnh thành
            const searchLocation = req.query.location;
            const allProvinces = getProvincesByRegion(); 
            const matchingProvinces = allProvinces.filter(p => 
                p.toLowerCase().includes(searchLocation.toLowerCase()) || 
                getRegionFromProvince(p)?.toLowerCase().includes(searchLocation.toLowerCase())
            );
            
            if (matchingProvinces.length > 0) {
                filter.province = { $in: matchingProvinces };
            } else {
                return res.json({ success: true, foods: [] });
            }
        }

        const foods = await Food.find(filter)
                                .populate('createdBy', 'username') // Lấy username của người tạo
                                .sort({ createdAt: -1 })
                                .lean();
        res.json({ success: true, foods });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách món ăn API:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách món ăn.' });
    }
});

// API để lấy danh sách người dùng cho trang Admin (có thể lọc)
router.get('/api/users', isLoggedIn, isAdmin, async (req, res) => {
    try {
        let filter = {};
        if (req.query.role && req.query.role !== 'all') {
            filter.role = req.query.role;
        }
        const users = await User.find(filter).sort({ createdAt: -1 }).lean();
        res.json({ success: true, users });
    } catch (error) {
        console.error('Lỗi khi lấy danh sách người dùng API:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách người dùng.' });
    }
});

// API để lấy chi tiết một món ăn theo ID (dùng cho modal chỉnh sửa)
router.get('/api/foods/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const food = await Food.findById(req.params.id).lean();
        if (!food) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
        }
        res.json({ success: true, food });
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết món ăn qua API:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết món ăn.' });
    }
});

// API để lấy chi tiết một người dùng theo ID (dùng cho modal chỉnh sửa)
router.get('/api/users/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).lean();
        if (!user) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }
        res.json({ success: true, user });
    } catch (error) {
        console.error('Lỗi khi lấy chi tiết người dùng qua API:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết người dùng.' });
    }
});


// Các API xử lý hành động (CRUD) - Đảm bảo Multer upload ở đây nếu có file
const adminStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './public/images';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const adminUpload = multer({ storage: adminStorage });

// Thêm món ăn mới (từ admin)
router.post('/foods/add', isLoggedIn, isAdmin, adminUpload.single('image'), async (req, res) => {
    try {
        let { name, description, category, otherCategoryName, province, suggestedAt, status } = req.body;
        const region = getRegionFromProvince(province);

        if (!name || !category || !region || !province || !req.file) {
            if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting incomplete food image:", err); });
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các trường bắt buộc và tải lên ảnh.' });
        }
        if (category === 'Các loại khác' && (!otherCategoryName || otherCategoryName.trim() === '')) {
            if (req.file) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting otherCategoryName image:", err); });
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên loại hải sản cụ thể khi chọn "Các loại khác".' });
        }

        const newFood = new Food({
            name, description, category, province, region, suggestedAt, status,
            otherCategoryName: category === 'Các loại khác' ? otherCategoryName.trim() : '',
            image: '/images/' + req.file.filename,
            createdBy: req.session.userId, // Người tạo là admin đang đăng nhập
        });
        await newFood.save();
        res.json({ success: true, message: 'Món ăn đã được thêm thành công!' });
    } catch (error) {
        console.error('Lỗi khi thêm món ăn:', error);
        if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting food image after add failure:", err); });
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Tên món ăn đã tồn tại.' });
        res.status(500).json({ success: false, message: 'Lỗi server khi thêm món ăn.' });
    }
});

// Chỉnh sửa món ăn
router.post('/foods/edit/:id', isLoggedIn, isAdmin, adminUpload.single('image'), async (req, res) => {
    try {
        const { name, description, category, otherCategoryName, province, suggestedAt, status } = req.body;
        const region = getRegionFromProvince(province);
        const foodId = req.params.id;

        const updates = { name, description, category, province, region, suggestedAt, status };
        updates.otherCategoryName = category === 'Các loại khác' ? otherCategoryName.trim() : '';

        if (req.file) {
            const oldFood = await Food.findById(foodId);
            if (oldFood && oldFood.image && oldFood.image !== '/images/default-food.png') {
                fs.unlink(path.join(__dirname, '../public', oldFood.image), err => {
                    if (err && err.code !== 'ENOENT') console.error("Error deleting old food image:", err);
                });
            }
            updates.image = '/images/' + req.file.filename;
        }

        const updatedFood = await Food.findByIdAndUpdate(foodId, updates, { new: true, runValidators: true });
        if (!updatedFood) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn để cập nhật.' });
        res.json({ success: true, message: 'Món ăn đã được cập nhật thành công!' });
    } catch (error) {
        console.error('Lỗi khi cập nhật món ăn:', error);
        if (req.file && req.file.path) fs.unlink(req.file.path, (err) => { if (err) console.error("Error deleting food image after edit failure:", err); });
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Tên món ăn đã tồn tại.' });
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật món ăn.' });
    }
});

// Duyệt món ăn
router.post('/foods/:id/approve', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const food = await Food.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
        if (!food) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
        res.json({ success: true, message: 'Món ăn đã được duyệt!' });
    } catch (error) {
        console.error('Lỗi khi duyệt món ăn:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi duyệt món ăn.' });
    }
});

// Từ chối (xóa) món ăn chờ duyệt
router.post('/foods/:id/reject', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        if (!food) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });

        if (food.image && food.image !== '/images/default-food.png') {
            fs.unlink(path.join(__dirname, '../public', food.image), err => {
                if (err && err.code !== 'ENOENT') console.error("Error deleting rejected food image:", err);
            });
        }
        await Food.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Món ăn đã bị từ chối và xóa.' });
    } catch (error) {
        console.error('Lỗi khi từ chối món ăn:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi từ chối món ăn.' });
    }
});

// Xóa món ăn đã duyệt (khác với từ chối món chờ duyệt)
router.delete('/foods/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        if (!food) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });

        if (food.image && food.image !== '/images/default-food.png') {
            fs.unlink(path.join(__dirname, '../public', food.image), err => {
                if (err && err.code !== 'ENOENT') console.error("Error deleting approved food image:", err);
            });
        }
        await Food.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Món ăn đã được xóa vĩnh viễn.' });
    } catch (error) {
        console.error('Lỗi khi xóa món ăn:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa món ăn.' });
    }
});

// Thêm người dùng mới (từ admin)
router.post('/users/add', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { username, email, password, role } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ success: false, message: 'Tên người dùng, mật khẩu và vai trò là bắt buộc.' });
        }
        
        // Kiểm tra username hoặc email đã tồn tại chưa
        const existingUser = await User.findOne({ $or: [{ username: username }, { email: email }] });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Tên người dùng hoặc email đã tồn tại.' });
        }

        const newUser = new User({ username, email, password, role }); // Mật khẩu sẽ được hash bởi pre-save hook trong User model
        await newUser.save();
        res.json({ success: true, message: 'Người dùng đã được thêm thành công!' });
    } catch (error) {
        console.error('Lỗi khi thêm người dùng:', error);
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Tên người dùng hoặc email đã tồn tại.' });
        res.status(500).json({ success: false, message: 'Lỗi server khi thêm người dùng.' });
    }
});

// Chỉnh sửa người dùng
router.post('/users/edit/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        const { username, email, password, role } = req.body;
        const updates = { username, email, role };

        if (password) {
            // Nếu có mật khẩu mới, hash nó. Giả sử User model có hook hashing.
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
            user.password = password; // Sẽ kích hoạt pre-save hash hook
            await user.save({ validateBeforeSave: false }); // Chỉ lưu password, không validate lại toàn bộ user
        }
        
        const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true });
        if (!updatedUser) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng để cập nhật.' });
        
        res.json({ success: true, message: 'Người dùng đã được cập nhật thành công!', user: updatedUser });
    } catch (error) {
        console.error('Lỗi khi cập nhật người dùng:', error);
        if (error.code === 11000) return res.status(400).json({ success: false, message: 'Tên người dùng hoặc email đã tồn tại.' });
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật người dùng.' });
    }
});

// Cấp quyền admin
router.post('/users/:id/make-admin', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.id, { role: 'admin' }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        res.json({ success: true, message: `Đã cấp quyền Admin cho ${user.username}.` });
    } catch (error) {
        console.error('Lỗi khi cấp quyền admin:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cấp quyền admin.' });
    }
});

// Xóa người dùng
router.delete('/users/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        // Ngăn không cho admin tự xóa tài khoản của mình
        if (req.params.id === req.session.userId) {
            return res.status(403).json({ success: false, message: 'Bạn không thể xóa tài khoản Admin của chính mình.' });
        }
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        res.json({ success: true, message: `Người dùng ${user.username} đã được xóa.` });
    } catch (error) {
        console.error('Lỗi khi xóa người dùng:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa người dùng.' });
    }
});

// Xóa bình luận món ăn (từ admin)
router.delete('/foods/:foodId/comments/:commentId', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const { foodId, commentId } = req.params;
        const food = await Food.findById(foodId);
        if (!food) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
        }

        // Kéo (pull) bình luận ra khỏi mảng ratings
        food.ratings.pull(commentId); // Mongoose method to remove subdocument by _id
        await food.save({ validateBeforeSave: false }); // Không chạy validator cho toàn bộ food document

        res.json({ success: true, message: 'Bình luận đã được xóa.' });
    } catch (error) {
        console.error('Lỗi khi xóa bình luận:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa bình luận.' });
    }
});


module.exports = router;
