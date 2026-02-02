# Access Control API - Quick Reference

## 🔑 Authentication

```javascript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});
const { accessToken, refreshToken } = response.data;

// Use token in all subsequent requests
headers: { 'Authorization': `Bearer ${accessToken}` }
```

---

## 📊 API Endpoints Summary

### Property Workflow (Admin Only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/property-workflow/pending` | Get pending properties |
| PUT | `/api/property-workflow/:id/status` | Change workflow status |
| PUT | `/api/property-workflow/:id/publish` | Publish property |
| PUT | `/api/property-workflow/:id/unpublish` | Unpublish property |
| GET | `/api/property-workflow/:id/history` | Get workflow history |

### Property Requests (Admin + Agent)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/api/property-requests` | List requests | Both |
| POST | `/api/property-requests` | Create edit/delete request | Agent |
| GET | `/api/property-requests/:id` | Get request detail | Both |
| PUT | `/api/property-requests/:id/process` | Approve/reject request | Admin |

### Property Notes (Admin + Agent)

| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/api/property-notes/:propertyId` | Get notes | Both |
| POST | `/api/property-notes/:propertyId` | Add note | Both |
| DELETE | `/api/property-notes/:propertyId/:noteId` | Delete note | Both* |

*Agent can only delete own notes within 24h

---

## 🔄 Workflow Status Flow

```
Agent adds property
        ↓
┌───────────────────┐
│ pending           │ ← Initial status
└───────────────────┘
        ↓ Admin reviews
┌───────────────────┐     ┌───────────────────┐
│ ready_to_publish  │ OR  │ wait_to_fix       │
└───────────────────┘     └───────────────────┘
        ↓                         ↓
    Admin publishes         Agent fixes
        ↓                         ↓
┌───────────────────┐     ┌───────────────────┐
│ published         │     │ fixed             │
└───────────────────┘     └───────────────────┘
                                  ↓
                          Admin reviews again
```

---

## 🎯 Frontend Action Guide

### Agent Dashboard

```javascript
// 1. Get agent's properties (own team only)
GET /api/properties?agent_only=true

// 2. Check if can edit directly
if (property.approve_status !== 'published') {
  // Can edit directly
  PUT /api/properties/:id
} else {
  // Must create request
  POST /api/property-requests
}

// 3. Respond to fix request
if (property.workflow_status === 'wait_to_fix') {
  // Show fix request notes
  GET /api/property-notes/:id
  
  // Submit fix response
  POST /api/property-notes/:id { note_type: 'fix_response' }
}
```

### Admin Dashboard

```javascript
// 1. Get pending queue with summary
GET /api/property-workflow/pending

// 2. Review property and change status
PUT /api/property-workflow/:id/status {
  workflow_status: 'wait_to_fix' | 'ready_to_publish',
  note: 'Details here'
}

// 3. Publish when ready
PUT /api/property-workflow/:id/publish

// 4. Handle requests
GET /api/property-requests
PUT /api/property-requests/:id/process {
  action: 'approve' | 'reject',
  admin_response: 'Details here'
}
```

---

## ⚠️ Important Response Fields

### requiresRequest Flag

When agent tries to edit/delete published property:

```json
{
  "success": false,
  "error": "Published properties cannot be edited directly...",
  "requiresRequest": true  // ← Check this!
}
```

**Frontend action:** Show "Create Request" button instead of edit form.

### Workflow Status in Properties

```json
{
  "id": 1844,
  "approve_status": "pending",
  "workflow_status": "wait_to_fix"  // ← Show indicator!
}
```

**Frontend action:** 
- `pending` → "รอตรวจสอบ"
- `wait_to_fix` → "รอแก้ไข" (highlight)
- `fixed` → "แก้ไขแล้ว"
- `ready_to_publish` → "พร้อมเผยแพร่"

---

## 📁 Files Location

```
docs/
├── ACCESS_CONTROL_API.md          # Full Thai documentation
├── ACCESS_CONTROL_CURL_EXAMPLES.md # All cURL examples
└── ACCESS_CONTROL_QUICK_REF.md    # This file

scripts/
├── test-access-control-complete.js     # Run all tests
├── test-access-control-interactive.sh  # Interactive testing
└── create-test-users.js                # Create test accounts
```

---

## 🧪 Testing

```bash
# Run complete API tests
node scripts/test-access-control-complete.js

# Interactive testing
./scripts/test-access-control-interactive.sh

# Get tokens for manual testing
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"testadmin@atsoko.com","password":"TestPass123!"}' \
  | jq -r '.data.accessToken')
```
