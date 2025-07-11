const mongoose = require('mongoose');

console.log('🔍 فحص اتصال قاعدة البيانات MongoDB Atlas...');
console.log('=' .repeat(50));

// Connection string with the correct password
const MONGODB_URI = 'mongodb://127.0.0.1:27017/hr-system';

async function checkDatabaseConnection() {
    try {
        console.log('🔗 محاولة الاتصال بـ MongoDB Atlas...');
        
        // Connect to MongoDB
        const conn = await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 seconds timeout
        });

        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
        console.log(`📊 Database Host: ${conn.connection.host}`);
        console.log(`📊 Database Name: ${conn.connection.name}`);
        console.log(`📊 Connection State: ${conn.connection.readyState}`);
        console.log('=' .repeat(50));

        // List all collections
        const collections = await conn.connection.db.listCollections().toArray();
        console.log(`📊 عدد الجداول (Collections): ${collections.length}`);
        
        if (collections.length > 0) {
            console.log('📋 قائمة الجداول الموجودة:');
            collections.forEach((collection, index) => {
                console.log(`   ${index + 1}. ${collection.name}`);
            });
        } else {
            console.log('⚠️  لا توجد جداول في قاعدة البيانات');
        }

        console.log('=' .repeat(50));

        // Check for specific collections and their data
        const importantCollections = ['users', 'employees', 'transactions', 'attendance'];
        
        for (const collectionName of importantCollections) {
            try {
                const collection = conn.connection.db.collection(collectionName);
                const count = await collection.countDocuments();
                console.log(`📊 ${collectionName}: ${count} سجل`);
                
                if (count > 0) {
                    // Show sample data
                    const sampleData = await collection.findOne();
                    console.log(`   عينة من البيانات:`, Object.keys(sampleData || {}));
                }
            } catch (error) {
                console.log(`❌ خطأ في جدول ${collectionName}: ${error.message}`);
            }
        }

        console.log('=' .repeat(50));
        console.log('🎉 فحص قاعدة البيانات مكتمل!');

    } catch (error) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:');
        console.error('📝 نوع الخطأ:', error.name);
        console.error('📝 رسالة الخطأ:', error.message);
        
        if (error.name === 'MongooseServerSelectionError') {
            console.error('🔧 تأكد من:');
            console.error('   1. صحة كلمة المرور');
            console.error('   2. وجود اتصال بالإنترنت');
            console.error('   3. صحة عنوان قاعدة البيانات');
        }
    } finally {
        console.log('🔌 إغلاق الاتصال...');
        await mongoose.disconnect();
        process.exit(0);
    }
}

checkDatabaseConnection(); 