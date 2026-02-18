#!/bin/bash
SONAR_HOST_URL="${SONAR_HOST_URL:-http://localhost:9000}"
SONAR_TOKEN="${SONAR_TOKEN:-squ_1234567890abcdef}"

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "Starting SonarQube scan..."
echo "Server: $SONAR_HOST_URL"
echo "Project directory: $PROJECT_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm ci
fi

echo "Running tests with code coverage..."
npm run test 2>/dev/null || echo "Tests failed or not configured"

echo "Launching SonarQube scan..."
npx sonar-scanner \
    -Dsonar.projectKey=test-wallet \
    -Dsonar.projectName="Test Wallet" \
    -Dsonar.projectVersion=0.0.1 \
    -Dsonar.sources=src \
    -Dsonar.exclusions=src/generated/**,**/*.spec.ts,node_modules/** \
    -Dsonar.tests=src \
    -Dsonar.test.inclusions=**/*.spec.ts \
    -Dsonar.host.url="$SONAR_HOST_URL" \
    -Dsonar.login="$SONAR_TOKEN"

echo ""
echo "SonarQube scan completed!"
echo "Results available at: $SONAR_HOST_URL/dashboard?id=test-wallet"

