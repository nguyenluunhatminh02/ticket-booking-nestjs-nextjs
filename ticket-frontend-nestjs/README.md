# Auth Frontend — Next.js 15

A complete authentication frontend built with **Next.js 15**, **TypeScript**, **Zod**, **Zustand**, **TanStack React Query**, and **shadcn/ui**.

## Features

- **Login / Register** with form validation (Zod + React Hook Form)
- **MFA (TOTP)** setup, verify, disable, backup codes management
- **Device Management** — list, trust/untrust, rename, remove devices  
- **Password Management** — forgot, reset, change password
- **Email Verification** — verify email via link
- **Security Dashboard** — login history, security events (paginated)
- **Profile Management** — view/edit profile, deactivate account
- **Silent Token Refresh** — axios interceptor with queue for parallel requests
- **Route Protection** — Next.js middleware + client-side guards

## Tech Stack

| Library | Purpose |
|---------|---------|
| Next.js 15 | App Router, SSR, middleware |
| Zod | Schema validation |
| Zustand | Client auth state |
| React Query v5 | Server state, caching, mutations |
| shadcn/ui | UI components (Radix + Tailwind) |
| Axios | HTTP client with interceptors |
| React Hook Form | Form handling |
| Sonner | Toast notifications |
| Lucide React | Icons |

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. (Optional) Install shadcn components via CLI — already included as source
# npm run setup:ui

# 3. Configure environment
cp .env.local.example .env.local
# Edit NEXT_PUBLIC_API_URL if your backend is not on localhost:8080

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Public auth pages (login, register, etc.)
│   ├── (dashboard)/      # Protected pages (profile, security, devices, mfa)
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx     # React Query + Toaster
├── components/
│   ├── auth/             # Auth form components
│   └── ui/               # shadcn/ui components
├── hooks/                # React Query hooks (use-auth, use-mfa, use-devices, use-user)
├── lib/
│   ├── api-client.ts     # Axios instance + token refresh interceptor
│   ├── auth.ts           # Token storage helpers
│   └── utils.ts          # cn(), device helpers, formatDate
├── schemas/
│   └── auth.ts           # Zod validation schemas
├── stores/
│   └── auth-store.ts     # Zustand auth store
├── types/
│   └── auth.ts           # TypeScript interfaces
└── middleware.ts          # Next.js route protection
```

## API Endpoints Covered

### Auth (13 endpoints)
`POST login` | `POST register` | `POST verify-mfa` | `POST refresh-token` | `POST logout` | `POST logout-all` | `GET verify-email` | `POST forgot-password` | `POST reset-password` | `POST change-password` | `POST resend-verification` | `GET login-history` | `GET security-events`

### MFA (7 endpoints)
`POST setup` | `POST setup/confirm` | `GET status` | `POST verify` | `POST backup-codes/regenerate` | `GET backup-codes/count` | `DELETE disable`

### Devices (7 endpoints)
`GET devices` | `GET sessions` | `DELETE {deviceId}` | `DELETE others` | `POST {deviceId}/trust` | `DELETE {deviceId}/trust` | `PUT {deviceId}/name`

### Users (4 endpoints)
`GET me` | `PUT me` | `GET {id}` | `POST me/deactivate`
