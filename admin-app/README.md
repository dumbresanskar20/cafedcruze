# Canteen Operations Admin Panel & Kitchen Screen

A high-contrast, staff-friendly administrative interface designed for canteen staff and kitchen operations.

## Features
- **Kitchen Screen Display**: High-readability token grid (`B-001`, `L-001`) with color-coded status badges, Socket.IO live sync, and 15s polling fallback.
- **Menu Catalog Management**: Add/edit items, price controls, and explicit active/inactive toggle switches per item.
- **Meal Timings**: Set operating window hours for Breakfast, Lunch, Snacks, and Dinner.
- **Super Admin Staff Control**: Role-based access control (`super_admin` vs `staff`), staff invitation links, audit tracking (`created_by`, `last_login_at`).

## Setup & Running Locally

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `VITE_API_URL` points to `http://localhost:5000/api` and `VITE_SOCKET_URL` to `http://localhost:5000`.

### 3. Run Development Server
```bash
npm run dev
```

Admin panel will run at `http://localhost:5174`.

### Default Credentials (Seeded)
- **Super Admin**: `admin@mess.com` / `Admin@123`
