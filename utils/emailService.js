const { Resend } = require('resend');

// Initialize Resend with API key from environment
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email notification when a new contact form is submitted
 * @param {Object} contactData - Contact form data
 * @returns {Promise} Resend response
 */
async function sendContactNotification(contactData) {
    try {
        // Check if Resend is configured
        if (!process.env.RESEND_API_KEY) {
            console.warn('⚠️ RESEND_API_KEY not configured. Email notification skipped.');
            return { skipped: true, reason: 'API key not configured' };
        }

        if (!process.env.ADMIN_EMAIL) {
            console.warn('⚠️ ADMIN_EMAIL not configured. Email notification skipped.');
            return { skipped: true, reason: 'Admin email not configured' };
        }

        const fromEmail = process.env.EMAIL_FROM || 'noreply@yourdomain.com';

        // Send email using Resend
        const data = await resend.emails.send({
            from: fromEmail,
            to: process.env.ADMIN_EMAIL,
            subject: `New Contact Message: ${contactData.subject || 'No Subject'}`,
            html: generateEmailHTML(contactData),
        });

        console.log('✅ Email notification sent successfully:', data);
        return data;

    } catch (error) {
        console.error('❌ Error sending email notification:', error);
        // Don't throw error - contact form should still work even if email fails
        return { error: error.message };
    }
}

/**
 * Generate HTML email template
 * @param {Object} contactData - Contact form data
 * @returns {string} HTML string
 */
function generateEmailHTML(contactData) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
        .field { margin-bottom: 20px; }
        .label { font-weight: bold; color: #555; display: block; margin-bottom: 5px; }
        .value { background-color: white; padding: 10px; border-left: 3px solid #4F46E5; }
        .footer { margin-top: 20px; text-align: center; color: #888; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 New Contact Form Submission</h2>
        </div>
        <div class="content">
            <div class="field">
                <span class="label">👤 Name:</span>
                <div class="value">${contactData.name}</div>
            </div>
            
            <div class="field">
                <span class="label">📧 Email:</span>
                <div class="value"><a href="mailto:${contactData.email}">${contactData.email}</a></div>
            </div>
            
            ${contactData.phone ? `
            <div class="field">
                <span class="label">📞 Phone:</span>
                <div class="value">${contactData.phone}</div>
            </div>
            ` : ''}
            
            ${contactData.subject ? `
            <div class="field">
                <span class="label">📋 Subject:</span>
                <div class="value">${contactData.subject}</div>
            </div>
            ` : ''}
            
            <div class="field">
                <span class="label">💬 Message:</span>
                <div class="value">${contactData.message.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="field">
                <span class="label">🕐 Received:</span>
                <div class="value">${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}</div>
            </div>
            
            ${contactData.ip_address ? `
            <div class="field">
                <span class="label">🌐 IP Address:</span>
                <div class="value">${contactData.ip_address}</div>
            </div>
            ` : ''}
        </div>
        <div class="footer">
            <p>This is an automated notification from your website contact form.</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

module.exports = {
    sendContactNotification
};
