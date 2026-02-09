import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from config import APP_TITLE, CORS_ORIGINS, SERVER_HOST, SERVER_PORT, DEBUG

# Create main FastAPI app
app = FastAPI(title=APP_TITLE)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include the sub-apps directly
# This preserves their internal route paths (/api/batch, /api/student, /api/exam)
from api.batch import app as batch_app
from api.student import app as student_app
from api.exam import app as exam_app
from api.analysis import app as analysis_app
from api.achiever import app as achiever_app
from api.auth import app as auth_app

# Mount the routes from sub-applications
for route in batch_app.routes:
    app.router.routes.append(route)

for route in student_app.routes:
    app.router.routes.append(route)

for route in exam_app.routes:
    app.router.routes.append(route)

for route in analysis_app.routes:
    app.router.routes.append(route)

for route in achiever_app.routes:
    app.router.routes.append(route)

for route in auth_app.routes:
    app.router.routes.append(route)

@app.get("/")
async def root():
    return {
        "message": "GRAAVITONS Student Management System API",
        "endpoints": {
            "batch_create": "POST /api/batch",
            "batch_list": "GET /api/batch",
            "student_create": "POST /api/student",
            "student_upload": "POST /api/student/upload",
            "student_template": "GET /api/student/template",
            "daily_test_create": "POST /api/exam/daily-test",
            "mock_test_create": "POST /api/exam/mock-test",
            "daily_test_template": "GET /api/exam/template/daily-test/{batch_id}",
            "mock_test_template": "GET /api/exam/template/mock-test/{batch_id}",
            "student_daily_tests": "GET /api/exam/daily-test/student/{student_id}",
            "student_mock_tests": "GET /api/exam/mock-test/student/{student_id}",
            "batch_report": "GET /api/exam/batch-report/{batch_id}",
            "analysis_filter_options": "GET /api/analysis/filter-options",
            "analysis_subjectwise": "GET /api/analysis/subjectwise",
            "analysis_branchwise": "GET /api/analysis/branchwise",
            "analysis_individual_students": "GET /api/analysis/individual/students",
            "analysis_individual": "GET /api/analysis/individual/{student_id}",
            "feedback_create": "POST /api/analysis/feedback",
            "feedback_get": "GET /api/analysis/feedback/{student_id}",
            "achiever_list": "GET /api/achiever",
            "achiever_create": "POST /api/achiever",
            "achiever_get": "GET /api/achiever/{achievement_id}",
            "achiever_update": "PUT /api/achiever/{achievement_id}",
            "achiever_delete": "DELETE /api/achiever/{achievement_id}",
            "auth_login": "POST /api/auth/login",
            "auth_register": "POST /api/auth/register",
            "auth_user": "GET /api/auth/user/{user_id}",
            "docs": "/docs"
        }
    }

if __name__ == '__main__':
    # Run the FastAPI application
    uvicorn.run(
        app, 
        host=SERVER_HOST, 
        port=SERVER_PORT,
        reload=DEBUG
    )
