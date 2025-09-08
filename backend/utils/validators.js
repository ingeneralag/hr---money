/**
 * التحقق من صحة البريد الإلكتروني
 * @param {string} email - البريد الإلكتروني المراد التحقق منه
 * @returns {boolean} - صحة البريد الإلكتروني
 */
exports.validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * التحقق من صحة رقم الهاتف المصري
 * @param {string} phone - رقم الهاتف المراد التحقق منه
 * @returns {boolean} - صحة رقم الهاتف
 */
exports.validateEgyptianPhone = (phone) => {
  const re = /^01[0125][0-9]{8}$/;
  return re.test(phone);
};

/**
 * التحقق من قوة كلمة المرور
 * @param {string} password - كلمة المرور المراد التحقق منها
 * @returns {boolean} - قوة كلمة المرور
 */
exports.validatePassword = (password) => {
  // يجب أن تحتوي على 8 أحرف على الأقل
  // وتحتوي على حرف كبير وحرف صغير ورقم
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,}$/;
  return re.test(password);
}; 