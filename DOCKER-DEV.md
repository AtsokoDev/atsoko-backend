# Docker Development Setup

Quick and easy local development setup using Docker.

## Prerequisites

- Docker Desktop installed
- Git

## Quick Start (สำหรับทีม Dev)

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd atsoko-backend
```

### 2. Copy Environment File

```bash
cp .env.docker .env
```

### 3. Start Everything

```bash
docker-compose up -d
```

That's it! 🎉 API will be available at `http://localhost:3000`

---

## Development Workflow

### Start Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

### Stop Development

```bash
docker-compose down
```

### Restart After Code Changes

With hot reload (if using nodemon):
- Just save your file, it will auto-restart

Without hot reload:
```bash
docker-compose restart backend
```

---

## Database Management

### Import Data

```bash
# Copy CSV file if needed
# Then run import script inside container
docker-compose exec backend node scripts/import-data.js
```

### Access Database

```bash
# Using psql
docker-compose exec postgres psql -U postgres -d thaiindustrialproperty_db

# Check properties
docker-compose exec postgres psql -U postgres -d thaiindustrialproperty_db -c "SELECT COUNT(*) FROM properties;"
```

### Reset Database

```bash
# Stop and remove volumes
docker-compose down -v

# Start fresh
docker-compose up -d
```

---

## Common Commands

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f

# Execute command in backend
docker-compose exec backend npm install <package>

# Shell access
docker-compose exec backend sh
docker-compose exec postgres psql -U postgres
```

---

## Troubleshooting

### Port Already in Use

If port 3000 or 5432 is already in use:

```bash
# Change ports in docker-compose.yml
ports:
  - "3001:3000"  # Use different port
```

### Database Connection Error

```bash
# Check if postgres is healthy
docker-compose ps

# Restart services
docker-compose restart
```

### Clear Everything and Start Fresh

```bash
docker-compose down -v
docker-compose up -d --build
```

---

## Development vs Production

- **Development** (Docker Compose): Each dev has their own database
- **Production** (VPS): Shared production database

This separation ensures:
- Safe testing without affecting production
- Independent development
- Easy onboarding for new developers

---

## Adding nodemon for Hot Reload

Update `package.json`:

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

Then rebuild:
```bash
docker-compose down
docker-compose up -d --build
```

---

**Perfect for team development! Each developer works independently.** 🚀
