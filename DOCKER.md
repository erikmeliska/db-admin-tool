# Docker Deployment Guide

## Build & Run

### Quick Start with Docker Compose
```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Manual Docker Commands
```bash
# Build the image
docker build -t db-admin-tool:latest .

# Run the container
docker run -d \
  -p 8008:8008 \
  -e GOOGLE_API_KEY=your_google_api_key \
  --name db-admin-tool \
  db-admin-tool:latest

# View logs
docker logs -f db-admin-tool

# Stop and remove
docker stop db-admin-tool && docker rm db-admin-tool
```

## Image Details

- **Base Image**: `node:20-alpine`
- **Final Image Size**: ~203MB
- **Port**: 8008
- **User**: Non-root user `nextjs` (UID 1001)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_API_KEY` | Yes | Google AI API key for Gemini integration |
| `NODE_ENV` | No | Set to `production` (default in container) |
| `PORT` | No | Port to run on (default: 8008) |

## Security Features

- Multi-stage build for minimal attack surface
- Non-root user execution
- Standalone Next.js output for smaller bundle
- Alpine Linux base for security and size

## Production Deployment

### Using Docker Compose
1. Copy `.env.example` to `.env.production`
2. Fill in your environment variables
3. Update `docker-compose.yml` to use the env file:
   ```yaml
   env_file:
     - .env.production
   ```
4. Run: `docker-compose up -d`

### Using Docker Swarm or Kubernetes
The image supports orchestration platforms. Key considerations:
- Mount `/app/.next` as a volume if you need persistent cache
- Set resource limits appropriately
- Use secrets for sensitive environment variables
- Configure health checks on port 8008

### Health Check
```bash
curl -f http://localhost:8008 || exit 1
```

## Development

### Local Development with Docker
```bash
# Build development version
docker build --target builder -t db-admin-tool:dev .

# Run with hot reload (mount source)
docker run -it \
  -p 3000:3000 \
  -v $(pwd):/app \
  -v /app/node_modules \
  db-admin-tool:dev \
  npm run dev
```

### Building Script
Use the provided build script:
```bash
./scripts/docker-build.sh
```

## Troubleshooting

### Common Issues

1. **Build fails with missing dependencies**
   - Ensure `package-lock.json` exists
   - Run `npm install` locally first

2. **Container fails to start**
   - Check logs: `docker logs <container-name>`
   - Verify environment variables are set

3. **Application not accessible**
   - Ensure port 8008 is not in use
   - Check firewall settings
   - Verify container is running: `docker ps`

### Debugging
```bash
# Enter running container
docker exec -it db-admin-tool sh

# Check environment
docker exec db-admin-tool env

# Monitor resources
docker stats db-admin-tool
``` 