// scripts/seaFoods.js
const mongoose = require('mongoose');
const Food = require('../models/Food');
require('dotenv').config();

const foods = [
  {
    name: "Hàu nướng phô mai",
    description: "Hàu béo ngậy, nướng phô mai chảy béo ngậy, thơm ngậy.",
    province: "Quảng Ninh",
    suggestedRestaurant: "Nhà hàng Hải sản Bãi Cháy", // Thêm thông tin nhà hàng
    image: "/images/Hau-nphomai.jpg",
    category: "Ốc", // Thêm category
    status: "approved"
  },
  {
    name: "Bề bề hấp bia",
    description: "Món hấp đơn giản mà thơm ngọt, dễ ăn.",
    province: "Quảng Ninh",
    suggestedRestaurant: "Quán Hải sản Vân Đồn", // Thêm thông tin nhà hàng
    image: "/images/Bebe_hapbia.jpg",
    category: "Bề bề", // Thêm category
    status: "approved"
  },
  {
    name: "Mực trứng chiên giòn",
    description: "Mực trứng lăn bột chiên vàng, trứng tan chảy trong miệng.",
    province: "Hà Nội",
    suggestedRestaurant: "Nhà hàng Món Ngon Hà Thành", // Thêm thông tin nhà hàng
    image: "/images/Mucchien.jpg",
    category: "Mực", // Thêm category
    status: "approved"
  },
  {
    name: "Ngao hấp gừng sả",
    description: "Ngao tươi hấp gừng, sả thơm thanh, nước dùng ngọt dịu.",
    province: "Nam Định",
    suggestedRestaurant: "Quán Hải Sản Thúy Hằng, Nam Định", // Có sẵn
    image: "/images/Ngao_hapxa.jpg",
    category: "Sò", // Thêm category
    status: "approved"
  },
   {
    name: "Tôm hấp nước dừa",
    description: "Tôm tươi hấp nước dừa, ngọt thanh và thơm.",
    province: "Quảng Ninh",
    suggestedRestaurant: "Nhà hàng Vịnh Hạ Long, Quảng Ninh", // Có sẵn
    image: "/images/Tom_hapncdua.jpg",
    category: "Tôm", // Thêm category
    status: "approved"
  },
  {
    name: "Ghẹ rang muối",
    description: "Ghẹ tươi rang muối, vị mặn cay, thơm lừng.",
    province: "Quảng Ninh",
    suggestedRestaurant: "Hải sản Phú Quý, Hạ Long, Quảng Ninh", // Có sẵn
    image: "/images/Ghe_rangmuoi.jpg",
    category: "Ghẹ", // Thêm category
    status: "approved"
  },
  {
    name: "Cua rang me",
    description: "Cua rang sốt me chua ngọt, thơm, vỏ giòn.",
    province: "Hải Phòng",
    suggestedRestaurant: "Nhà hàng Biển Đông, Hải Phòng", // Có sẵn
    image: "/images/Cua_rangme.jpg",
    category: "Cua", // Thêm category
    status: "approved"
  },
  {
    name: "Tôm hùm baby cháy tỏi",
    description: "Tôm nhỏ nhưng chắc thịt, xào tỏi vàng thơm.",
    province: "Quảng Ninh",
    suggestedRestaurant: "Hải sản Đảo Ngọc, Cẩm Phả, Quảng Ninh", // Có sẵn
    image: "/images/Tomhum_chaytoi.jpg",
    category: "Tôm", // Thêm category
    status: "approved"
  },
  // Thêm một số món khác nếu muốn
  {
    name: "Cá song hấp xì dầu",
    description: "Cá song tươi ngon hấp cùng xì dầu, gừng, hành lá thơm lừng.",
    province: "Hải Phòng",
    suggestedRestaurant: "Nhà hàng Gió Biển",
    image: "/images/casong.jpg", // Bạn cần có ảnh này trong public/images
    category: "Cá",
    status: "approved"
  },
  {
    name: "Bạch tuộc nướng sa tế",
    description: "Bạch tuộc nướng sa tế cay nồng, giòn sần sật.",
    province: "Đà Nẵng",
    suggestedRestaurant: "Quán Bé Mặn",
    image: "/images/bachtuoc.jpg", // Bạn cần có ảnh này trong public/images
    category: "Bạch tuộc",
    status: "approved"
  }
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB for seeding data.');

    // Xóa hết dữ liệu cũ trong collection trước khi thêm mới
    await Food.deleteMany({});
    console.log('🗑️ Old food data cleared.');

    await Food.insertMany(foods);
    console.log(`✅ Successfully added ${foods.length} food items!`);
    
    // Optional: Add a default admin user if it doesn't exist
    const User = require('../models/User');
    const bcrypt = require('bcrypt');
    const adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
        const hashedPassword = await bcrypt.hash('admin123', 10); // Default admin password
        await User.create({
            username: 'admin',
            password: hashedPassword,
            role: 'admin',
            email: 'admin@example.com',
            bio: 'Default administrator account'
        });
        console.log('✨ Default admin user created (username: admin, password: admin123)');
    } else {
        console.log('Admin user already exists.');
    }


  } catch (err) {
    console.error("❌ Error while seeding data:", err);
  } finally {
    mongoose.disconnect();
    console.log('🔌 MongoDB connection closed.');
    process.exit();
  }
})();