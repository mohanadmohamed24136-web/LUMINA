# LUMINA | AI-Powered Luxury Fashion Marketplace

LUMINA is a premium fashion platform where architectural design meets visionary fashion. This project features a clean, modern UI and a robust backend.

## Project Structure

- `/LUMINA`: Static frontend files (HTML, CSS, JS).
- `/backend`: Node.js/Express backend providing API services.
  - `/data`: JSON-based data storage for users and products.
  - `/routes`: API route definitions.
  - `/uploads`: Storage for uploaded product images.

## Features

- **Auth System**: Role-based access (Customer vs. Designer).
- **Designer Portal**: Manage inventory, upload designs (10/day limit), and mark as sold.
- **Customer Dashboard**: View favorites and AI-generated history.
- **AI Studio**: Interface for AI fashion generation.
- **Real-time Search**: Filter designs instantly by name or architect.
- **Multi-language**: Support for English (EN) and Arabic (AR) with RTL support.

## Getting Started

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Access the site at `http://localhost:5000`.

## Tech Stack

- **Frontend**: HTML5, Tailwind CSS (CDN), Vanilla JavaScript, Lucide Icons.
- **Backend**: Node.js, Express.js, Multer (File Uploads), fs-extra.
- **Storage**: Local JSON files (simulating a database) and `localStorage` for UI state.
