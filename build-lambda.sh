#!/usr/bin/env bash
set -euo pipefail

# Build a deployable zip for AWS Lambda in dist-lambda/

rm -rf dist-lambda
mkdir dist-lambda

cp -R controllers public routes views index.js package.json package-lock.json .env dist-lambda/

cd dist-lambda
npm install --only=production
cp -R ../lambda ./lambda

zip -r serper-search-console.zip .

echo "Built dist-lambda/serper-search-console.zip"
