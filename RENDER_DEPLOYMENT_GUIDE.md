# Render.com Node.js/TypeScript Backend Deployment Guide & Troubleshooting Handbook

This guide documents the mandatory configurations, pitfalls, and step-by-step solutions discovered while deploying the Node.js/Express/TypeScript backend to Render.com and connecting it with the Flutter mobile application.

---

## 📌 1. Mandatory Pre-Deployment Checklist (Before Deploying)

Before creating a Web Service on Render, ensure the following are configured in your repository:

### A. `package.json` Dependencies
- **Move TypeScript & Types to `dependencies`**: Cloud providers (like Render) running in `NODE_ENV=production` will skip `devDependencies` during `npm install`. Always ensure `typescript` and all `@types/*` packages (e.g. `@types/express`, `@types/node`, `@types/bcrypt`, etc.) are in `"dependencies"`:
  ```json
  "dependencies": {
    "typescript": "^5.5.3",
    "@types/express": "^4.17.21",
    "@types/node": "^25.9.1",
    ...
  }
  ```

### B. Build & Start Commands in Render Settings
- **Build Command:** `npm install && npm run build` (Ensures TypeScript compiles to `dist/server.js`)
- **Start Command:** `npm start` (or `node dist/server.js`)

### C. Git & Push Protection
- Never commit `.env` or raw service account JSON files (`firebase-service-account.json`).
- Ensure `.gitignore` includes:
  ```gitignore
  .env
  firebase-service-account.json
  *.service-account.json
  ```

---

## ⚠️ 2. Issues Encountered & Exact Solutions

Here is the complete catalog of all errors encountered during deployment and how each was fixed:

### Issue 1: GitHub Push Protection Blocked (GH013 Secrets Violation)
- **Symptom:** `git push` fails with `Push cannot contain secrets (Google Cloud Service Account Credentials, Stripe Key)`.
- **Cause:** Raw credentials committed to Git history.
- **Fix:**
  1. Add secret files to `.gitignore`.
  2. Remove from Git tracking without deleting local file: `git rm --cached firebase-service-account.json`.
  3. Load secret keys dynamically via `process.env`.
  4. Amend commit: `git commit --amend --no-edit` and push.

---

### Issue 2: `Cannot find module '/opt/render/project/src/dist/server.js'`
- **Symptom:** Render build succeeds in 6 seconds, but server immediately crashes on startup.
- **Cause:** Render's default Build Command was set to `npm install` only, so `tsc` was never run and `dist/` directory was never created.
- **Fix:** In Render Dashboard -> **Settings** -> **Build Command**, set:
  ```bash
  npm install && npm run build
  ```

---

### Issue 3: TypeScript Compilation Errors in Production Build (`error TS7016: Could not find declaration file for 'express'`)
- **Symptom:** `tsc` fails during `npm run build` on Render with dozens of missing type errors, even though it works locally.
- **Cause:** When `NODE_ENV=production`, `npm install` ignores `devDependencies` where `@types/*` were located.
- **Fix:** Move `typescript` and all `@types/*` into `"dependencies"` in `package.json`.

---

### Issue 4: `Invalid environment configuration: API_PUBLIC_URL: Required`
- **Symptom:** Server crashes on startup complaining `API_PUBLIC_URL` is missing.
- **Fix:** In `src/config/index.ts`, add fallback to Render's built-in `RENDER_EXTERNAL_URL`:
  ```ts
  API_PUBLIC_URL: z.preprocess(
    val => val || process.env.RENDER_EXTERNAL_URL,
    z.string().url(),
  ),
  ```

---

### Issue 5: `CORS_ORIGIN: CORS_ORIGIN cannot contain * in production`
- **Symptom:** Server crashes in production because `CORS_ORIGIN` had a strict validator blocking `*`.
- **Fix:** 
  1. Allow `*` in `config/index.ts` validator.
  2. Update `app.ts` CORS middleware to handle `*`:
  ```ts
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.cors_origin.includes('*') || config.cors_origin.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by CORS'));
      },
    }),
  );
  ```

---

### Issue 6: `bad auth : authentication failed` (MongoDB Atlas)
- **Symptom:** Mongoose fails to connect to MongoDB Atlas.
- **Cause:** Username or password in `DATABASE_URL` is incorrect or contains un-encoded special characters.
- **Fix:** In MongoDB Atlas -> **Database Access** -> **Database Users**, create a clean password without special characters (e.g. `ClosetePass2026`), and update `DATABASE_URL`.

---

### Issue 7: `querySrv ENOTFOUND _mongodb._tcp.cluster0.xxxx.mongodb.net`
- **Symptom:** DNS resolution fails for MongoDB cluster.
- **Cause:** Literal placeholder `xxxx` used instead of actual MongoDB Atlas cluster subdomain (e.g. `13kj5qw`).
- **Fix:** Copy the real cluster URI from MongoDB Atlas **Connect** -> **Drivers** (e.g. `cluster0.13kj5qw.mongodb.net`).

---

### Issue 8: `option closete is not supported` (MongoDB Connection URI Error)
- **Symptom:** Mongoose startup fails with `option closete is not supported`.
- **Cause:** Database name was placed after query parameters (e.g. `...mongodb.net/?closete&retryWrites=true`), causing MongoDB driver to treat `closete` as a connection option instead of the database name.
- **Fix:** Place `/closete` **before** the `?`:
  ```text
  ✅ mongodb+srv://username:password@cluster0.13kj5qw.mongodb.net/closete?retryWrites=true&w=majority
  ❌ mongodb+srv://username:password@cluster0.13kj5qw.mongodb.net/?closete&retryWrites=true
  ```

---

