module.exports = {
  isLoggedIn: (req, res, next) => {
    // console.log('➡️ isLoggedIn - Session userId:', req.session.userId); // 
    if (req.session.userId) { // 
      next(); // 
    } else {
      // console.log('➡️ isLoggedIn - Redirecting to /login'); // 
      res.redirect('/login'); // 
    }
  },

  isAdmin: (req, res, next) => {
    // console.log('➡️ isAdmin - Session role:', req.session.role); // 
    if (req.session.role === 'admin') { // 
      next(); // 
    } else {
      // console.log('➡️ isAdmin - Forbidden (403)'); // 
      res.status(403).send('Bạn không có quyền truy cập trang này'); // 
    }
  }
};