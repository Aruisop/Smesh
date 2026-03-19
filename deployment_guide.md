# SentinelMesh Deployment Guide (Vercel + Railway)

This guide explains how to deploy the SentinelMesh project using a combination of **Vercel** (for the frontend dashboard) and **Railway** (for the backend microservices and Redis database). This setup avoids Render's strict free-tier limits on the number of concurrent services, allowing your entire architecture to run seamlessly.

## 📌 Architecture Overview
- **Railway**: Hosts a complete "Project Environment" containing your Managed Redis database, your Node.js API Gateway, and your 3 Python workers (`anomaly-detector`, `threat-engine`, `log-generator`).
- **Vercel**: Hosts the React/Vite dashboard (Frontend).

---

## Step 1: Provision Redis Database on Railway
Railway allows you to group multiple services inside a single "Project", meaning they can securely talk to each other over an internal network.

1. Go to your [Railway Dashboard](https://railway.app/) and click **New Project** -> **Empty Project**.
2. Inside your new project workspace, click **Create** -> **Database** -> **Add Redis**.
3. Wait a few seconds for Redis to deploy.
4. Click on the Redis service box, navigate to the **Variables** tab, and note the `REDIS_PRIVATE_URL` and `REDIS_PORT` (or you can use the built-in reference variables Railway provides later).

---

## Step 2: Deploy Backend Microservices (Workers) on Railway
You have three Python worker processes that continuously analyze logs and hunt for threats. They will be deployed alongside Redis in your workspace.

For **each** of the 3 services (`anomaly-detector`, `threat-engine`, `log-generator`), follow these steps precisely:

1. Inside your Railway project, click **New** -> **GitHub Repo**.
2. Select your `Sentinel-Mesh` repository.
3. Once the service appears in your workspace (it will likely fail the first build because it's looking at the root of the repo), click on the new service box.
4. Go to **Settings** -> **Build** -> **Root Directory**, and change it to the worker's subdirectory:
   - Example: `/services/anomaly-detector`
5. *Optional but recommended:* Rename the service box in the top-left corner to match the worker name (e.g., `Anomaly Detector`) so you don't confuse them.
6. Go to the **Variables** tab for the service, and add:
   - `REDIS_HOST`: Use the Reference Variable provided by typing `${{` and selecting your Redis host (or type it manually from Step 1).
   - `REDIS_PORT`: `6379`
   - *(For `log-generator` only)* add `LOG_INTERVAL`: `0.5`
7. Railway will automatically redeploy the service using the correct root directory Dockerfile.

---

## Step 3: Deploy the API Gateway on Railway
Your `api-gateway` acts as the bridge between your Vercel frontend and your internal Railway services.

1. Click **New** -> **GitHub Repo** and select `Sentinel-Mesh` again.
2. Click the new service, go to **Settings** -> **Build** -> **Root Directory**, and set it to `/services/api-gateway`.
3. Go to the **Networking** tab, and under **Public Networking**, click **Generate Domain**. Railway will give you a live URL (e.g., `https://api-gateway-production.up.railway.app`).
4. Go to the **Variables** tab and configure:

| Variable Name           | Description |
|-------------------------|-------------|
| `REDIS_HOST`            | `${{Redis.REDIS_HOST}}` (Use Railway's reference variable feature) |
| `REDIS_PORT`            | `6379` |
| `GITHUB_CLIENT_ID`      | From GitHub Developer Settings -> OAuth Apps |
| `GITHUB_CLIENT_SECRET`  | From GitHub Developer Settings -> OAuth Apps |
| `GITHUB_CALLBACK_URL`   | Your new Railway domain. Example: `https://api-gateway-production.up.railway.app/api/auth/github/callback` |
| `JWT_SECRET`            | A highly secure random string to secure your sessions |
| `JWT_EXPIRES_IN`        | `24h` |
| `FRONTEND_URL`          | Set a placeholder like `https://temp.com` for now. We will update this in Step 5. |

5. **Crucial GitHub OAuth Step:** Go to your GitHub Developer Settings, find your "OAuth App", and update the **Homepage URL** and **Authorization callback URL** to reflect your newly generated Railway API domain!

---

## Step 4: Deploy the Dashboard on Vercel
Vercel is optimized for React static sites and handles global edge caching effortlessly.

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New** -> **Project**.
2. Import the `Sentinel-Mesh` GitHub repository.
3. **Important:** Edit the **Root Directory** and select `frontend/dashboard`.
4. Vercel will automatically detect `Vite`/`React`.
5. Open the **Environment Variables** dropdown and add your Backend API URL:
   - **Name:** `VITE_API_BASE_URL` (or your exact `.env` key identifier)
   - **Value:** Your live Railway API Gateway URL (e.g., `https://api-gateway-production.up.railway.app`)
6. Click **Deploy**. Vercel will build the frontend and give you a public URL (e.g., `https://sentinel-dashboard.vercel.app`).

---

## Step 5: Tying It All Together

Your frontend is live on Vercel, and your backend is live on Railway. Now, tie them together so they can interact securely without CORS issues.

1. Go back to your **Railway Dashboard** and click on your `api-gateway` service.
2. Navigate to the **Variables** tab.
3. Edit the `FRONTEND_URL` variable to be your exact Vercel URL (e.g., `https://sentinel-dashboard.vercel.app`). Make sure you do NOT include a trailing slash!
4. **Deploy** (Railway usually triggers a redeploy automatically when variables change).

## Checklist for a Successful "Go Live":
- [ ] Redis is successfully provisioned inside your Railway Project.
- [ ] You have 4 different GitHub Repo services in your Railway Project, each pointing to a different `Root Directory`.
- [ ] Vercel has successfully built the React app, with the `VITE_...` environment variable matching the Railway API domain.
- [ ] The `GITHUB_CALLBACK_URL` is pointing to your Railway Web Service domain.
- [ ] The `FRONTEND_URL` on Railway is pointing exactly to your Vercel domain.

You can now visit your Vercel URL, click "Login with GitHub", and your platform will securely authenticate and stream threat intelligence natives!
