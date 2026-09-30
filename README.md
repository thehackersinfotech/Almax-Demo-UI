# BMS Frontend — Setup Guide

## Tech Stack

- React 18 + TypeScript
- Vite 6
- Ant Design 5
- React Router v6
- TanStack Query (React Query)
- Zustand (state management)
- Axios

---

## Prerequisites

- Node.js 18+
- npm

---

## 1. Install Dependencies

```bash
cd frontend
npm install
```

---

## 2. Environment Configuration

Create a `.env` file in the `frontend/` directory:

```bash
cp .env.example .env
```

Edit `.env` with the appropriate values:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_KEYCLOAK_URL=http://localhost:8080
VITE_KEYCLOAK_REALM=bms
VITE_KEYCLOAK_CLIENT_ID=bms-client
```

---

## 3. Run Development Server

```bash
npm run dev
```

App will be available at `http://localhost:3000`.

---

## 4. Build for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

---

## 5. Preview Production Build

```bash
npm run preview
```

---

## 6. Lint

```bash
npm run lint
```

---

## Project Structure

```
src/
├── assets/          # Static assets (images, icons)
├── components/      # Shared/reusable components
├── pages/           # Route-level page components
├── services/        # Axios API service calls
├── store/           # Zustand state stores
├── types/           # TypeScript type definitions
└── main.tsx         # App entry point
```
