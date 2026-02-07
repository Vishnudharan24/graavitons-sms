# Student Portal - MERN Stack

A full-stack student portal application built with the MERN stack (MongoDB, Express, React, Node.js) replicating a college learning management system.

## Features

- Course listing with instructor information
- Student dashboard with program details
- Responsive sidebar navigation
- Modern UI design
- RESTful API backend

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js + Express.js
- **Database**: MongoDB
- **Styling**: CSS3

## Installation

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (running locally or MongoDB Atlas)
- npm or yarn

### Backend Setup

1. Navigate to the backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your MongoDB connection string (already created).

4. Start the server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

5. Seed sample data (optional):
```bash
# Make a POST request to seed courses
curl -X POST http://localhost:5000/api/courses/seed
```

### Frontend Setup

1. Navigate to the frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the React development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Courses
- `GET /api/courses` - Get all courses
- `GET /api/courses/:id` - Get course by ID
- `POST /api/courses` - Create a new course
- `POST /api/courses/seed` - Seed sample courses

### Users
- `GET /api/users/current` - Get current user info

## Project Structure

```
MOd1/
├── backend/
│   ├── models/
│   │   ├── Course.js
│   │   └── User.js
│   ├── routes/
│   │   ├── courses.js
│   │   └── users.js
│   ├── .env
│   ├── server.js
│   └── package.json
└── frontend/
    ├── public/
    │   └── index.html
    └── src/
        ├── components/
        │   ├── Sidebar.js
        │   ├── Sidebar.css
        │   ├── Header.js
        │   ├── Header.css
        │   ├── Dashboard.js
        │   ├── Dashboard.css
        │   ├── CourseCard.js
        │   └── CourseCard.css
        ├── App.js
        ├── App.css
        ├── index.js
        └── index.css
```

## Usage

1. Start MongoDB service on your machine
2. Run the backend server
3. Seed the database with sample courses (POST to /api/courses/seed)
4. Run the frontend React app
5. Open `http://localhost:3000` in your browser

## Screenshots

The application recreates the student portal interface with:
- Sidebar navigation
- Course grid layout
- Student information display
- Modern, responsive design

## Future Enhancements

- User authentication
- Course enrollment
- Assignment submission
- Grade tracking
- Real-time notifications
- Mobile app version
