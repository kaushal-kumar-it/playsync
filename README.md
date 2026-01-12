# PlaySync


# PlaySync

PlaySync is a collaborative, real-time audio playback and synchronization platform. It enables groups to listen to music or audio together, perfectly in sync, across the web. The project consists of two main apps:

- **main_backend/** — The backend server (Node.js, Express, Prisma, WebSocket, Firebase, OCI)
- **main_frotend/** — The frontend app (Next.js, React, TypeScript)

---

## Features

- Per-room audio sync: All users in a room hear the same audio, perfectly synchronized
- Real-time controls: Play, pause, seek, and volume changes are broadcast instantly to all room members
- Audio upload: Users can upload tracks to a room for group listening
- Live chat: Built-in chat for each room
- User presence: See who is connected in real time
- Mobile & desktop UI: Responsive, modern interface
- Time sync protocol: Custom protocol for low-latency, accurate playback (inspired by @ircam/sync)
- Authentication: Firebase-based user authentication

---

## Quick Start

### Prerequisites
- Node.js v18+ (for both apps)
- Docker (optional, for containerized deployment)

### Backend Setup (`main_backend`)

```bash
cd main_backend
npm install
cp .env.example .env   # Edit with your secrets
npx prisma migrate dev  # Set up the database
npm run dev             # Start the backend server
```

### Frontend Setup (`main_frotend`)

```bash
cd main_frotend
npm install
cp .env.example .env.local   # Edit with your Firebase and API config
npm run dev                  # Start the frontend (Next.js)
```

Open http://localhost:3000 and sign in with your Firebase account.

---


## Deployment

Both backend and frontend can be containerized with Docker. See each folder's `Dockerfile` for details. Environment variables are required for Firebase, database, and storage configuration.

### Running with Docker

You can run both the backend and frontend using Docker for easy deployment and local development. Make sure you have your environment files (`.env` for backend, `.env.local` for frontend) ready in each respective folder.

#### 1. Build Docker Images

From the project root, build both images:

```bash
# Build backend image
docker build -t playsync-backend ./main_backend

# Build frontend image
docker build -t playsync-frontend ./main_frotend
```

#### 2. Run Containers

You can run each container separately, making sure to map ports and mount environment files as needed:

```bash
# Run backend (default: port 4000)
docker run --env-file ./main_backend/.env -p 4000:4000 playsync-backend

# Run frontend (default: port 3000)
docker run --env-file ./main_frotend/.env.local -p 3000:3000 playsync-frontend
```

#### 3. Access the App

- Backend API: http://localhost:4000
- Frontend: http://localhost:3000

You can now use PlaySync in your browser and connect to the backend API.

---

## Technologies Used

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Node.js, Express, Prisma, WebSocket, Firebase Admin, OCI SDK
- **Database:** PostgreSQL (via Prisma ORM)
- **Storage:** Oracle Cloud Infrastructure (OCI) Object Storage
- **Auth:** Firebase Authentication
- **Time Sync:** Custom protocol, @ircam/sync

---

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for improvements.

---

## License

MIT License. See LICENSE file for details.