### Issue 9: `connect ENETUNREACH 2607:f8b0:...:465` (IPv6 Unreachable on Render)
- **Symptom:** Nodemailer fails to connect to Gmail SMTP with `ENETUNREACH` pointing to an IPv6 address (`2607:f8b0:...`).
- **Cause:** Node.js resolves DNS to IPv6 by default, but Render free containers lack outbound IPv6 routing.
- **Fix:** Force IPv4 resolution in `server.ts` and in Nodemailer's socket lookup:
  ```ts
  // In server.ts and emailHelper.ts
  dns.setDefaultResultOrder('ipv4first');

  // In nodemailer.createTransport:
  lookup: (hostname: string, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    dns.lookup(hostname, { family: 4 }, cb);
  },
  ```

---

### Issue 10: `Connection timeout` on SMTP Ports (Render Free Tier Outbound SMTP Block)
- **Symptom:** Nodemailer times out on ports 25, 465, and 587.
- **Cause:** **Render Free Tier blocks all direct outbound SMTP connections** to prevent spam abuse.
- **Solutions:**
  1. **For Testing / TestFlight:** Use Test OTP (`TEST_FIXED_OTP_EMAIL` & `TEST_FIXED_OTP_CODE`), which bypasses email sending entirely and instantly logs in.
  2. **For Production Email Delivery:** Use an HTTP REST API provider (Port 443 HTTPS is never blocked):
     - **Resend** (resend.com - free tier: 3,000 emails/month, 100/day)
     - **Brevo** (brevo.com - free tier: 300 emails/day)
     - **SendGrid / Mailgun**

---

### Issue 11: Apple / iOS OTP Autofill Showing Random Hex String (`1438CDAF` / `7FF02A4C`)
- **Symptom:** When receiving OTP emails on iOS, the keyboard autofill bar suggests `From Mail: 1438CDAF` instead of the 5-digit OTP (`71573`).
- **Cause:** Backend appended a random UUID/hex string to the email subject: `Your Closeté sign-in code 1438CDAF`. iOS regex detected `1438CDAF` right after "sign-in code" and mistook it for the OTP.
- **Fix:** In `emailTemplate.ts`, format subject according to Apple/Google OTP standards:
  ```ts
  subject: `${values.otp} is your ${projectName} sign-in code`
  ```

---

### Issue 12: Multiple "Session Expired" Snackbars Spammed on App Launch
- **Symptom:** Switching base URL from local to cloud backend caused 5–6 repeated red "Session Expired: Session reset" snackbars and route resets.
- **Cause:** When switching databases, existing local tokens become invalid (401). When the app fired 5 parallel initial requests (`/products`, `/profile`, `/notifications`, `/wishlist`, etc.), all 5 returned 401 simultaneously, triggering `_forceLogout()` 5 times.
- **Fix:** Add a single-flight guard `_isLoggingOut` in `ApiClient`:
  ```dart
  static bool _isLoggingOut = false;

  void _forceLogout() {
    if (_isLoggingOut) return;
    _isLoggingOut = true;

    StorageService.clearAll();
    Get.offAllNamed(AppRoutes.splash);
    Helpers.showError('Session reset.', title: 'Session Expired');

    Future.delayed(const Duration(seconds: 3), () {
      _isLoggingOut = false;
    });
  }
  ```

---

## 📋 3. Render Environment Variables Reference

When creating a new Web Service on Render, paste this template into **Environment Variables**:

```env
NODE_ENV=production
PORT=5000
IP_ADDRESS=0.0.0.0
CORS_ORIGIN=*
PROJECT_NAME=Closeté
BCRYPT_SALT_ROUNDS=12

# MongoDB Atlas URI (Format: ...mongodb.net/<dbname>?retryWrites=true&w=majority)
DATABASE_URL=mongodb+srv://<username>:<password>@cluster0.<cluster_id>.mongodb.net/closete?retryWrites=true&w=majority

# JWT & Session Secrets (Must be min 32 chars)
JWT_SECRET=your_super_secret_jwt_key_min_32_characters_long
JWT_EXPIRE_IN=1d
JWT_REFRESH_SECRET=your_super_refresh_jwt_key_min_32_characters_long
JWT_REFRESH_EXPIRE_IN=30d
SESSION_SECRET=your_super_session_key_min_32_characters_long

# Super Admin Account
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=YourAdminPassword123!@

# Stripe Payment Gateway
STRIPE_SECRET_KEY=sk_test_...
WEBHOOK_SECRET=whsec_...
STRIPE_CURRENCY=aed

# AWS S3 Cloud Storage
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your_bucket_name
AWS_CLOUDFRONT_DOMAIN=https://cdn.example.com

# Firebase Push Notifications (Base64 encoded service account JSON)
FIREBASE_SERVICE_ACCOUNT_KEY_BASE64=ewogICJ0eXBl...

# Test OTP (For TestFlight & QA without SMTP)
TEST_FIXED_OTP_EMAIL=mdbayazid131.dev@gmail.com
TEST_FIXED_OTP_CODE=12345
```

---

## 📱 4. Flutter App Configuration (Connecting to Render)

1. In `cpk1989/.env`:
   ```env
   API_BASE_URL=https://smart-shopping-mall.onrender.com/api/v1
   ```
2. In `lib/config/env_config.dart`:
   ```dart
   static String _apiBaseUrl = const String.fromEnvironment(
     'API_BASE_URL',
     defaultValue: 'https://smart-shopping-mall.onrender.com/api/v1',
   );
   ```
3. Update version in `pubspec.yaml` (e.g. `version: 1.0.8+15`) before uploading new IPA to TestFlight / App Store Connect.
