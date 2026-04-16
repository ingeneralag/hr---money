// Supabase Database Connection
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://synasjednemnpcxkhpuj.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseServiceKey) {
  console.warn('⚠️ SUPABASE_SERVICE_KEY is not set. Please set it in your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const connectDB = async () => {
  try {
    console.log('🔗 Connecting to Supabase...');
    // Test connection
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    console.log('✅ Supabase Connected Successfully');
    console.log(`📊 Project URL: ${supabaseUrl}`);
    return supabase;
  } catch (error) {
    console.error('❌ Supabase connection error:', error.message);
    throw error;
  }
};

module.exports = { connectDB, supabase };
