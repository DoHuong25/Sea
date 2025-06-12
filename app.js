console.log("App.js is starting...");

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const methodOverride = require('method-override');
require('dotenv').config();

const app = express();

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Kết nối MongoDB thành công'))
    .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err)); 

// Middleware cơ bản
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('_method'));

// Thiết lập EJS và thư mục views
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Cấu hình Session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
        maxAge: 1000 * 60 * 60,
        secure: false
    }
}));


// Import các routes
const authRoutes = require('./routes/auth');
const foodRoutes = require('./routes/food');
const adminRoutes = require('./routes/admin');
const searchRoutes = require('./routes/search');

// Mount routes
app.use('/', authRoutes);
app.use('/', foodRoutes);
app.use('/admin', adminRoutes);
app.use('/search', searchRoutes);

// Route test
app.get('/test-admin', (req, res) => {
    res.send(`Route test-admin chạy OK. Đăng nhập: ${req.isLoggedIn}, Admin: ${req.isAdmin}`);
});

// Xử lý 404
app.use((req, res, next) => {
    res.status(404).send('404 - Trang không tìm thấy!');
});

// Global error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('500 - Đã xảy ra lỗi server nội bộ!');
});

// Khởi động server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
    console.log(`Bảng quản trị Admin: http://localhost:${PORT}/admin`);
});