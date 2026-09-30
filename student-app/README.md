# Campus Mess - Student Web Application

A food-ordering experience for students featuring 3D Three.js hero animations, warm food aesthetic, persistent top-right authentication, and Razorpay digital token checkout.

## Features
- **3D React Three Fiber Hero**: Interactive floating food dish rendered live with R3F & Drei, with mobile WebGL fallback.
- **Top-Right Persistent Auth**: Browse freely & build cart without logging in. Top-right Sign In / Sign Up control always accessible.
- **Checkout Auth Guard**: Automatic session state check at checkout. Prompts login if unauthenticated while preserving cart.
- **3D Tilt Cards**: Interactive hover parallax on food items.
- **Razorpay Checkout**: Digital token number generation (`B-001`) with confetti celebration screen.

## Setup & Running Locally

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default `VITE_API_URL` points to `http://localhost:5000/api`.

### 3. Run Development Server
```bash
npm run dev
```

App will run at `http://localhost:5173`.
