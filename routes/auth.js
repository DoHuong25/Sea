const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/user'); // 
const router = express.Router(); // 

// Hiển thị form đăng ký
router.get('/register', (req, res) => { // 
    res.render('register', { error: null }); // 
});

// Xử lý đăng ký
router.post('/register', async (req, res) => { // 
    const { username, password } = req.body;
    try {
        const userExist = await User.findOne({ username }); // 
        if (userExist) { // 
            return res.render('register', { error: 'Tên người dùng đã tồn tại. Vui lòng chọn tên khác.' }); // 
        }

        const hashedPassword = await bcrypt.hash(password, 10); // 
        const newUser = new User({ username, password: hashedPassword }); // 
        await newUser.save(); // 
        res.redirect('/login'); // 
    } catch (error) {
        console.error('Lỗi khi đăng ký:', error); // 
        res.render('register', { error: 'Đã có lỗi xảy ra khi đăng ký.' }); // 
    }
});

// Hiển thị form đăng nhập
router.get('/login', (req, res) => { // 
    res.render('login', { error: null }); // 
});

// Xử lý đăng nhập
router.post('/login', async (req, res) => { // 
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username }); // 
        if (!user) { // 
            return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu.' });
        }

        const match = await bcrypt.compare(password, user.password); // 
        if (!match) { // 
            return res.render('login', { error: 'Sai tài khoản hoặc mật khẩu.' });
        }

        req.session.userId = user._id; // 
        req.session.username = user.username;
        req.session.role = user.role; // 

        if (user.role === 'admin') { // 
            res.redirect('/admin'); // 
        } else { // 
            res.redirect('/'); // 
        }
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        res.status(500).send('Lỗi server.');
    }
});

// Đăng xuất
router.get('/logout', (req, res) => { // 
    req.session.destroy(err => { // 
        if (err) { // 
            console.error('Lỗi đăng xuất:', err);
            return res.status(500).send('Lỗi khi đăng xuất'); // 
        }
        res.redirect('/login'); // 
    });
});

module.exports = router; //