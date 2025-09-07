const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

class WhatsAppService {
    constructor() {
        this.baseURL = `${BASE_URL}/whatsapp`;
        this.eventSource = null;
        this.listeners = new Map();
        this.resetState();
    }

    resetState() {
        this.state = {
            status: 'disconnected',
            qrCode: null,
            authInfo: null,
            stats: {
                totalMessages: 0,
                successfulMessages: 0,
                failedMessages: 0,
                receivedMessages: 0,
                uptime: '00:00:00',
                successRate: 0,
                startTime: null
            },
            error: null
        };
    }

    // Utility method for API calls
    async apiCall(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API call failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Event handling
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    // Connection Management
    async initialize() {
        try {
            // إعادة تعيين الحالة قبل التهيئة
            this.resetState();

            const response = await fetch(`${this.baseURL}/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('فشل في تهيئة WhatsApp');
            }

            const data = await response.json();
            this.startEventStream();
            return data;
        } catch (error) {
            console.error('Error initializing WhatsApp:', error);
            this.state.error = error.message;
            this.emit('error', {
                message: 'فشل في تهيئة WhatsApp',
                error: error.message
            });
            throw error;
        }
    }

    async getStatus() {
        try {
            const response = await fetch(`${this.baseURL}/status`);
            if (!response.ok) {
                throw new Error('فشل في الحصول على حالة WhatsApp');
            }

            const data = await response.json();

            // تحديث الحالة المحلية
            this.state.status = data.data.isReady ? 'connected' : (data.data.qrCode ? 'qr_ready' : 'disconnected');
            this.state.qrCode = data.data.qrCode;
            this.state.authInfo = data.data.authInfo || null;

            // الحصول على الإحصائيات الحالية
            const statsResponse = await fetch(`${this.baseURL}/stats`);
            if (statsResponse.ok) {
                const statsData = await statsResponse.json();
                if (statsData.success) {
                    this.state.stats = statsData.stats;
                }
            }

            return {
                status: this.state.status,
                qrCode: this.state.qrCode,
                authInfo: this.state.authInfo,
                stats: this.state.stats
            };
        } catch (error) {
            console.error('Error getting WhatsApp status:', error);
            this.state.error = error.message;
            this.emit('error', {
                message: 'فشل في الحصول على حالة WhatsApp',
                error: error.message
            });
            throw error;
        }
    }

    async disconnect() {
        try {
            const response = await fetch(`${this.baseURL}/disconnect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'فشل في قطع الاتصال');
            }

            return result;
        } catch (error) {
            console.error('WhatsApp disconnect error:', error);
            throw error;
        }
    }

    async checkHealth() {
        return await this.apiCall('/health');
    }

    // QR Code Operations (Enhanced)
    async getQRCode() {
        return await this.apiCall('/qr-code');
    }

    async getQRStatus() {
        return await this.apiCall('/qr-status');
    }

