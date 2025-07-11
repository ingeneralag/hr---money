require('dotenv').config();
const axios = require('axios');

const testTrackingRecords = async () => {
  try {
    console.log('🧪 اختبار endpoint في tracking.js...');
    
    const userId = '684fedd883e2693199a30a96';
    const url = `https://hr-api.in-general.net/api/tracking/daily-records/${userId}`;
    
    console.log('📡 إرسال طلب إلى:', url);
    
    const response = await axios.get(url);
    
    console.log('✅ حالة الاستجابة:', response.status);
    console.log('📊 البيانات المستلمة:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data?.records) {
      const records = response.data.data.records;
      console.log('\n📈 تحليل السجلات:');
      console.log(`- إجمالي السجلات: ${records.length}`);
      console.log(`- سجلات اليوم: ${records.filter(r => r.isToday).length}`);
      console.log(`- سجلات بها بيانات حقيقية: ${records.filter(r => r.hasRealData).length}`);
      console.log(`- سجلات العمل (غير إجازة): ${records.filter(r => !r.isWeekend).length}`);
      
      const todayRecord = records.find(r => r.isToday);
      if (todayRecord) {
        console.log('\n🎯 سجل اليوم الحالي:');
        console.log(JSON.stringify(todayRecord, null, 2));
      }
      
      const realDataRecords = records.filter(r => r.hasRealData);
      console.log('\n💾 السجلات ببيانات حقيقية:');
      realDataRecords.forEach(record => {
        console.log(`${record.date}: ${record.totalHours}س - إنتاجية: ${record.productivity}%`);
      });
    }
    
  } catch (error) {
    console.error('❌ خطأ في اختبار endpoint:', error.message);
    if (error.response) {
      console.error('📄 استجابة الخطأ:', error.response.data);
    }
  }
};

// تشغيل الاختبار
testTrackingRecords(); 