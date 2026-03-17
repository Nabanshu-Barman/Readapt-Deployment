# Readapt Free Deployment Guide (Frontend + Backend + Extension)

This guide gives you a fully free deployment path for public access.

## Important reality checks

1. Truly free cloud GPU hosting with always-on performance is not available.
2. To keep your current fast inference speed, run the backend on your own NVIDIA laptop GPU and expose it securely via a tunnel.
3. Chrome Web Store publishing has a one-time developer fee. If you need zero cost, use unpacked extension install.

## Final architecture (free)

1. Frontend: Vercel free tier
2. Backend: your local Windows GPU machine
3. Public backend URL: Cloudflare Tunnel free tier
4. Extension: unpacked install (free) or Chrome Web Store (paid one-time)

## 1) Backend preparation on Windows GPU machine

From workspace root:

```powershell
cd "C:\Users\naban\Downloads\Hackathon\Readapt - Work\backend"
```

Create `.env` in backend folder from `.env.example`.

Set values in `.env`:

```env
CORS_ORIGINS=https://app.yourdomain.com,https://your-vercel-project.vercel.app
TESSERACT_CMD=C:\\Users\\naban\\Downloads\\Hackathon\\utilities\\tesseract.exe
GAZE_FRAME_STRIDE=8
STT_MODEL_NAME=large-v3
STT_BEAM_SIZE=5
STT_COMPUTE_TYPE=float16
STT_DEFAULT_LANGUAGE=en
STT_VAD_FILTER=0
```

Start backend using your existing GPU environment:

```powershell
conda activate readapt-gpu
cd "C:\Users\naban\Downloads\Hackathon\Readapt - Work\backend"
uvicorn main:app --host 0.0.0.0 --port 8000
```

Notes:

1. Do not use `--reload` in deployment mode.
2. Keep this machine on and connected for the public app to work.

## 2) Expose backend for free using Cloudflare Tunnel

Install cloudflared on Windows.

Authenticate once:

```powershell
cloudflared tunnel login
```

Create tunnel:

```powershell
cloudflared tunnel create readapt-backend
```

Route DNS (replace with your domain):

```powershell
cloudflared tunnel route dns readapt-backend api.yourdomain.com
```

Create config file at `%USERPROFILE%\\.cloudflared\\config.yml`:

```yml
tunnel: readapt-backend
credentials-file: C:\\Users\\YOUR_USER\\.cloudflared\\<TUNNEL_ID>.json
ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

Run tunnel:

```powershell
cloudflared tunnel run readapt-backend
```

Now your backend is publicly reachable at:

`https://api.yourdomain.com`

## 3) Deploy frontend for free on Vercel

From workspace root:

```powershell
cd "C:\Users\naban\Downloads\Hackathon\Readapt - Work\frontend"
pnpm install
pnpm build
```

Deploy with Vercel:

1. Push repo to GitHub.
2. Import project in Vercel.
3. Set project root to `frontend`.
4. Add environment variables:

```env
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
BACKEND_URL=https://api.yourdomain.com
GEMINI_API_KEY=your_key_if_used
```

5. Deploy.
6. Attach custom domain like `app.yourdomain.com`.

## 4) Backend CORS update

After you know your Vercel domain, update backend `.env`:

```env
CORS_ORIGINS=https://app.yourdomain.com,https://your-vercel-project.vercel.app
```

Restart backend process and tunnel.

## 5) Free browser extension deployment

### Option A: Zero cost (recommended for free)

Load unpacked extension:

1. Open Chrome at `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select folder: `frontend/extension`.

### Option B: Public store listing

Chrome Web Store requires one-time developer fee.

## 6) End-to-end validation checklist

1. Open deployed frontend URL.
2. Test Dyslexia quiz submit.
3. Test OCR on Dyslexia, ADHD, Low Vision paste pages.
4. Test ADHD quiz video diagnose.
5. Test ADHD monitor mode in Adapt page.
6. Test voice transcription in custom pages.
7. Click Adapt in real time and verify extension applies on another site.

## 7) Free deployment limitations

1. Backend is only online while your laptop is on.
2. If laptop sleeps, API goes offline.
3. Public traffic depends on your home/office network.
4. Cloud GPU with always-on low latency is generally paid.

## 8) If you want always-on cloud later

Move backend to a paid GPU host and keep frontend on Vercel. This is the only practical way to guarantee your current speed for all users 24/7.
