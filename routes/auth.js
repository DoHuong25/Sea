//routes/auth.js

const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user'); 
const router = express.Router();

// Hiển thị form đăng ký
router.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// Xử lý đăng ký (chỉ cho 'customer')
router.post('/register', async (req, res) => {
    // Lấy thêm các trường thông tin cá nhân mới
    const { username, password, email, phone, address } = req.body;
    try {
        const userExist = await User.findOne({ $or: [{ username }, { email }] });
        if (userExist) {
            return res.render('register', { error: 'Tên người dùng hoặc email đã tồn tại.' });
        }

        // Tạo người dùng mới với vai trò 'customer'
        // Mật khẩu sẽ được hash tự động bởi pre-save hook trong model 'user.js' mới
        const newUser = new User({
            username,
            password, // Truyền thẳng password, model sẽ tự hash
            email,
            phone,
            address,
            role: 'customer' // Chỉ định rõ vai trò
        });

        await newUser.save();
        res.redirect('/login');
    } catch (error) {
        console.error('Lỗi khi đăng ký:', error);
        res.render('register', { error: 'Đã có lỗi xảy ra khi đăng ký.' });
    }
});

// Hiển thị form đăng nhập
router.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// Xử lý đăng nhập
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu.' });
        }

        // So sánh mật khẩu
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu.' });
        }

        // Lưu thông tin vào session
        req.session.userId = user._id;
        req.session.username = user.username;
        req.session.role = user.role;

        // PHÂN LUỒNG 3 VAI TRÒ
        if (user.role === 'admin') {
            res.redirect('/admin');
        } else if (user.role === 'employee') {
            // Nhân viên vào thẳng trang quản lý đơn hàng
            res.redirect('/admin?page=orders');
        } else {
            // Khách hàng về trang chủ (hoặc trang họ đang xem)
            const returnTo = req.session.returnTo || '/';
            delete req.session.returnTo;
            res.redirect(returnTo);
        }
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        res.status(500).send('Lỗi server.');
    }
});

// Đăng xuất
router.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Lỗi đăng xuất:', err);
            return res.status(500).send('Lỗi khi đăng xuất');
        }
        res.redirect('/login');
    });
});

module.exports = router;