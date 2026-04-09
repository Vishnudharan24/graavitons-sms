import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from config import APP_TITLE, CORS_ORIGINS, SERVER_HOST, SERVER_PORT, DEBUG
from db_pool import close_pool


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: pool is already initialised when db_pool module is imported
    yield
    # Shutdown: close all pooled connections
    close_pool()


# Create main FastAPI app
app = FastAPI(title=APP_TITLE, lifespan=lifespan)

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
            "batch_delete": "DELETE /api/batch/{batch_id}",
            "student_create": "POST /api/student",
            "student_upload": "POST /api/student/upload",
            "student_template": "GET /api/student/template",
            "daily_test_create": "POST /api/exam/daily-test",
            "daily_test_groups": "GET /api/exam/daily-test/batch/{batch_id}/groups",
            "daily_test_records": "POST /api/exam/daily-test/batch/{batch_id}/records",
            "daily_test_update": "PUT /api/exam/daily-test/batch/{batch_id}",
            "daily_test_delete": "DELETE /api/exam/daily-test/batch/{batch_id}",
            "mock_test_create": "POST /api/exam/mock-test",
            "mock_test_groups": "GET /api/exam/mock-test/batch/{batch_id}/groups",
            "mock_test_records": "POST /api/exam/mock-test/batch/{batch_id}/records",
            "mock_test_update": "PUT /api/exam/mock-test/batch/{batch_id}",
            "mock_test_delete": "DELETE /api/exam/mock-test/batch/{batch_id}",
            "daily_test_template": "GET /api/exam/template/daily-test/{batch_id}",
            "mock_test_template": "GET /api/exam/template/mock-test/{batch_id}",
            "student_daily_tests": "GET /api/exam/daily-test/student/{student_no}",
            "student_mock_tests": "GET /api/exam/mock-test/student/{student_no}",
            "batch_report": "GET /api/exam/batch-report/{batch_id}",
            "analysis_filter_options": "GET /api/analysis/filter-options",
            "analysis_subjectwise": "GET /api/analysis/subjectwise",
            "analysis_branchwise": "GET /api/analysis/branchwise",
            "analysis_individual_students": "GET /api/analysis/individual/students",
            "analysis_individual": "GET /api/analysis/individual/{student_no}",
            "analysis_student_metrics": "GET /api/analysis/student-metrics/{student_no}",
            "analysis_student_weak_topics": "GET /api/analysis/student-weak-topics/{student_no}",
            "analysis_batch_advanced": "GET /api/analysis/batch-advanced/{batch_id}",
            "analysis_risk_dashboard": "GET /api/analysis/risk-dashboard/{batch_id}",
            "analysis_subject_diagnostics": "GET /api/analysis/subject-diagnostics/{batch_id}",
            "feedback_create": "POST /api/analysis/feedback",
            "feedback_get": "GET /api/analysis/feedback/{student_no}",
            "achiever_list": "GET /api/achiever",
            "achiever_student_search": "GET /api/achiever/students/search?admission_query=",
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
