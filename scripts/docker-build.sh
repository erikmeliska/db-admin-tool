#!/bin/bash

# Build script for Database Admin Tool Docker image

echo "🐳 Building Database Admin Tool Docker image..."

# Build the Docker image
docker build -t db-admin-tool:latest .

echo "✅ Docker image built successfully!"
echo "📊 Image size:"
docker images db-admin-tool:latest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

echo ""
echo "🚀 To run the container:"
echo "docker run -p 8008:8008 -e GOOGLE_API_KEY=your_key db-admin-tool:latest"
echo ""
echo "📋 Or use docker-compose:"
echo "docker-compose up -d" 