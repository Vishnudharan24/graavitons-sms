# GRAAVITONS — Student Management System

A full-stack Student Management System built for coaching institutes / colleges to manage batches, students, examinations, performance analysis, and achiever showcases.

## Features

- **Authentication** — Role-based login & registration (Admin / Teacher)
- **Batch Management** — Create and list academic batches with year range & type
- **Student Management** — Add students individually or bulk-upload via Excel; detailed student profiles with parent info, 10th/12th marks, entrance exams & counselling details
- **Exam Management** — Record Daily Tests and Mock Tests with Excel template upload support
- **Performance Analysis** — Subject-wise, branch-wise, and individual student analysis with interactive charts
- **Student Feedback** — Add and view per-student feedback notes
- **Achiever Showcase** — CRUD operations for student achievements displayed on the dashboard
- **PDF & Excel Export** — Generate reports and download templates

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, React Router v6, Recharts, Axios, jsPDF, html2canvas, SheetJS (xlsx) |
| **Backend** | Python 3, FastAPI, Uvicorn, Pydantic, Pandas, OpenPyXL |
| **Database** | PostgreSQL (psycopg2) |
| **Auth** | bcrypt password hashing |

## Prerequisites

- **Python** 3.9+
- **Node.js** 16+ & npm
- **PostgreSQL** 12+

## Getting Started

### 1. Clone the repository

```bash
git clone <repo-url>
cd GRAAVITONS
```

### 2. Database setup

Create a PostgreSQL database and user, then apply the schema:

```bash
psql -U postgres -c "CREATE DATABASE graavitons_db;"
psql -U postgres -c "CREATE USER graav_user WITH PASSWORD 'your_password';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE graavitons_db TO graav_user;"
psql -U graav_user -d graavitons_db -f database/db_schema.txt
```

### 3. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file inside `backend/`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=graavitons_db
DB_USER=graav_user
DB_PASSWORD=your_password

SERVER_HOST=0.0.0.0
SERVER_PORT=8000
CORS_ORIGINS=http://localhost:3000
DEBUG=true
APP_TITLE=GRAAVITONS SMS API
```

Start the server:

```bash
python server.py
```

The API will be available at `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

### 4. Frontend setup

```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000` and proxy API requests to port 8000.

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/user/{user_id}` | Get user details |

### Batches
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/batch` | Create a batch |
| GET | `/api/batch` | List all batches |

### Students
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/student` | Add a student |
| POST | `/api/student/upload` | Bulk upload students (Excel) |
| GET | `/api/student/template` | Download student upload template |

### Exams
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/exam/daily-test` | Create daily test records |
| POST | `/api/exam/mock-test` | Create mock test records |
| GET | `/api/exam/template/daily-test/{batch_id}` | Download daily test template |
| GET | `/api/exam/template/mock-test/{batch_id}` | Download mock test template |
| GET | `/api/exam/daily-test/student/{student_id}` | Get student's daily tests |
| GET | `/api/exam/mock-test/student/{student_id}` | Get student's mock tests |
| GET | `/api/exam/batch-report/{batch_id}` | Get batch-level report |

### Analysis
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analysis/filter-options` | Get filter dropdowns |
| GET | `/api/analysis/subjectwise` | Subject-wise analysis |
| GET | `/api/analysis/branchwise` | Branch-wise analysis |
| GET | `/api/analysis/individual/students` | List students for individual analysis |
| GET | `/api/analysis/individual/{student_id}` | Individual student analysis |
| POST | `/api/analysis/feedback` | Submit student feedback |
| GET | `/api/analysis/feedback/{student_id}` | Get student feedback |

### Achievers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/achiever` | List achievements |
| POST | `/api/achiever` | Create achievement |
| GET | `/api/achiever/{achievement_id}` | Get achievement |
| PUT | `/api/achiever/{achievement_id}` | Update achievement |
| DELETE | `/api/achiever/{achievement_id}` | Delete achievement |

## Project Structure

```
GRAAVITONS/
├── backend/
│   ├── server.py              # FastAPI entry point
│   ├── config.py              # Centralised env config
│   ├── requirements.txt
│   └── api/
│       ├── auth.py            # Authentication routes
│       ├── batch.py           # Batch CRUD
│       ├── student.py         # Student CRUD & bulk upload
│       ├── exam.py            # Daily & mock test routes
│       ├── analysis.py        # Analysis & feedback routes
│       └── achiever.py        # Achiever CRUD
├── database/
│   ├── db_schema.txt          # PostgreSQL DDL
│   ├── create_tables.py       # Programmatic table creation
│   └── achiever_feedback.py
├── excel_template/
│   ├── README_EXAM_TEMPLATES.md
│   └── QUICK_REFERENCE.md
├── frontend/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js             # Root component (auth gate)
│       ├── config.js          # API base URL
│       ├── components/
│       │   ├── Login.js
│       │   ├── Header.js
│       │   ├── Sidebar.js
│       │   ├── Dashboard.js
│       │   ├── BatchDetail.js
│       │   ├── AddBatch.js
│       │   ├── AddStudent.js
│       │   ├── AddExam.js
│       │   ├── StudentProfile.js
│       │   ├── AddAchiever.js
│       │   ├── AchieversSection.js
│       │   ├── AchieverCard.js
│       │   ├── AnalysisDashboard.js
│       │   └── analysis/
│       │       ├── AnalysisFilters.js
│       │       ├── SubjectwiseAnalysis.js
│       │       ├── BranchwiseAnalysis.js
│       │       └── IndividualAnalysis.js
│       └── utils/
└── README.md
```

## Database Schema

The PostgreSQL schema includes the following tables:

| Table | Purpose |
|-------|---------|
| `users` | App users (admin / teacher) |
| `batch` | Academic batches |
| `student` | Core student details |
| `parent_info` | Guardian & parent details |
| `tenth_mark` | 10th standard marks |
| `twelfth_mark` | 12th standard marks |
| `entrance_exams` | Entrance exam scores & ranks |
| `counselling_detail` | College counselling rounds |
| `daily_test` | Daily test scores |
| `mock_test` | Mock test scores (multi-subject) |
| `achievers` | Student achievements |

## License

This project is proprietary to GRAAVITONS.
