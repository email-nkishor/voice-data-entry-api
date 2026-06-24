# Voice Data Entry API

**REST API for Voice Data Entry — Student Module Sync & Institute SIS**

यह प्रोजेक्ट एक **Voice Data Entry REST API** है जो संस्थान (Institute) के Student Information System (SIS) को सपोर्ट करता है। Angular / Mobile UI इस API से जुड़कर छात्र प्रवेश (admission), समूह (groups), lookup डेटा, और **offline sync** प्रबंधित कर सकता है। आवाज़ से डेटा भरने के लिए **OpenAI Whisper** (transcription) और **Google Gemini** (field extraction) APIs का उपयोग होता है।

---

## Table of Contents / विषय सूची

1. [Project Overview](#project-overview--परियोजना-विवरण)
2. [Features / Functionality](#features--functionality--कार्यक्षमता)
3. [Tech Stack](#tech-stack)
4. [Project Structure & Modules](#project-structure--modules--प्रोजेक्ट-संरचना)
5. [Default Users](#default-users--डिफ़ॉल्ट-उपयोगकर्ता)
6. [API Endpoints (20 Total)](#api-endpoints-20-total)
7. [How to Run Locally](#how-to-run-locally--लोकल-पर-कैसे-चलाएँ)
8. [Environment Variables](#environment-variables)
9. [How Modules & API Work Together](#how-modules--api-work-together--मॉड्यूल-और-api-कैसे-काम-करते-हैं)
10. [Deploy: GitHub → Render](#deploy-github--render--डिप्लॉय-कैसे-करें)

---

## Project Overview / परियोजना विवरण

| | English | हिंदी |
|---|---|---|
| **Purpose** | Backend API for institute student management with voice-based data entry and mobile/web sync. | संस्थान के छात्र प्रबंधन के लिए बैकएंड API — आवाज़ से डेटा एंट्री और मोबाइल/वेब सिंक के साथ। |
| **Frontend** | Angular app (deployed on Vercel) connects to this API. | Angular ऐप (Vercel पर) इस API से जुड़ता है। |
| **Database** | JSON file (default) or SQLite — configurable via `DB_DRIVER`. | JSON फ़ाइल (डिफ़ॉल्ट) या SQLite — `DB_DRIVER` से सेट करें। |
| **Auth** | JWT-based authentication with role-based access control. | JWT आधारित प्रमाणीकरण, भूमिका-आधारित पहुँच नियंत्रण। |

---

## Features / Functionality / कार्यक्षमता

### English

- **Authentication** — Login with email/password, JWT token (7-day expiry), `/me` profile endpoint.
- **Student Management** — CRUD for students, admission approval, dashboard stats, activity log.
- **Student Groups** — Organize students into batches/groups (e.g. MCA Batch 2026).
- **Lookups** — Dropdown data for class, grade, section, status, fee status.
- **Offline Sync** — Mobile/web clients push queued changes (`/sync/push`) and pull server updates (`/sync/pull`).
- **Voice Data Entry** — Transcribe audio via OpenAI Whisper; extract form fields via Google Gemini.
- **Role-Based Access** — Three roles: `admin`, `admission_clerk`, `teacher` with different permissions.
- **CORS** — Configurable origins for local dev and Vercel production UI.

### हिंदी

- **प्रमाणीकरण (Authentication)** — ईमेल/पासवर्ड से लॉगिन, JWT टोकन (7 दिन), `/me` प्रोफ़ाइल।
- **छात्र प्रबंधन** — छात्रों का CRUD, प्रवेश स्वीकृति, डैशबोर्ड आँकड़े, गतिविधि लॉग।
- **छात्र समूह** — बैच/ग्रुप में छात्र व्यवस्थित करें (जैसे MCA Batch 2026)।
- **Lookups** — कक्षा, ग्रेड, सेक्शन, स्थिति, फीस स्थिति के लिए ड्रॉपडाउन डेटा।
- **Offline Sync** — मोबाइल/वेब क्लाइंट कतारबद्ध बदलाव push करते हैं और सर्वर अपडेट pull करते हैं।
- **Voice Data Entry** — OpenAI Whisper से ऑडियो ट्रांसक्राइब; Google Gemini से फ़ॉर्म फ़ील्ड निकालें।
- **भूमिका-आधारित पहुँच** — तीन भूमिकाएँ: `admin`, `admission_clerk`, `teacher`।
- **CORS** — लोकल डेव और Vercel production UI के लिए configurable origins।

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express.js |
| Language | TypeScript |
| Database | JSON file / SQLite (`better-sqlite3`) |
| Auth | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| File Upload | Multer (audio for Whisper) |
| Config | dotenv |

---

## Project Structure & Modules / प्रोजेक्ट संरचना

```
voice-data-entry-api/
├── src/
│   ├── index.ts              # Server entry point
│   ├── app.ts                # Express app, routes, CORS, health check
│   ├── config.ts             # Port, JWT, DB, CORS from env
│   ├── types.ts              # Shared TypeScript interfaces
│   ├── middleware/
│   │   └── auth.middleware.ts    # JWT verify + role guard
│   ├── routes/               # HTTP route handlers
│   │   ├── auth.routes.ts
│   │   ├── students.routes.ts
│   │   ├── student-groups.routes.ts
│   │   ├── sync.routes.ts
│   │   ├── speech.routes.ts
│   │   └── lookups.routes.ts
│   ├── services/             # Business logic
│   │   ├── auth.service.ts
│   │   ├── student.service.ts
│   │   ├── sync.service.ts
│   │   ├── lookups.service.ts
│   │   └── speech.service.ts
│   └── db/                   # Data access layer
│       ├── database.ts
│       ├── repository.ts
│       ├── json-repository.ts
│       ├── sqlite-repository.ts
│       └── schema.ts
├── data/                     # Local DB files (gitignored)
├── dist/                     # Compiled JS (gitignored)
├── package.json
└── tsconfig.json
```

### Module Summary / मॉड्यूल सारांश

| Module | Route Prefix | Description (EN) | विवरण (HI) |
|--------|-------------|------------------|------------|
| **Auth** | `/api/auth` | Login, current user | लॉगिन, वर्तमान उपयोगकर्ता |
| **Students** | `/api/students` | Student CRUD, stats, activities, approve | छात्र CRUD, आँकड़े, गतिविधि, स्वीकृति |
| **Student Groups** | `/api/student-groups` | Batch/group management | बैच/समूह प्रबंधन |
| **Sync** | `/api/sync` | Offline push/pull for mobile | मोबाइल offline सिंक |
| **Speech** | `/api/speech` | Whisper + Gemini voice entry | आवाज़ से डेटा एंट्री |
| **Lookups** | `/api/lookups` | Form dropdown options | फ़ॉर्म ड्रॉपडाउन विकल्प |
| **Health** | `/api/health` | Server & DB status (no auth) | सर्वर स्थिति (बिना auth) |

---

## Default Users / डिफ़ॉल्ट उपयोगकर्ता

पहली बार सर्वर start होने पर (या पहली login पर) ये **3 डिफ़ॉल्ट users** automatically बनते हैं:

| Role | Email | Password | Permissions |
|------|-------|----------|-------------|
| **Admin** | `admin@institute.local` | `admin123` | Full access — create/update/delete students, groups, approve admissions |
| **Admission Clerk** | `clerk@institute.local` | `clerk123` | Create/update students, approve admissions, manage groups |
| **Teacher** | `teacher@institute.local` | `teacher123` | Read-only access to students, stats, lookups |

> **Production warning:** Change `JWT_SECRET` and default passwords before deploying to production.

### Default Student Groups

| Group | Description |
|-------|-------------|
| General Admission | Default group |
| MCA Batch 2026 | Master of Computer Applications |
| BCA Batch 2026 | Bachelor of Computer Applications |

---

## API Endpoints (20 Total)

Base URL: `http://localhost:3000` (local) or `https://voice-data-entry-api.onrender.com` (production)

| # | Method | Endpoint | Auth | Role | Description |
|---|--------|----------|------|------|-------------|
| 1 | `GET` | `/api/health` | No | — | Health check & DB driver info |
| 2 | `POST` | `/api/auth/login` | No | — | Login → returns JWT token |
| 3 | `GET` | `/api/auth/me` | Yes | Any | Current logged-in user |
| 4 | `GET` | `/api/students` | Yes | Any | List students (`?groupId=`) |
| 5 | `GET` | `/api/students/stats` | Yes | Any | Dashboard statistics |
| 6 | `GET` | `/api/students/activities` | Yes | Any | Activity log (`?studentId=&limit=`) |
| 7 | `GET` | `/api/students/:id` | Yes | Any | Get single student |
| 8 | `POST` | `/api/students` | Yes | admin, clerk | Create student |
| 9 | `PUT` | `/api/students/:id` | Yes | admin, clerk | Update student |
| 10 | `DELETE` | `/api/students/:id` | Yes | admin | Delete student |
| 11 | `POST` | `/api/students/:id/approve` | Yes | admin, clerk | Approve admission |
| 12 | `GET` | `/api/student-groups` | Yes | Any | List groups |
| 13 | `POST` | `/api/student-groups` | Yes | admin, clerk | Create group |
| 14 | `DELETE` | `/api/student-groups/:id` | Yes | admin | Delete group |
| 15 | `POST` | `/api/sync/push` | Yes | Any | Push offline changes |
| 16 | `GET` | `/api/sync/pull` | Yes | Any | Pull server changes (`?since=`) |
| 17 | `GET` | `/api/lookups` | Yes | Any | All lookup categories |
| 18 | `GET` | `/api/lookups/:category` | Yes | Any | Single category (class, grade, etc.) |
| 19 | `POST` | `/api/speech/whisper` | Yes | Any | Transcribe audio (multipart) |
| 20 | `POST` | `/api/speech/gemini-extract` | Yes | Any | Extract fields from transcript |

### Auth Header

Protected endpoints require:

```
Authorization: Bearer <your-jwt-token>
```

### Example: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@institute.local","password":"admin123"}'
```

Response:

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "admin@institute.local",
    "name": "Institute Admin",
    "role": "admin"
  }
}
```

---

## How to Run Locally / लोकल पर कैसे चलाएँ

### Prerequisites / आवश्यकताएँ

- **Node.js** 18+ (recommended 20+)
- **npm**

### Steps / चरण

```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/voice-data-entry-api.git
cd voice-data-entry-api

# 2. Install dependencies
npm install

# 3. (Optional) Create .env file — see Environment Variables section
cp .env.example .env   # if available, or create manually

# 4. Development mode (hot reload)
npm run dev

# 5. Production build & run
npm run build
npm start
```

Server starts at: **http://localhost:3000**

Verify:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "dbDriver": "json",
  "timestamp": "2026-06-24T..."
}
```

### Connect Angular UI (local)

Angular app `environment.ts` should point to:

```typescript
apiUrl: 'http://localhost:3000/api'
```

CORS default allows `http://localhost:4200`.

---

## Environment Variables

Create a `.env` file in the project root:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT signing key — **change in production** |
| `DB_DRIVER` | `json` | `json` or `sqlite` |
| `DB_PATH` | `data/institute.db` or `data/institute.sqlite` | Database file path |
| `CORS_ORIGIN` | `http://localhost:4200,https://your-project.vercel.app` | Comma-separated allowed origins |

Example `.env`:

```env
PORT=3000
JWT_SECRET=your-strong-secret-here
DB_DRIVER=sqlite
CORS_ORIGIN=http://localhost:4200,https://your-project.vercel.app
```

---

## How Modules & API Work Together / मॉड्यूल और API कैसे काम करते हैं

### Request Flow / अनुरोध प्रवाह

```
Client (Angular/Mobile)
    │
    ▼
CORS Middleware
    │
    ▼
Express Router  →  /api/auth, /api/students, ...
    │
    ▼
authMiddleware  →  JWT verify (protected routes)
    │
    ▼
requireRoles    →  admin / admission_clerk / teacher check
    │
    ▼
Service Layer   →  Business logic (student.service, sync.service, ...)
    │
    ▼
Repository      →  JSON or SQLite database
```

### Sync Module (Offline Support)

1. Mobile/web app stores changes locally when offline.
2. When online, client calls `POST /api/sync/push` with queued items (`student`, `studentGroup` entities).
3. Server processes each item (create/update/delete) and returns success/failure per item.
4. Client calls `GET /api/sync/pull?since=<timestamp>` to fetch server-side changes.

### Speech Module (Voice Entry)

1. User records audio in the UI.
2. UI sends audio to `POST /api/speech/whisper` with OpenAI API key → gets transcript.
3. UI sends transcript to `POST /api/speech/gemini-extract` with Gemini API key + column hints → gets structured form fields.
4. UI pre-fills student form with extracted data.

### Role Permissions Summary

| Action | admin | admission_clerk | teacher |
|--------|:-----:|:---------------:|:-------:|
| View students/stats/lookups | ✅ | ✅ | ✅ |
| Create/update students | ✅ | ✅ | ❌ |
| Approve admission | ✅ | ✅ | ❌ |
| Delete students | ✅ | ❌ | ❌ |
| Manage groups (create) | ✅ | ✅ | ❌ |
| Delete groups | ✅ | ❌ | ❌ |
| Sync push/pull | ✅ | ✅ | ✅ |
| Speech APIs | ✅ | ✅ | ✅ |

---

## Deploy: GitHub → Render / डिप्लॉय कैसे करें

### Step 1: Push to GitHub

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit: Voice Data Entry API"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/voice-data-entry-api.git
git branch -M main
git push -u origin main
```

> Ensure `.gitignore` excludes `node_modules/`, `dist/`, `.env`, and `data/*.db`.

### Step 2: Create Render Web Service

1. Go to [https://render.com](https://render.com) and sign in.
2. Click **New +** → **Web Service**.
3. Connect your **GitHub** account and select `voice-data-entry-api` repository.
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `voice-data-entry-api` |
| **Region** | Choose nearest (e.g. Singapore / Oregon) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or paid for production) |

### Step 3: Set Environment Variables on Render

In Render dashboard → **Environment** tab:

| Key | Value |
|-----|-------|
| `NODE_VERSION` | `20` |
| `JWT_SECRET` | Strong random secret (generate one) |
| `DB_DRIVER` | `sqlite` |
| `CORS_ORIGIN` | `https://your-project.vercel.app` |

> Replace `https://your-project.vercel.app` with your actual Vercel deployment URL.

### Step 4: Deploy

Click **Create Web Service**. Render will:

1. Clone your GitHub repo
2. Run `npm install && npm run build`
3. Start with `npm start`
4. Assign a URL like `https://voice-data-entry-api.onrender.com`

### Step 5: Verify Deployment

```bash
curl https://voice-data-entry-api.onrender.com/api/health
```

### Step 6: Connect Angular UI (Vercel)

In Angular `environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://voice-data-entry-api.onrender.com/api',
};
```

Redeploy Angular app on Vercel after this change.

### Deployment Architecture

```
┌─────────────────┐         ┌──────────────────────┐
│  Angular UI     │  HTTPS  │  Voice Data Entry    │
│  (Vercel)       │ ──────► │  API (Render)        │
│  vercel.app     │         │  onrender.com        │
└─────────────────┘         └──────────┬───────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │  SQLite / JSON  │
                            │  (data/ folder) │
                            └─────────────────┘
```

### Render Notes / महत्वपूर्ण नोट्स

- **Free tier:** Service sleeps after inactivity; first request may be slow (~30s cold start).
- **Persistent disk:** Free tier does not persist SQLite data across redeploys. For production, use Render persistent disk or external DB.
- **HTTPS:** Render provides SSL automatically.
- **Logs:** View real-time logs in Render dashboard → **Logs** tab.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (`tsx watch`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production server |

---

## License

POC / Internal use — traQtion Mobile Voice Data Entry project.
