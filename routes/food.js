const express = require('express');
const router = express.Router();
const Food = require('../models/Food');
const User = require('../models/user');
// Đảm bảo các middleware này đã được định nghĩa và import đúng
// (isLoggedIn để kiểm tra đăng nhập, isAdmin nếu có vai trò quản trị viên)
const { isLoggedIn, isAdmin } = require('../middlewares/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Thư viện để làm việc với hệ thống file (xóa ảnh)

// --- CẤU HÌNH & BIẾN TOÀN CỤC ---

const ITEMS_PER_PAGE = 8; // Số lượng món ăn mỗi trang cho phân trang
const FEATURED_FOOD_COUNT = 6; // Số lượng món ăn nổi bật trên trang chủ

// Cấu hình Multer để xử lý tải lên file
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = './public/images'; // Thư mục mặc định cho ảnh món ăn
        if (file.fieldname === 'avatar') {
            dir = './public/images/avatars'; // Thư mục cho ảnh đại diện
        }
        // Tạo thư mục nếu nó chưa tồn tại
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Tạo tên file duy nhất bằng timestamp và giữ nguyên đuôi file gốc
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage }); // Middleware Multer sử dụng cấu hình trên

// Dữ liệu tĩnh cho các vùng miền và danh mục
const REGIONS = {
    "Miền Bắc": ["Hà Nội", "Hải Phòng", "Hải Dương", "Hưng Yên", "Vĩnh Phúc", "Bắc Ninh", "Thái Bình", "Nam Định", "Ninh Bình", "Quảng Ninh", "Phú Thọ", "Tuyên Quang", "Lào Cai", "Yên Bái", "Lai Châu", "Sơn La", "Hòa Bình", "Cao Bằng", "Bắc Kạn", "Lạng Sơn", "Thái Nguyên", "Bắc Giang", "Điện Biên", "Hà Giang"],
    "Miền Trung": ["Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Thừa Thiên Huế", "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa", "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"],
    "Miền Nam": ["TP Hồ Chí Minh", "Bình Phước", "Bình Dương", "Đồng Nai", "Tây Ninh", "Bà Rịa – Vũng Tàu", "Long An", "Tiền Giang", "Bến Tre", "Trà Vinh", "Vĩnh Long", "Đồng Tháp", "An Giang", "Kiên Giang", "Cần Thơ", "Hậu Giang", "Sóc Trăng", "Bạc Liêu", "Cà Mau"]
};
// Lưu ý: SEAFOOD_CATEGORIES định nghĩa ở đây có thể không khớp với enum trong Food.schema.path('category').enumValues
// Tốt nhất là sử dụng Food.schema.path('category').enumValues trực tiếp hoặc đảm bảo chúng nhất quán.
const SEAFOOD_CATEGORIES = ['Tôm', 'Cua', 'Ghẹ', 'Mực', 'Bạch tuộc', 'Cá', 'Bề bề', 'Ốc', 'Sò'];

// Hàm trợ giúp để lấy vùng miền từ tên tỉnh/thành phố
const getRegionFromProvince = (provinceName) => {
    for (const regionKey in REGIONS) {
        if (REGIONS[regionKey].includes(provinceName)) {
            return regionKey;
        }
    }
    return null; // Trả về null nếu không tìm thấy vùng miền
};

// --- CÁC ROUTE HIỂN THỊ TRANG (GET) ---

// Trang chủ
router.get('/', async (req, res) => {
    try {
        // Lấy các món ăn đã được duyệt, tính số sao trung bình và sắp xếp theo đó
        const featuredFoods = await Food.aggregate([
            { $match: { status: 'approved' } }, // Chỉ lấy món ăn đã duyệt
            {
                $addFields: {
                    // Tính trung bình số sao, nếu không có đánh giá thì avgRating là null
                    avgRating: { $avg: "$ratings.stars" }, 
                    totalRatings: { $size: "$ratings" } // Đếm tổng số lượt đánh giá
                }
            },
            // Sắp xếp ưu tiên theo avgRating (giảm dần), sau đó totalRatings (giảm dần), rồi createdAt (giảm dần)
            // Điều này đảm bảo món ăn có rating cao hơn và nhiều lượt đánh giá hơn sẽ lên trước
            { $sort: { avgRating: -1, totalRatings: -1, createdAt: -1 } }, 
            { $limit: FEATURED_FOOD_COUNT }, // Giới hạn số lượng món ăn nổi bật
            {
                $lookup: { // Kết nối với bảng users để lấy thông tin người tạo (nếu cần hiển thị)
                    from: 'users', // Tên collection trong MongoDB
                    localField: 'createdBy', // Trường trong collection Food
                    foreignField: '_id', // Trường trong collection User
                    as: 'createdBy' // Tên trường mới để lưu kết quả lookup
                }
            },
            { $unwind: { path: '$createdBy', preserveNullAndEmptyArrays: true } } // Mở mảng createdBy (nếu có)
        ]);

        res.render('foods/index', {
            title: 'Trang Chủ',
            featuredFoods,
            seafoodCategories: Food.schema.path('category').enumValues, // Lấy enum từ schema Food
            REGIONS,
            currentQuery: req.query,
            isAuthenticated: !!req.session.userId, // Kiểm tra người dùng đã đăng nhập chưa
            username: req.session.username // Tên người dùng nếu đã đăng nhập
        });
    } catch (error) {
        console.error('Lỗi khi tải trang chủ:', error);
        res.status(500).send('Lỗi Server'); // Trả về lỗi server nếu có vấn đề
    }
});