    async getQRImage() {
        const url = `${this.baseURL}/qr-image`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Failed to get QR image: ${response.status}`);
        }

        return response.blob();
    }

    // Enhanced QR polling with better error handling
    async pollForQRCode(options = {}) {
        const {
            maxAttempts = 30,
            intervalMs = 2000,
            onProgress = null,
            onQRReceived = null
        } = options;

        let attempt = 0;
        let lastError = null;

        return new Promise((resolve, reject) => {
            const poll = async () => {
                try {
                    attempt++;

                    if (onProgress) {
                        onProgress({
                            attempt,
                            maxAttempts,
                            status: 'polling'
                        });
                    }

                    const result = await this.getQRCode();

                    if (result.success && result.qrCode) {
                        if (onQRReceived) {
                            onQRReceived(result.qrCode);
                        }
                        resolve(result);
                        return;
                    }

                    if (attempt >= maxAttempts) {
                        reject(new Error(`QR Code not available after ${maxAttempts} attempts. Last error: ${lastError?.message || 'Unknown'}`));
                        return;
                    }

                    // Schedule next attempt
                    setTimeout(poll, intervalMs);

                } catch (error) {
                    lastError = error;
                    console.log(`QR Code polling attempt ${attempt} failed:`, error.message);

                    if (attempt >= maxAttempts) {
                        reject(new Error(`QR Code polling failed after ${maxAttempts} attempts. Last error: ${error.message}`));
                        return;
                    }

                    // Continue polling on error
                    setTimeout(poll, intervalMs);
                }
            };

            // Start polling immediately
            poll();
        });
    }

    // Message Operations
    async sendMessage(to, message, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to, message, options })
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'فشل في إرسال الرسالة');
            }

            return result;
        } catch (error) {
            console.error('WhatsApp send message error:', error);
            throw error;
        }
    }

    async sendTemplateMessage(to, templateName, templateData = {}) {
        return await this.apiCall('/send-template', {
            method: 'POST',
            body: JSON.stringify({
                to,
                templateName,
                templateData
            })
        });
    }

    async sendBulkMessages(recipients, message, templateName = null, options = {}) {
        return await this.apiCall('/send-bulk', {
            method: 'POST',
            body: JSON.stringify({
                recipients,
                message,
                templateName,
                options
            })
        });
    }

    async sendMedia(to, mediaPath, caption = '', options = {}) {
        return await this.apiCall('/send-media', {
            method: 'POST',
            body: JSON.stringify({
                to,
                mediaPath,
                caption,
                options
            })
        });
    }

    // Template Management
    async getTemplates() {
        return await this.apiCall('/templates');
    }

    async getTemplate(id) {
        return await this.apiCall(`/templates/${id}`);
    }

    async createTemplate(templateData) {
        return await this.apiCall('/templates', {
            method: 'POST',
            body: JSON.stringify(templateData)
        });
    }

    async updateTemplate(id, templateData) {
        return await this.apiCall(`/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(templateData)
        });
    }

    async deleteTemplate(id) {
        return await this.apiCall(`/templates/${id}`, {
            method: 'DELETE'
        });
    }

    async previewTemplate(templateName, templateData = {}) {
        return await this.apiCall('/templates/preview', {
            method: 'POST',
            body: JSON.stringify({
                templateName,
                templateData
            })
        });
    }

    // Statistics and Analytics
    async getStats(days = 30) {
        return await this.apiCall(`/stats?days=${days}`);
    }

    async getLogs(limit = 10000, type = null, status = null) {
        let query = `?limit=${limit}`;
        if (type) query += `&type=${type}`;
        if (status) query += `&status=${status}`;

        return await this.apiCall(`/logs${query}`);
    }

    // Utility Functions
    async validatePhone(phone) {
        return await this.apiCall('/validate-phone', {
            method: 'POST',
            body: JSON.stringify({ phone })
        });
    }

    async formatPhones(phones) {
        return await this.apiCall('/format-phone', {
            method: 'POST',
            body: JSON.stringify({ phones })
        });
    }

    // HR Integration
    async sendWelcomeMessage(employeeData) {
        return await this.apiCall('/hr/welcome', {
            method: 'POST',
            body: JSON.stringify(employeeData)
        });
    }

    async sendSalaryNotification(employeeData, salaryData) {
        return await this.apiCall('/hr/salary-notification', {
            method: 'POST',
            body: JSON.stringify({
                employeeData,
                salaryData
            })
        });
    }

    async sendMeetingReminder(attendees, meetingData) {
        return await this.apiCall('/hr/meeting-reminder', {
            method: 'POST',
            body: JSON.stringify({
                attendees,
                meetingData
            })
        });
    }

    async sendLeaveApproval(employeeData, leaveData) {
        return await this.apiCall('/hr/leave-approval', {
            method: 'POST',
            body: JSON.stringify({
                employeeData,
                leaveData
            })
        });
    }

    async sendHRNotification(employees, message, category = 'general') {
        return await this.apiCall('/hr/notification', {
            method: 'POST',
            body: JSON.stringify({
                employees,
                message,
                category
            })
        });
    }

    // System Management
    async createBackup() {
        return await this.apiCall('/backup', {
            method: 'POST'
        });
    }

    async cleanup() {
        return await this.apiCall('/cleanup', {
            method: 'POST'
        });
    }

    // Event Source Management
    startEventStream() {
        if (this.eventSource) {
            this.eventSource.close();
        }

        this.eventSource = new EventSource(`${this.baseURL}/events`);

        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.emit(data.event, data.data);
            } catch (error) {
                console.error('Event source message error:', error);
            }
        };

        this.eventSource.onerror = (error) => {
            console.error('Event source error:', error);
            this.eventSource.close();
            this.eventSource = null;

            // Attempt to reconnect after 5 seconds
            setTimeout(() => this.startEventStream(), 5000);
        };
    }

    stopEventStream() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    // Helper methods
    handleApiError(error, context = '') {
        console.error(`WhatsApp ${context} error:`, error);
        if (error.response) {
            return error.response.data?.message || 'حدث خطأ في الاتصال بالخادم';
        }
        return error.message || 'حدث خطأ غير متوقع';
    }

    // Helper methods for React components
    async withLoading(operation, onProgress = null) {
        try {
            if (onProgress) onProgress({ loading: true });
            const result = await operation();
            if (onProgress) onProgress({ loading: false, success: true });
            return result;
        } catch (error) {
            if (onProgress) onProgress({ loading: false, error: error.message });
            throw error;
        }
    }

    // Batch operations
    async batchValidatePhones(phones) {
        const results = [];
        const batchSize = 10;

        for (let i = 0; i < phones.length; i += batchSize) {
            const batch = phones.slice(i, i + batchSize);
            const batchResults = await this.formatPhones(batch);
            results.push(...batchResults.results);
        }

        return { results };
    }

    // Template helpers
    extractTemplateVariables(content) {
        const variableRegex = /\{\{([^}]+)\}\}/g;
        const variables = [];
        let match;

        while ((match = variableRegex.exec(content)) !== null) {
            if (!variables.includes(match[1])) {
                variables.push(match[1]);
            }
        }

        return variables;
    }

    renderTemplate(content, data) {
        let rendered = content;
        Object.keys(data).forEach(key => {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            rendered = rendered.replace(placeholder, data[key] || '');
        });
        return rendered;
    }

    // Predefined HR templates for quick access
    getHRTemplates() {
        return [
            {
                name: 'welcome_employee',
                title: 'ترحيب بموظف جديد',
                category: 'hr',
                requiredFields: ['employeeName', 'companyName', 'department', 'position']
            },
            {
                name: 'salary_notification',
                title: 'إشعار صرف راتب',
                category: 'payroll',
                requiredFields: ['employeeName', 'month', 'amount']
            },
            {
                name: 'meeting_reminder',
                title: 'تذكير اجتماع',
                category: 'meetings',
                requiredFields: ['employeeName', 'subject', 'date', 'time']
            },
            {
                name: 'leave_approval',
                title: 'إشعار طلب إجازة',
                category: 'hr',
                requiredFields: ['employeeName', 'status', 'startDate', 'endDate']
            },
            {
                name: 'general_announcement',
                title: 'إعلان عام',
                category: 'general',
                requiredFields: ['title', 'content']
            },
            {
                name: 'birthday_wishes',
                title: 'تهنئة عيد ميلاد',
                category: 'general',
                requiredFields: ['employeeName']
            },
            {
                name: 'performance_review',
                title: 'تقييم أداء',
                category: 'hr',
                requiredFields: ['employeeName', 'period', 'meetingDate']
            }
        ];
    }

    // Phone number formatting helpers
    formatSaudiNumber(phone) {
        const cleaned = phone.replace(/[^\d]/g, '');

        if (cleaned.startsWith('966')) {
            return cleaned;
        } else if (cleaned.startsWith('05')) {
            return '966' + cleaned.substring(1);
        } else if (cleaned.startsWith('5') && cleaned.length === 9) {
            return '966' + cleaned;
        }

        return cleaned;
    }

    isValidSaudiNumber(phone) {
        const cleaned = phone.replace(/[^\d]/g, '');

        if (cleaned.startsWith('966')) {
            return cleaned.length === 12 && cleaned.substring(3, 4) === '5';
        } else if (cleaned.startsWith('05')) {
            return cleaned.length === 10;
        }

        return false;
    }

    // Configuration helpers
    getDefaultConfig() {
        return {
            delayBetweenMessages: 3000,
            maxBulkRecipients: 50,
            retryAttempts: 2,
            autoReply: false,
            notifications: {
                success: true,
                error: true,
                info: true
            }
        };
    }

    // Statistics helpers
    formatStats(stats) {
        const successRate = stats.totalMessages > 0
            ? ((stats.successfulMessages / stats.totalMessages) * 100).toFixed(1)
            : 0;

        return {
            ...stats,
            successRate: `${successRate}%`,
            failureRate: `${(100 - parseFloat(successRate)).toFixed(1)}%`,
            uptime: this.formatUptime(stats.uptime || 0)
        };
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return `${days}د ${hours}س ${minutes}ق`;
        } else if (hours > 0) {
            return `${hours}س ${minutes}ق`;
        } else {
            return `${minutes}ق`;
        }
    }

    // Clean up method
    destroy() {
        this.stopEventStream();
        this.listeners.clear();
    }

    async resetData() {
        try {
            // 1. إيقاف تدفق الأحداث الحالي
            this.stopEventStream();

            // 2. إعادة تعيين الحالة المحلية
            this.resetState();

            // 3. إرسال طلب إعادة تعيين البيانات إلى الخادم
            const response = await fetch(`${this.baseURL}/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error('فشل في إعادة تعيين البيانات');
            }

            const data = await response.json();

            // 4. إرسال حدث إعادة التعيين
            this.emit('reset', {
                message: data.message,
                timestamp: data.timestamp
            });

            // 5. إعادة تشغيل تدفق الأحداث
            this.startEventStream();

            return true;
        } catch (error) {
            console.error('Error resetting WhatsApp data:', error);
            this.state.error = error.message;
            this.emit('error', {
                message: 'فشل في إعادة تعيين البيانات',
                error: error.message
            });
            throw error;
        }
    }
}

// Export singleton instance
export default new WhatsAppService(); 