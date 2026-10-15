# SMTP Email Integration: Self-Service Password Recovery & Admin Registration Notifications

Integrates a robust SMTP mail delivery service with fallback support into the Express backend and React frontend, providing self-service password recovery for users and real-time administrative notification emails upon new user registration.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during requirements clarification:

- **SMTP Configuration Standard**: Standard environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `ADMIN_EMAIL`) loaded via Docker Compose and `.env.example`.
- **Local Dev / Unconfigured SMTP Fallback**: When SMTP credentials are not yet configured, the system logs the full reset link in the server console and exposes the reset URL in a development test banner directly on screen for friction-free local verification.
- **Admin Recipient**: The administrator notification will target `ADMIN_EMAIL` (defaulting to the configured environment variable or system admin account) whenever an account requires manual verification/approval.

---

## 1. Overview & Core Concept

- **What It Does**: 
  1. **Self-Service Password Recovery**: Adds a "Forgot password?" link on the login modal allowing users to enter their email. The server creates a secure signed token, formats a reset link, and delivers an email with password reset instructions. If running locally without SMTP, it logs the link to console and displays it in dev mode.
  2. **Admin Registration Notification**: When a new instructor or user signs up requiring approval, an automated alert email is dispatched to the admin with user details (name, email, timestamp) and a direct link to the Admin User Management panel to quickly approve or decline.
  3. **Docker Compose & Environment Integration**: Exposes all standard SMTP variables in `docker-compose.example.yml` and `.env.example`.
- **Target Audience / Persona**: Instructors and operators needing quick password recovery; administrators managing access approvals for team members.
- **Key Value**: Eliminates manual administrator intervention for forgotten passwords, speeds up user onboarding approvals, and maintains reliable operability in both air-gapped/dev and production environments.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **User Password Recovery Flow**:
   - User navigates to the login screen and clicks the "Forgot password?" text link below the password input.
   - A modal or dedicated sub-view prompts for their registered email address.
   - Upon submitting, the button displays a loading spinner and transitions to a clear confirmation state: *"If an account exists with that email, a password reset link has been dispatched."* (prevents user enumeration while providing reassuring feedback).
   - In dev mode without configured SMTP, a clean amber notification banner reveals: *"Dev Mode: SMTP not configured. Test reset link: [Copy / Open Link]"*.
   - Clicking the link directs the user to the existing `ResetPassword.tsx` screen (`?resetToken=...` or `?token=...`), where they enter a new password and log in.

2. **Admin Registration Notification Flow**:
   - A new instructor completes the signup form (`Auth.tsx`).
   - The backend stores the new user with `isApproved = 0` (or `1` if admin).
   - If `isApproved === 0`, the backend triggers an asynchronous email to `ADMIN_EMAIL`.
   - The admin receives an HTML email with clear typography, showing the applicant's name, email, submission time, and a button linking directly to the Admin Users approval table (`/admin/users`).

### Visual Identity & Theme
- **Aesthetic Direction**: Functional SaaS utility aesthetic with crisp contrast, dark/light theme fidelity matching the application's existing slate palette.
- **Color Discipline**:
  - Dominant Neutral Canvas: Crisp white (`#FFFFFF`) / Dark slate (`#0F172A`).
  - Structural Surfaces: Slate 100/800 borders, muted text (`#64748B` / `#94A3B8`).
  - Accent Color: Primary Blue (`#2563EB` / `#3B82F6`) for submission CTAs and actionable links.
  - Status Indicators: Amber-50/Amber-900 border for dev-mode mock link display; Emerald for confirmation alerts.
- **Typography & Interaction**:
  - Clean unboxed metadata and single-line button labels.
  - Micro-interactions with `Loader2` spin states, keyboard Enter submission, and copy-to-clipboard button for dev reset links.

---

## 3. Key Product Decisions & Trade-Offs

- **Nodemailer Library for SMTP**:
  - *Chosen Approach*: Use `nodemailer` on the Express backend, configured with a connection pool or lazy transporter.
  - *Why*: Industry standard in Node.js, supports standard SMTP, STARTTLS, SSL/TLS, custom headers, and plain-text + HTML templates.
  - *Alternatives Considered*: Custom socket SMTP (fragile, lacks TLS renegotiation) or vendor SDKs like Resend/SendGrid (locks user into a specific vendor rather than standard Docker Compose SMTP).