// Trang tất cả món ăn (có bộ lọc và phân trang, sắp xếp theo số sao trung bình)
router.get('/all-foods', async (req, res) => {
    try {
        let { category, region, province, page = 1, q } = req.query;
        const skip = (page - 1) * ITEMS_PER_PAGE;
        
        let matchStage = { status: 'approved' }; // Chỉ lấy món ăn đã duyệt

        if (q) matchStage.name = { $regex: q, $options: 'i' }; // Tìm kiếm theo tên (không phân biệt hoa thường)
        if (province) matchStage.province = { $regex: province, $options: 'i' }; // Lọc theo tỉnh/thành phố
        
        if (category) {
            const categories = Array.isArray(category) ? category : [category];
            matchStage.category = { $in: categories }; // Lọc theo danh mục (hỗ trợ nhiều danh mục)
        }
        // Nếu chỉ có vùng miền được chọn mà không có tỉnh/thành phố cụ thể, lọc tất cả tỉnh thuộc vùng đó
        if (region && !province) {
            const regionsToFilter = Array.isArray(region) ? region : [region];
            const provincesInRegions = regionsToFilter.flatMap(r => REGIONS[r] || []);
            if (provincesInRegions.length > 0) {
                matchStage.province = { $in: provincesInRegions };
            }
        }

        const pipeline = [
            { $match: matchStage }, // Giai đoạn lọc ban đầu
            {
                $addFields: {
                    avgRating: { $avg: "$ratings.stars" },
                    totalRatings: { $size: "$ratings" }
                }
            },
            // Sắp xếp ưu tiên theo avgRating (giảm dần), sau đó totalRatings (giảm dần), rồi createdAt (giảm dần)
            { $sort: { avgRating: -1, totalRatings: -1, createdAt: -1 } },
            { $skip: skip },
            { $limit: ITEMS_PER_PAGE }
        ];

        // Pipeline để đếm tổng số món ăn (không giới hạn và bỏ qua)
        const countPipeline = [
            { $match: matchStage },
            { $count: 'total' }
        ];

        // Thực hiện cả hai pipeline song song
        const [foods, totalFoodsResult] = await Promise.all([
            Food.aggregate(pipeline),
            Food.aggregate(countPipeline)
        ]);

        const totalFoods = totalFoodsResult.length > 0 ? totalFoodsResult[0].total : 0;

        // Tạo chuỗi truy vấn cho phân trang (loại bỏ 'page' hiện tại)
        const queryParamsForPagination = { ...req.query };
        delete queryParamsForPagination.page;
        const queryString = new URLSearchParams(queryParamsForPagination).toString();

        res.render('foods/all-foods', {
            title: 'Tất Cả Món Ăn',
            foods,
            totalFoods,
            totalPages: Math.ceil(totalFoods / ITEMS_PER_PAGE), // Tổng số trang
            currentPage: parseInt(page), // Trang hiện tại
            isAuthenticated: !!req.session.userId,
            username: req.session.username,
            currentQuery: req.query,
            REGIONS,
            allProvinces: Object.values(REGIONS).flat().sort(), // Tất cả tỉnh/thành phố để lọc
            seafoodCategories: Food.schema.path('category').enumValues,
            queryString // Chuỗi truy vấn để giữ các bộ lọc khi chuyển trang
        });
    } catch (error) {
        console.error('Lỗi khi tải trang tất cả món ăn:', error);
        res.status(500).send('Lỗi Server');
    }
});

// Trang tạo món ăn mới
router.get('/foods/new', isLoggedIn, (req, res) => {
    res.render('foods/new-food', {
        title: 'Đăng Món Ăn Mới',
        seafoodCategories: Food.schema.path('category').enumValues,
        provinces: Object.values(REGIONS).flat().sort(), // Truyền danh sách tỉnh/thành phố
        isAuthenticated: true,
        username: req.session.username
    });
});

