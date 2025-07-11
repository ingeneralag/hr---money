const axios = require('axios');

async function testDataMismatch() {
  try {
    console.log('🔑 Authenticating...');
    
    // Login to get auth token
    const loginResponse = await axios.post('https://hr-api.in-general.net/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('Login response:', loginResponse.data);
    
    const token = loginResponse.data.data.token;
    const loggedInUserId = loginResponse.data.data.user.id;
    
    if (!token) {
      console.error('❌ No token received from login');
      return;
    }
    
    console.log('✅ Authentication successful');
    console.log('🔐 Token preview:', token.substring(0, 50) + '...');
    console.log('👤 Logged in user ID:', loggedInUserId);
    
    // Use the logged-in user's ID - this should match the employee with userId = loggedInUserId
    const userId = loggedInUserId; // This is '6855b3f715cf56bc12d059a3'
    
    console.log('\n📊 Testing Daily Attendance API...');
    console.log('🎯 Using endpoint:', `https://hr-api.in-general.net/api/daily-attendance/employee/${userId}/month/2025-06`);
    
    // Test the daily attendance endpoint
    const attendanceResponse = await axios.get(
      `https://hr-api.in-general.net/api/daily-attendance/employee/${userId}/month/2025-06`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );
    
    const attendanceData = attendanceResponse.data;
    console.log('📋 Attendance Data Response:');
    console.log('Success:', attendanceData.success);
    console.log('Records Count:', attendanceData.data?.length || 0);
    
    if (attendanceData.data && attendanceData.data.length > 0) {
      console.log('\n📅 June 2025 Records:');
      console.log('Date\t\tHours\tSeconds\tStatus\t\tHasReal');
      console.log('='.repeat(70));
      
      attendanceData.data.forEach(record => {
        const date = new Date(record.date).toISOString().split('T')[0];
        const hours = (record.totalHours || 0).toFixed(2);
        const seconds = record.totalSeconds || 0;
        const status = record.status || 'N/A';
        const hasReal = (record.totalSeconds > 0 || record.totalHours > 0) ? 'YES' : 'NO';
        
        console.log(`${date}\t${hours}h\t${seconds}s\t${status}\t${hasReal}`);
      });
      
      // Check for specific dates that user mentioned
      const june18 = attendanceData.data.find(r => new Date(r.date).toISOString().split('T')[0] === '2025-06-18');
      const june20 = attendanceData.data.find(r => new Date(r.date).toISOString().split('T')[0] === '2025-06-20');
      const june21 = attendanceData.data.find(r => new Date(r.date).toISOString().split('T')[0] === '2025-06-21');
      
      console.log('\n🎯 Specific Dates Analysis:');
      if (june18) {
        console.log(`June 18: ${june18.totalHours || 0}h ${june18.totalMinutes || 0}m (${june18.totalSeconds || 0}s) - Status: ${june18.status}`);
        console.log(`  - Total Formatted: ${june18.totalFormatted || 'N/A'}`);
        console.log(`  - Active Formatted: ${june18.activeFormatted || 'N/A'}`);
      } else {
        console.log('June 18: No record found');
      }
      
      if (june20) {
        console.log(`June 20: ${june20.totalHours || 0}h ${june20.totalMinutes || 0}m (${june20.totalSeconds || 0}s) - Status: ${june20.status}`);
        console.log(`  - Total Formatted: ${june20.totalFormatted || 'N/A'}`);
        console.log(`  - Active Formatted: ${june20.activeFormatted || 'N/A'}`);
      } else {
        console.log('June 20: No record found');
      }
      
      if (june21) {
        console.log(`June 21: ${june21.totalHours || 0}h ${june21.totalMinutes || 0}m (${june21.totalSeconds || 0}s) - Status: ${june21.status}`);
        console.log(`  - Total Formatted: ${june21.totalFormatted || 'N/A'}`);
        console.log(`  - Active Formatted: ${june21.activeFormatted || 'N/A'}`);
      } else {
        console.log('June 21: No record found');
      }
    }
    
    // Test the dashboard/me endpoint
    console.log('\n📊 Testing Dashboard/Me API...');
    
    try {
      const meResponse = await axios.get(
        'https://hr-api.in-general.net/api/dashboard/me',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );
      
      const meData = meResponse.data;
      console.log('📋 Dashboard/Me Data:');
      console.log('Success:', meData.success);
      
      if (meData.data && meData.data.currentMonthAttendance) {
        console.log('\n📅 Current Month Attendance from Dashboard:');
        const attendance = meData.data.currentMonthAttendance;
        
        if (attendance.length > 0) {
          console.log('Date\t\tHours\tStatus\t\tFormatted');
          console.log('='.repeat(60));
          
          attendance.forEach(record => {
            const date = new Date(record.date).toISOString().split('T')[0];
            const hours = (record.totalHours || 0).toFixed(2);
            const status = record.status || 'N/A';
            const formatted = record.totalFormatted || 'N/A';
            
            console.log(`${date}\t${hours}h\t${status}\t${formatted}`);
          });
          
          // Compare specific dates
          console.log('\n🔍 Comparison Analysis:');
          const dashJune18 = attendance.find(r => new Date(r.date).toISOString().split('T')[0] === '2025-06-18');
          const dashJune20 = attendance.find(r => new Date(r.date).toISOString().split('T')[0] === '2025-06-20');
          const dashJune21 = attendance.find(r => new Date(r.date).toISOString().split('T')[0] === '2025-06-21');
          
          if (dashJune18 && june18) {
            const match = (dashJune18.totalHours === june18.totalHours && dashJune18.totalSeconds === june18.totalSeconds);
            console.log(`June 18 Match: ${match ? '✅' : '❌'} Dashboard: ${dashJune18.totalHours}h vs Attendance: ${june18.totalHours}h`);
          }
          
          if (dashJune20 && june20) {
            const match = (dashJune20.totalHours === june20.totalHours && dashJune20.totalSeconds === june20.totalSeconds);
            console.log(`June 20 Match: ${match ? '✅' : '❌'} Dashboard: ${dashJune20.totalHours}h vs Attendance: ${june20.totalHours}h`);
          }
          
          if (dashJune21 && june21) {
            const match = (dashJune21.totalHours === june21.totalHours && dashJune21.totalSeconds === june21.totalSeconds);
            console.log(`June 21 Match: ${match ? '✅' : '❌'} Dashboard: ${dashJune21.totalHours}h vs Attendance: ${june21.totalHours}h`);
          }
        }
      }
    } catch (dashError) {
      console.log('❌ Dashboard/Me API error:', dashError.response?.data?.message || dashError.message);
      if (dashError.response?.status) {
        console.log('Status:', dashError.response.status);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.message || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    if (error.response?.status) {
      console.error('Status code:', error.response.status);
    }
  }
}

testDataMismatch(); 