- **Graceful Dev-Mode Fallback**:
  - *Chosen Approach*: If `SMTP_HOST` is absent or connection fails during development, catch the error gracefully, log the reset URL to stdout with formatted boundaries, and return `devResetUrl` when `process.env.NODE_ENV !== 'production'`.
  - *Why*: Prevents blocked testing or broken onboarding during local runs and review environments where real SMTP credentials are unavailable.
- **Token Format & Security**:
  - *Chosen Approach*: Reuse the existing JWT-based reset token mechanism with `expiresIn: '1h'` and `{ purpose: 'reset-password', userId }`.
  - *Why*: Stateless, secure, immediately verified by the existing `/api/auth/reset-password` endpoint without requiring new database schema migrations.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                       Client Viewports                       │
│                                                              │
│  ┌────────────────────────┐      ┌────────────────────────┐  │
│  │   Auth.tsx (Login)     │      │   ResetPassword.tsx    │  │
│  │  - "Forgot password?"  │      │  - Validates token     │  │
│  │  - Email prompt modal  │      │  - Sets new password   │  │
│  │  - Dev fallback banner │      │                        │  │
│  └───────────┬────────────┘      └───────────┬────────────┘  │
└──────────────┼───────────────────────────────┼───────────────┘
               │ POST /api/auth/forgot-password│ POST /api/auth/reset-password
               ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Express Backend Server                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Mailer Module (server.ts / emailService)               │  │
│  │  - Reads: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS   │  │
│  │  - Transporter: nodemailer.createTransport(...)       │  │
│  │  - sendPasswordResetEmail(email, name, resetUrl)       │  │
│  │  - sendNewUserRegistrationAlert(adminEmail, user)      │  │
│  └───────────┬───────────────────────────────┬────────────┘  │
│              │                               │               │
│              ▼                               ▼               │
│   ┌─────────────────────┐       ┌────────────────────────┐   │
│   │ If SMTP Configured  │       │ If SMTP Not Configured │   │
│   │ Dispatch via SMTP   │       │ Log link to stdout     │   │
│   │ host:port           │       │ Return dev link in dev │   │
│   └─────────────────────┘       └────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Data Model & Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `SMTP_HOST` | Hostname of SMTP mail server | `smtp.mailgun.org` / `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port (587 for STARTTLS, 465 for SSL) | `587` |
| `SMTP_SECURE` | Whether to use SSL (`true` for port 465) | `false` |
| `SMTP_USER` | SMTP username / auth credential | `apikey` or `user@domain.com` |
| `SMTP_PASS` | SMTP password / app password | `secret_password` |
| `SMTP_FROM` | Outgoing sender name and address | `"Job Allocator" <noreply@domain.com>` |
| `ADMIN_EMAIL` | Destination for new registration alerts | `admin@example.com` |
| `PUBLIC_URL` / `APP_URL` | Base public URL used in email hyperlinks | `http://localhost:3000` |

### Key API & Endpoint Interactions

1. **`POST /api/auth/forgot-password`**:
   - Body: `{ email: string }`
   - Actions:
     - Normalizes email, searches `users` table.
     - If user exists: signs JWT with 1 hour expiration; constructs reset URL `${origin}/?resetToken=${token}`.
     - Attempts delivery via `sendPasswordResetEmail()`.
     - Returns `{ success: true, message: "If an account exists, instructions have been sent.", devResetUrl?: string }`.
2. **`POST /api/auth/register` (Enhanced)**:
   - Body: `{ email, password, name }`
   - Actions:
     - Creates user with `isApproved: 0` (unless matching `ADMIN_EMAIL`).
     - Triggers asynchronous `sendNewUserRegistrationAlert(ADMIN_EMAIL, { name, email, id })`.
     - Logs alert to server console.
3. **`docker-compose.example.yml` & `.env.example`**:
   - Appended with clearly documented SMTP environment configuration blocks.