// Trang chi tiết món ăn
router.get('/foods/:id', async (req, res) => {
    try {
        const food = await Food.findById(req.params.id)
                               .populate('createdBy', 'username avatar') // Lấy thông tin người tạo
                               .populate('ratings.userId', 'username avatar') // Lấy thông tin người đánh giá
                               .lean();
        if (!food) return res.status(404).send('Không tìm thấy món ăn');

        res.render('foods/details', {
            title: food.name,
            food,
            isAuthenticated: !!req.session.userId,
            username: req.session.username,
            currentUserId: req.session.userId 
        });
    } catch (error) {
        console.error('Lỗi khi xem chi tiết món ăn:', error);
        res.status(500).send('Lỗi Server');
    }
});

// SỬA LỖI LOGIC TRUY VẤN ĐÁNH GIÁ (cho trang hồ sơ người dùng)
router.get('/profile', isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findById(userId).lean();
        if (!user) {
            req.session.destroy(() => res.redirect('/login')); // Nếu không tìm thấy user, hủy session và chuyển hướng
            return;
        }

        const userFoods = await Food.find({ createdBy: userId }).sort({ createdAt: -1 }).lean();
        
        // Lấy các món ăn mà người dùng này đã đánh giá
        const ratedFoods = await Food.find({ 'ratings.userId': userId }).lean();
        
        // Xử lý lại để chỉ lấy đúng thông tin cần thiết về đánh giá
        const myProcessedRatings = ratedFoods.map(food => {
            // SỬA LỖI: So sánh 2 chuỗi string của userId để đảm bảo khớp
            const userRating = food.ratings.find(r => r.userId.toString() === userId.toString());
            if (userRating) {
                return {
                    foodId: food._id,
                    foodName: food.name,
                    stars: userRating.stars,
                    comment: userRating.comment
                };
            }
            return null;
        }).filter(Boolean); // Lọc bỏ những kết quả null (những món ăn mà người dùng không đánh giá)

        res.render('foods/profile', {
            title: 'Hồ Sơ Của Tôi',
            user,
            userFoods,
            userRatings: myProcessedRatings, // Truyền danh sách đánh giá đã được xử lý vào view
            seafoodCategories: Food.schema.path('category').enumValues,
            provinces: Object.values(REGIONS).flat().sort(),
            isAuthenticated: true,
            username: req.session.username
        });
    } catch (error) {
        console.error('Lỗi khi tải trang hồ sơ:', error);
        res.status(500).send('Lỗi Server');
    }
});


// --- CÁC ROUTE XỬ LÝ DỮ LIỆU & API ---

// API để đăng món ăn mới
router.post('/foods', isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        // Lấy dữ liệu từ body của request
        let { name, description, category, otherCategoryName, province, suggestedAt } = req.body;
        
        // Lấy 'region' từ 'province' đã chọn bằng hàm trợ giúp
        const region = getRegionFromProvince(province);

        // 1. Kiểm tra sự tồn tại của các trường bắt buộc (Tên, Danh mục, Vùng miền, Tỉnh/TP)
        if (!name || !category || !region || !province) {
            // Nếu có file được upload và xảy ra lỗi validation, xóa file đó
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Lỗi xóa ảnh do validation thất bại:", err);
                });
            }
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các trường bắt buộc (Tên, Danh mục, Vùng miền, Tỉnh/TP).' });
        }

        // 2. Kiểm tra nếu danh mục là 'Các loại khác' mà 'otherCategoryName' trống
        if (category === 'Các loại khác' && (!otherCategoryName || otherCategoryName.trim() === '')) {
            if (req.file) {
                fs.unlink(req.file.path, (err) => {
                    if (err) console.error("Lỗi xóa ảnh do otherCategoryName trống:", err);
                });
            }
            return res.status(400).json({ success: false, message: 'Vui lòng nhập tên loại hải sản cụ thể khi chọn "Các loại khác".' });
        }

        // 3. Kiểm tra xem có file ảnh được tải lên không
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Vui lòng tải lên ảnh minh họa.' });
        }

        // 4. Tạo đối tượng món ăn mới
        const newFood = new Food({
            name,
            description,
            category: category,
            // Chỉ lưu otherCategoryName nếu category là 'Các loại khác', ngược lại là chuỗi rỗng
            otherCategoryName: category === 'Các loại khác' ? otherCategoryName.trim() : '', 
            region, // Sử dụng vùng miền đã được xác định
            province,
            suggestedAt: suggestedAt || '', // Lưu 'suggestedAt', mặc định là chuỗi rỗng nếu không có
            image: '/images/' + req.file.filename, // Đường dẫn ảnh đã lưu
            createdBy: req.session.userId, // ID của người tạo (từ session)
            status: 'pending' // Mặc định là 'pending' cho người dùng thường đăng
        });

        await newFood.save(); // Lưu món ăn vào database
        console.log('Người dùng đã đăng món ăn:', newFood.name);
        res.status(200).json({ success: true, message: 'Đăng món ăn thành công, chờ duyệt.' });

    } catch (error) {
        console.error('Lỗi khi người dùng đăng món ăn:', error);

        // Xóa file đã upload nếu có lỗi xảy ra sau khi upload thành công nhưng trước khi lưu database
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkError) => {
                if (unlinkError) console.error('Lỗi khi xóa ảnh đã upload do lỗi server:', unlinkError);
            });
        }

        // Kiểm tra lỗi trùng lặp tên món ăn (Mongoose error code 11000)
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
             return res.status(400).json({ success: false, message: 'Tên món ăn này đã tồn tại, vui lòng chọn tên khác.' });
        }

        // Lỗi validation của Mongoose (ví dụ: trường required bị thiếu, enum không khớp)
        if (error.name === 'ValidationError') {
            let messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }

        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});


