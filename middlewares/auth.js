// middlewares/auth.js 

module.exports = {
    // Kiểm tra xem người dùng đã đăng nhập chưa
    isLoggedIn: (req, res, next) => {
        if (req.session.userId) {
            return next();
        }
        req.session.returnTo = req.originalUrl; // Lưu lại trang họ muốn vào
        res.redirect('/login');
    },

    // Kiểm tra xem người dùng có phải là Admin không
    isAdmin: (req, res, next) => {
        if (req.session.role === 'admin') {
            return next();
        }
        res.status(403).send('Bạn không có quyền truy cập chức năng này.');
    },

    //  Kiểm tra xem người dùng có phải là Nhân viên không
    isEmployee: (req, res, next) => {
        if (req.session.role === 'employee') {
            return next();
        }
        res.status(403).send('Bạn không có quyền truy cập chức năng này.');
    },

    // Kiểm tra xem người dùng có phải là Admin hoặc Nhân viên không
    isAdminOrEmployee: (req, res, next) => {
        if (req.session.role === 'admin' || req.session.role === 'employee') {
            return next();
        }
        res.status(403).send('Bạn không có quyền truy cập trang này.');
    },

    // Kiểm tra xem người dùng có phải là Khách hàng không
    isCustomer: (req, res, next) => {
        if (req.session.role === 'customer') {
            return next();
        }
        res.redirect('/');
    }
};