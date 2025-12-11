# Deploying the Serper Search Console to AWS Lambda

This repo is currently an Express web app. The `lambda/handler.js` file lets you run the same app on AWS Lambda behind API Gateway with minimal changes.

## 1. Prerequisites

- An AWS account.
- AWS region chosen (examples use `us-east-1`).
- Node.js 18+ installed locally.
- Your Serper API key.

## 2. Install dependencies

From the project root:

```bash
npm install
```

This includes `serverless-http`, which adapts API Gateway events to Express.

## 3. Build the Lambda bundle

Lambda needs the **code + node_modules**, but no build step is required for this app.

From the project root:

```bash
# Install production deps only into a clean folder for deployment (optional but recommended)
rm -rf dist-lambda
mkdir dist-lambda
cp -R controllers public routes views index.js package.json package-lock.json .env dist-lambda/
cd dist-lambda
npm install --only=production
cp -R ../lambda ./lambda
zip -r serper-search-console.zip .
```

Upload `serper-search-console.zip` to Lambda in the next steps.

> **Note:** For a real pipeline you would automate this with a script or CI, but this manual zip works fine to get started.

## 4. Create the DynamoDB table (optional)

Right now, the app is **stateless** and does not persist searches. You can deploy without DynamoDB. If you later add persistence, you will also need to configure AWS IAM permissions for the Lambda function.

## 5. Create the Lambda function

1. Go to **AWS Console → Lambda → Create function**.
2. Choose **Author from scratch**.
3. Runtime: **Node.js 18.x**.
4. Function name: `serper-search-console`.
5. Permissions: use a basic execution role (e.g. `AWSLambdaBasicExecutionRole`).
6. Create the function.

### Upload code

1. In the Lambda function page, under **Code**, choose **Upload from → .zip file**.
2. Upload `serper-search-console.zip` you created.
3. Set **Handler** to:

```text
lambda/handler.handler
```

### Environment variables

Under **Configuration → Environment variables**, add:

- `SERPER_API_KEY` – your Serper API key.

You can also add `NODE_ENV=production` if you like.

## 6. Configure an HTTP endpoint (API Gateway)

The Express app expects normal HTTP requests. You’ll front the Lambda with API Gateway.

### Option A: HTTP API (recommended, simpler)

1. In the Lambda function page, go to **Add trigger** → **API Gateway**.
2. Choose **Create an API**.
3. API type: **HTTP API**.
4. Security: 
   - For testing, choose **Open**.
   - Later you can add IAM or custom auth.
5. Finish the wizard.

API Gateway will give you a URL like:

```text
https://abc123.execute-api.us-east-1.amazonaws.com/
```

Open that URL in your browser; you should see the Serper Search Console UI.

## 7. How it works under the hood

- `lambda/handler.js` creates an Express app configured the same way as `index.js` (views, routes, static files).
- The app is wrapped by `serverless-http`, which:
  - receives API Gateway events,
  - translates them into standard Node.js HTTP requests,
  - feeds them to Express,
  - and returns the response back to API Gateway.

Local development is unchanged:

```bash
npm run dev
# or
npm start
```

Those still use `index.js`, which calls `app.listen` as before.

## 8. Updating the Lambda

When you change code:

1. Rebuild the zip:

```bash
cd /path/to/serper-server
rm -rf dist-lambda
mkdir dist-lambda
cp -R controllers public routes views index.js package.json package-lock.json .env dist-lambda/
cd dist-lambda
npm install --only=production
cp -R ../lambda ./lambda
zip -r serper-search-console.zip .
```

2. In the Lambda console, upload the new zip under **Code → Upload from → .zip file**.

The changes will be live for the next request.

## 9. Security best practices for this setup

Follow these steps to keep the deployment reasonably secure:

### 9.1 Transport security (HTTPS)

- API Gateway endpoints are **HTTPS by default**; do not expose the function directly.
- If you add a custom domain, use **AWS Certificate Manager (ACM)** to issue an SSL/TLS certificate and attach it to the API.

### 9.2 Serper API key / secrets

- **Do not commit `.env` to Git.**
  - Make sure `.env` is listed in `.gitignore` (it already is in this repo).
- In Lambda, set `SERPER_API_KEY` in **Configuration → Environment variables** instead of hard-coding it.
  - Lambda encrypts env vars at rest with KMS by default.
- For stronger isolation (optional):
  - Store the key in **AWS Secrets Manager** and load it at startup in `handler.js` or `searchController.js`.

### 9.3 Restrict who can call the API

By default, an HTTP API Gateway with **Open** auth is public. To limit access:

- For a quick private setup:
  - Use the **"Invoke with AWS IAM"** option and require AWS credentials to call the API (good for internal tools / scripts).
- For a user-facing app:
  - Add an **authorizer** (e.g. Cognito user pool authorizer) and require login before accessing the console.

If you start public and later want to lock it down, you can change the API security mode without changing code.

### 9.4 Protect against abuse / high usage

- In API Gateway, configure **throttling** (rate and burst limits) to prevent one client from exhausting your Serper quota.
- You can also:
  - Add basic checks in `searchController.js` (e.g. limiting max input size or maximum number of answers per run).

### 9.5 IAM permissions for the Lambda role

- Keep the Lambda execution role minimal:
  - Start with `AWSLambdaBasicExecutionRole` (CloudWatch logs only).
  - Only add more permissions if/when you use other AWS services (e.g., DynamoDB, S3).

Following these steps keeps your deployment reasonably secure while still simple to operate.