// API để đánh giá món ăn
router.post('/foods/:id/rate', isLoggedIn, async (req, res) => {
    try {
        const { stars, comment } = req.body;
        const foodId = req.params.id;
        const userId = req.session.userId;

        const food = await Food.findById(foodId);
        if (!food) {
            return res.status(404).send('Không tìm thấy món ăn');
        }

        const existingRatingIndex = food.ratings.findIndex(r => r.userId.toString() === userId.toString());

        if (existingRatingIndex > -1) {
            // Cập nhật đánh giá đã tồn tại
            food.ratings[existingRatingIndex].stars = stars;
            food.ratings[existingRatingIndex].comment = comment;
            food.ratings[existingRatingIndex].createdAt = new Date();
        } else {
            // Thêm đánh giá mới
            food.ratings.push({ userId: userId, stars: stars, comment: comment, createdAt: new Date() });
        }
        
        // Đánh dấu rằng mảng 'ratings' đã bị thay đổi
        food.markModified('ratings'); 
        
        // Lưu tài liệu mà không chạy toàn bộ validator của schema chính
        // Điều này ngăn Mongoose xác thực lại các trường không liên quan như 'region'
        await food.save({ validateBeforeSave: false }); 
        
        res.redirect(`/foods/${foodId}`);
    } catch (error) {
        console.error('Lỗi khi đánh giá món ăn:', error);
        if (error.name === 'ValidationError') {
            let messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).send('Lỗi đánh giá: ' + messages.join(', '));
        }
        res.status(500).send('Lỗi Server khi đánh giá món ăn');
    }
});

