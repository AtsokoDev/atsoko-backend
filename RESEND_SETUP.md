# Resend Email Configuration Guide

## 🔑 How to Get Resend API Key

### Step 1: Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Click "Sign Up" or "Get Started"
3. Sign up with your email or GitHub account
4. Verify your email address

### Step 2: Get API Key
1. After login, go to **Dashboard**
2. Click on **API Keys** in the sidebar
3. Click **Create API Key** button
4. Give it a name (e.g., "Atsoko Backend")
5. Select permissions: **Full Access** (for sending emails)
6. Click **Create**
7. **Copy the API key immediately** (you won't see it again!)

Example API key format: `re_123abc456def789ghi012jkl345mno678`

### Step 3: Verify Domain (Optional but Recommended)
1. In Resend Dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `yourdomain.com`)
4. Add DNS records (SPF, DKIM) to your domain provider
5. Wait for verification (usually 5-30 minutes)

**Note:** If you don't verify a domain, you can only send from `onboarding@resend.dev` (for testing)

---

## 📝 Environment Variables Setup

Add these to your `.env` file:

```env
# Resend Configuration
RESEND_API_KEY=re_your_api_key_here
ADMIN_EMAIL=your-email@example.com
EMAIL_FROM=noreply@yourdomain.com

# Or use default for testing (if domain not verified):
# EMAIL_FROM=onboarding@resend.dev
```

### Configuration Variables:

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `RESEND_API_KEY` | ✅ Yes | Your Resend API key | `re_123abc...` |
| `ADMIN_EMAIL` | ✅ Yes | Email to receive notifications | `admin@yourdomain.com` |
| `EMAIL_FROM` | Optional | Sender email address | `noreply@yourdomain.com` |

**Default values:**
- If `EMAIL_FROM` not set, uses: `noreply@yourdomain.com`
- Replace `yourdomain.com` with your actual domain

---

## 🧪 Testing Setup

### For Development (No Domain Verified):

```env
RESEND_API_KEY=re_your_api_key_here
ADMIN_EMAIL=your-personal-email@gmail.com
EMAIL_FROM=onboarding@resend.dev
```

### For Production (Domain Verified):

```env
RESEND_API_KEY=re_your_production_key_here
ADMIN_EMAIL=admin@yourdomain.com
EMAIL_FROM=noreply@yourdomain.com
```

---

## 🚀 Quick Start Steps

1. **Get API Key** from [resend.com/api-keys](https://resend.com/api-keys)
2. **Add to .env file:**
   ```bash
   echo "RESEND_API_KEY=your_key_here" >> .env
   echo "ADMIN_EMAIL=your-email@gmail.com" >> .env
   echo "EMAIL_FROM=onboarding@resend.dev" >> .env
   ```
3. **Restart server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm start
   ```
4. **Test contact form:**
   ```bash
   curl -X POST http://localhost:3000/api/contact \
     -H "Content-Type: application/json" \
     -d '{
       "name": "Test User",
       "email": "test@example.com",
       "subject": "Test Email",
       "message": "Testing Resend integration"
     }'
   ```

---

## ✅ Verification Checklist

- [ ] Created Resend account
- [ ] Got API key from dashboard
- [ ] Added `RESEND_API_KEY` to `.env`
- [ ] Added `ADMIN_EMAIL` to `.env`
- [ ] Added `EMAIL_FROM` to `.env` (or using default)
- [ ] Restarted server
- [ ] Tested contact form submission
- [ ] Checked email inbox for notification
- [ ] (Optional) Verified domain for production

---

## 📊 Resend Free Tier Limits

- **100 emails per day**
- **3,000 emails per month**
- Perfect for contact forms!

---

## 🔍 Troubleshooting

### Email not sending?

1. Check `.env` file has correct API key
2. Check server logs for error messages
3. Verify `ADMIN_EMAIL` is correct
4. If using custom domain, check it's verified in Resend
5. Check Resend dashboard logs

### Still not working?

The system is designed to **fail gracefully** - if email fails, the contact message is still saved to database. Check server console for warnings.

---

## 📧 Email Template Preview

When someone submits the contact form, admin receives:

**Subject:** `New Contact Message: [subject]`

**Body:** Professional HTML email with:
- Name, Email, Phone
- Subject and Message
- Timestamp (Thailand timezone)
- IP Address for reference

---

**Ready to go!** 🎉 Just add the API key to `.env` and restart the server.
