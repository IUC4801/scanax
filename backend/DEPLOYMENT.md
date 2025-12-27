# Free Backend Hosting Guide for Scanax

## 🚀 Quick Deploy Options (100% FREE)

### Option 1: Render.com (Recommended - Easiest)

**Pros:** Free tier, auto-deploys from GitHub, HTTPS included, no credit card required initially

1. **Create a Render Account**
   - Go to https://render.com
   - Sign up with GitHub

2. **Push Backend to GitHub**
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

3. **Deploy on Render**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder (or root if you pushed only backend)
   - Settings:
     - **Name:** scanax-backend
     - **Runtime:** Python 3
     - **Build Command:** `pip install -r requirements.txt`
     - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Plan:** Free
   - Add Environment Variable:
     - **Key:** `GROQ_API_KEY`
     - **Value:** Your Groq API key
   - Click "Create Web Service"

4. **Get Your Backend URL**
   - After deployment, copy the URL: `https://scanax-backend-XXXX.onrender.com`
   - Update in VS Code: Settings → Scanax → Backend URL

**Free Tier Limits:**
- ✅ 750 hours/month
- ✅ Auto-sleep after 15 min inactivity
- ✅ 0.5 GB RAM, 0.5 CPU
- ⚠️ First request after sleep takes ~30 seconds

---

### Option 2: Railway.app

**Pros:** $5 free credit monthly, fast cold starts

1. **Create Railway Account**
   - Go to https://railway.app
   - Sign up with GitHub

2. **Deploy**
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your backend repository
   - Railway auto-detects Python
   - Add environment variable: `GROQ_API_KEY`
   - Click "Deploy"

3. **Generate Domain**
   - Go to Settings → Generate Domain
   - Copy URL: `https://scanax-backend-production.up.railway.app`

**Free Tier:**
- ✅ $5/month credit (≈100 hours)
- ✅ Fast wake-up
- ⚠️ Credit card required for verification

---

### Option 3: Fly.io

**Pros:** Generous free tier, good performance

1. **Install Fly CLI**
   ```bash
   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   
   # Mac/Linux
   curl -L https://fly.io/install.sh | sh
   ```

2. **Deploy**
   ```bash
   cd backend
   fly auth signup
   fly launch
   # Follow prompts, choose free tier
   fly secrets set GROQ_API_KEY=your_key_here
   fly deploy
   ```

3. **Get URL**
   - URL: `https://scanax-backend.fly.dev`

**Free Tier:**
- ✅ 3 shared-cpu-1x 256mb VMs
- ✅ 160GB outbound data
- ✅ Always on (no sleep)

---

### Option 4: Google Cloud Run

**Pros:** Pay-per-use, generous free tier

1. **Create GCP Project**
   - Go to https://console.cloud.google.com
   - Create new project

2. **Install gcloud CLI**
   - Download from https://cloud.google.com/sdk/docs/install

3. **Deploy**
   ```bash
   cd backend
   gcloud run deploy scanax-backend \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars GROQ_API_KEY=your_key_here
   ```

**Free Tier:**
- ✅ 2 million requests/month
- ✅ 360,000 GB-seconds memory
- ✅ 180,000 vCPU-seconds
- ⚠️ Credit card required

---

## 📝 After Deployment Checklist

1. **Test Your Backend**
   ```bash
   curl https://your-backend-url.com/health
   # Should return: {"status":"ok"}
   ```

2. **Update Extension Settings**
   - Open VS Code Settings (Ctrl+,)
   - Search for "Scanax Backend"
   - Set URL to your deployed backend
   - **Example:** `https://scanax-backend-abc123.onrender.com`

3. **Test Scanning**
   - Open any code file
   - Press Ctrl+Shift+S
   - Check for vulnerabilities

---

## 🔧 Troubleshooting

### "Backend not responding"
- Check if service is awake (Render sleeps after 15 min)
- First request after sleep takes 30-60 seconds
- Verify GROQ_API_KEY is set correctly

### "CORS errors"
- Backend already includes CORS headers
- Check if URL is correct in settings

### "Rate limit exceeded"
- Groq free tier: 30 requests/minute
- Consider upgrading Groq plan if needed

---

## 💰 Cost Comparison

| Service | Free Tier | Limitations | Best For |
|---------|-----------|-------------|----------|
| **Render** | ✅ Forever free | Sleeps after 15 min | Most users |
| **Railway** | ✅ $5/month credit | ~100 hours/month | Active development |
| **Fly.io** | ✅ Forever free | 3 VMs limit | Always-on needs |
| **Cloud Run** | ✅ 2M requests/month | Cold starts | High traffic |

---

## 🎯 Recommended: Render.com

For most users, **Render.com** is the best choice:
- ✅ No credit card required
- ✅ Auto-deploys from GitHub
- ✅ HTTPS included
- ✅ Easy setup
- ⚠️ 30-60s wake-up after sleep (acceptable for security scanning)

---

## 🔐 Security Notes

- Never commit `.env` file to GitHub
- Use environment variables for API keys
- Rotate keys regularly
- Monitor usage in Groq dashboard

---

**Need help?** Open an issue on GitHub with your deployment platform and error message.