// API để lấy chi tiết món ăn (thường dùng cho chức năng chỉnh sửa)
router.get('/api/foods/:id', isLoggedIn, async (req, res) => {
    try {
        const food = await Food.findById(req.params.id).lean();
        // Xóa bỏ kiểm tra createdBy ở đây. API này được sử dụng cho form chỉnh sửa.
        // Frontend nên chỉ cho phép chỉnh sửa nếu người dùng là người tạo.
        // Người dùng admin có thể xem tất cả các món ăn, vì vậy kiểm tra này có thể quá hạn chế.
        if (!food) {
            return res.status(404).json({ message: 'Không tìm thấy món ăn.' });
        }
        res.json(food);
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu món ăn qua API:', error);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

// API để cập nhật món ăn (Đã sửa đổi để cho phép người dùng chỉnh sửa món đã duyệt và giữ nguyên trạng thái)
router.put('/foods/:id', isLoggedIn, upload.single('image'), async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        // Xác định người tạo và vai trò admin
        const isCreator = food.createdBy.toString() === req.session.userId.toString();
        const isAdminUser = req.user && req.user.role === 'admin'; 
        
        // Kiểm tra quyền: Chỉ cho phép chỉnh sửa nếu là người tạo HOẶC là admin
        if (!food || (!isCreator && !isAdminUser)) {
            return res.status(403).json({ success: false, message: 'Hành động không được phép.' });
        }
        
        // Lấy các trường từ body request
        let { name, description, category, otherCategoryName, province, suggestedAt, status: newStatusFromReqBody } = req.body;
        
        // Tạo đối tượng cập nhật
        const updates = { 
            name, 
            description, 
            category, 
            province, 
            suggestedAt: suggestedAt || '' 
        };

        // Xử lý 'otherCategoryName' nếu danh mục là 'Các loại khác'
        updates.otherCategoryName = category === 'Các loại khác' ? otherCategoryName.trim() : '';

        // Xác định vùng miền từ tỉnh/thành phố
        updates.region = getRegionFromProvince(province); 

        // --- Logic xử lý trạng thái (status) ---
        // Nếu người dùng là admin và có gửi 'status' trong request body, cập nhật status theo body.
        // Nếu không phải admin, status của món ăn sẽ được giữ nguyên, không thay đổi (ngay cả khi gửi trong body)
        // Điều này ngăn người dùng thông thường tự chuyển món ăn đã duyệt về trạng thái chờ duyệt.
        if (isAdminUser && newStatusFromReqBody) {
            updates.status = newStatusFromReqBody;
        } else {
            // Đối với người dùng thông thường, giữ nguyên trạng thái hiện tại của món ăn
            updates.status = food.status; 
        }

        // Xử lý tải lên ảnh
        if (req.file) {
            // Xóa ảnh cũ nếu nó không phải là ảnh mặc định
            if (food.image && food.image !== '/images/default-food.png') {
                fs.unlink(path.join(__dirname, '../public', food.image), err => {
                    if (err && err.code !== 'ENOENT') console.error("Lỗi xóa ảnh cũ:", err);
                });
            }
            updates.image = '/images/' + req.file.filename; // Cập nhật đường dẫn ảnh mới
        }

        // Tìm và cập nhật món ăn trong database, chạy validator schema
        // `runValidators: true` sẽ xác thực các trường được cập nhật dựa trên Food Schema.
        const updatedFood = await Food.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!updatedFood) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn để cập nhật.' });
        
        res.json({ success: true, updatedFood: updatedFood, message: 'Cập nhật món ăn thành công!' });

    } catch (error) {
        console.error('Lỗi khi cập nhật món ăn:', error);

        // Xóa file đã upload nếu có lỗi xảy ra sau khi upload thành công
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, (unlinkError) => {
                if (unlinkError) console.error('Lỗi khi xóa ảnh đã upload do lỗi server (chỉnh sửa):', unlinkError);
            });
        }
         // Kiểm tra lỗi trùng lặp tên món ăn
        if (error.code === 11000 && error.keyPattern && error.keyPattern.name) {
             return res.status(400).json({ success: false, message: 'Tên món ăn này đã tồn tại, vui lòng chọn tên khác.' });
        }

        // Lỗi validation của Mongoose
        if (error.name === 'ValidationError') {
            let messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Lỗi Server' });
    }
});

// API để xóa món ăn
router.delete('/foods/:id', isLoggedIn, async (req, res) => {
    try {
        const food = await Food.findById(req.params.id);
        const isCreator = food.createdBy.toString() === req.session.userId.toString();
        const isAdminUser = req.user && req.user.role === 'admin';

        // Chỉ cho phép người tạo hoặc admin xóa món ăn
        if (!food || (!isCreator && !isAdminUser)) { 
            return res.status(403).send('Hành động không được phép.');
        }

        // Xóa ảnh của món ăn khỏi server nếu nó không phải ảnh mặc định
        if (food.image && food.image !== '/images/default-food.png') {
            fs.unlink(path.join(__dirname, '../public', food.image), err => {
                if (err && err.code !== 'ENOENT') console.error("Lỗi xóa ảnh:", err);
            });
        }
        await Food.findByIdAndDelete(req.params.id); // Xóa món ăn khỏi database
        res.json({ success: true, message: 'Món ăn đã được xóa.' }); // Trả về JSON để frontend xử lý
    } catch (error) {
        console.error('Lỗi khi xóa món ăn:', error);
        res.status(500).json({ success: false, message: 'Lỗi Server' }); // Trả về JSON lỗi
    }
});

// API để cập nhật hồ sơ người dùng (ví dụ: từ trang hồ sơ người dùng thông thường)
router.post('/profile/edit', isLoggedIn, upload.single('avatar'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const { username, email, bio } = req.body;
        const updates = { username, email, bio };
        if (req.file) {
            updates.avatar = '/images/avatars/' + req.file.filename;
        }
        const updatedUser = await User.findByIdAndUpdate(userId, updates, { new: true });
        if (!updatedUser) {
             return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
        }
        // Cập nhật username trong session nếu thay đổi
        req.session.username = updatedUser.username; 
        res.json({ success: true, message: 'Cập nhật thành công!', user: updatedUser });
    } catch (error) {
        console.error('Lỗi khi cập nhật hồ sơ:', error);
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

module.exports = router;
