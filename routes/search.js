const express = require('express');
const router = express.Router();
const Food = require('../models/Food');

// Route tìm kiếm (Sẽ chuyển hướng về trang /all-foods với các tham số tìm kiếm)
router.get('/', async (req, res) => {
    try {
        const { q, location, category, page = 1 } = req.query;

        // Nếu không có từ khóa tìm kiếm nào, chuyển hướng về trang tất cả món ăn
        if (!q && !location && !category) {
            return res.redirect('/all-foods');
        }

        // Xây dựng URL chuyển hướng đến /all-foods với tất cả các tham số tìm kiếm/lọc
        let redirectUrl = `/all-foods?`;
        if (q) redirectUrl += `q=${encodeURIComponent(q)}&`;
        if (location) redirectUrl += `location=${encodeURIComponent(location)}&`;
        if (category) redirectUrl += `category=${encodeURIComponent(category)}&`;
        redirectUrl += `page=${page}`;

        return res.redirect(redirectUrl);
    } catch (error) {
        console.error('Lỗi khi tìm kiếm món ăn:', error);
        res.status(500).send('Lỗi server.');
    }
});

module.exports = router;