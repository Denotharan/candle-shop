# Serein - Boutique Artisanal Candle Shop

Serein is a full-stack e-commerce web application for a boutique candle shop, featuring a beautiful modern storefront and a comprehensive administrative dashboard. 

## Features

- **Storefront**: Browse artisanal candles, view details, and manage shopping carts.
- **Admin Dashboard**: Manage inventory, edit product details, track statistics, and export user data via CSV.
- **Authentication**: Secure JWT-based authentication system for administrators and customers.
- **Modern UI**: Built with React and Tailwind CSS, featuring aesthetic design, glassmorphism elements, and seamless dark mode support.
- **Robust Backend**: Python-based FastAPI backend ensuring high-performance routing.
- **Database**: Deep integration with Supabase (PostgreSQL) for persistent and reliable data storage.

## Tech Stack

### Frontend
- **React** (UI Library)
- **Vite** (Build Tool)
- **Tailwind CSS** (Styling)

### Backend
- **Python** (Programming Language)
- **FastAPI** (Web Framework)
- **Uvicorn** (ASGI Server)
- **Supabase / PostgreSQL** (Database)

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
- Node.js (v18+)
- Python (v3.8+)
- A Supabase Project (Database)

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but highly recommended):
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On Mac/Linux:
   source .venv/bin/activate
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up your environment variables. Create a `.env` file in the `backend` folder containing your Supabase credentials:
   ```env
   SUPABASE_URL="your_supabase_project_url"
   SUPABASE_KEY="your_supabase_anon_public_key"
   ```
5. Start the backend server:
   ```bash
   python main.py
   ```
   *The backend will now be running at `http://127.0.0.1:8000`.*

### Frontend Setup

1. Open a **new** terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required npm packages:
   ```bash
   npm install
   ```
3. Tell the frontend where your local backend is running by creating a `.env` file in the `frontend` folder:
   ```env
   VITE_API_URL=http://127.0.0.1:8000
   ```
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The frontend will now be running at `http://127.0.0.1:5173`.*

## License

This project is open-source and available under the MIT License.
