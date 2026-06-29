# Train Driver Instructor Job Allocator

A real-time web application for train driver instructors to coordinate daily tasks, job numbers, and headcodes. Built with React, TypeScript, Tailwind CSS, and Firebase.

## Features

- **Google Authentication**: Secure login for instructors.
- **Daily Dashboard**: Calendar-based view to navigate day by day.
- **Job Allocation**: Claim full or partial jobs with specific headcodes.
- **Real-time Conflict Detection**: Prevents double-booking of jobs and headcodes.
- **Live Updates**: Instant synchronization across all connected clients.
- **Instructor Notes**: Add optional notes to allocations.

## Running with Docker Compose

You can easily run this application locally using Docker Compose.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. Ensure you have your `firebase-applet-config.json` file in the root directory (this contains your Firebase project configuration).

3. Build and start the container:
   ```bash
   docker-compose up -d --build
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

5. To stop the application:
   ```bash
   docker-compose down
   ```

## Manual Setup (Node.js)

If you prefer to run the app without Docker:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
