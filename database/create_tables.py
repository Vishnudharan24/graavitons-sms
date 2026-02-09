import psycopg2
from psycopg2 import sql
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

# Database connection parameters
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'graavitons_db'),
    'user': os.getenv('DB_USER', 'graav_user'),
    'password': os.getenv('DB_PASSWORD', ''),
}


def create_tables():
    """Create all database tables"""
    conn = None
    cursor = None
    
    try:
        # Connect to the database
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Connected to database successfully!")
        
        # Drop tables if they exist (in reverse order due to foreign keys)
        print("\nDropping existing tables (if any)...")
        cursor.execute("""
            DROP TABLE IF EXISTS feedback CASCADE;
            DROP TABLE IF EXISTS achievers CASCADE;
            DROP TABLE IF EXISTS mock_test CASCADE;
            DROP TABLE IF EXISTS daily_test CASCADE;
            DROP TABLE IF EXISTS counselling_detail CASCADE;
            DROP TABLE IF EXISTS entrance_exams CASCADE;
            DROP TABLE IF EXISTS twelfth_mark CASCADE;
            DROP TABLE IF EXISTS tenth_mark CASCADE;
            DROP TABLE IF EXISTS parent_info CASCADE;
            DROP TABLE IF EXISTS student CASCADE;
            DROP TABLE IF EXISTS batch CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
        """)
        conn.commit()
        print("Existing tables dropped successfully!")
        
        # Create users table
        print("\nCreating users table...")
        cursor.execute("""
            CREATE TABLE users (
                id VARCHAR(50) PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create batch table (with subjects field)
        print("Creating batch table...")
        cursor.execute("""
            CREATE TABLE batch (
                batch_id SERIAL PRIMARY KEY,
                batch_name VARCHAR(50) NOT NULL,
                start_year SMALLINT NOT NULL,
                end_year SMALLINT NOT NULL,
                type VARCHAR(50),
                subjects TEXT[],
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create student table
        print("Creating student table...")
        cursor.execute("""
            CREATE TABLE student (
                student_id VARCHAR(50) PRIMARY KEY,
                batch_id INT REFERENCES batch(batch_id),
                student_name VARCHAR(100) NOT NULL,
                dob DATE,
                grade VARCHAR(20),
                community VARCHAR(50),
                enrollment_year SMALLINT,
                course VARCHAR(100),
                branch VARCHAR(100),
                gender VARCHAR(10),
                student_mobile VARCHAR(15),
                aadhar_no VARCHAR(20),
                apaar_id VARCHAR(20),
                email VARCHAR(255),
                photo_url VARCHAR(255),
                school_name VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create parent_info table
        print("Creating parent_info table...")
        cursor.execute("""
            CREATE TABLE parent_info (
                student_id VARCHAR(50) PRIMARY KEY REFERENCES student(student_id) ON DELETE CASCADE,
                guardian_name VARCHAR(100),
                father_name VARCHAR(100),
                mother_name VARCHAR(100),
                sibling_name VARCHAR(100),
                guardian_occupation VARCHAR(100),
                father_occupation VARCHAR(100),
                mother_occupation VARCHAR(100),
                sibling_grade VARCHAR(20),
                guardian_mobile VARCHAR(15),
                mother_mobile VARCHAR(15),
                father_mobile VARCHAR(15),
                sibling_school VARCHAR(255),
                sibling_college VARCHAR(255),
                guardian_email VARCHAR(255),
                mother_email VARCHAR(255),
                father_email VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create tenth_mark table
        print("Creating tenth_mark table...")
        cursor.execute("""
            CREATE TABLE tenth_mark (
                student_id VARCHAR(50) PRIMARY KEY REFERENCES student(student_id) ON DELETE CASCADE,
                school_name VARCHAR(255),
                year_of_passing SMALLINT,
                board_of_study VARCHAR(50),
                english INT,
                tamil INT,
                hindi INT,
                maths INT,
                science INT,
                social_science INT,
                total_marks INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create twelfth_mark table
        print("Creating twelfth_mark table...")
        cursor.execute("""
            CREATE TABLE twelfth_mark (
                student_id VARCHAR(50) PRIMARY KEY REFERENCES student(student_id) ON DELETE CASCADE,
                school_name VARCHAR(255),
                year_of_passing SMALLINT,
                board_of_study VARCHAR(50),
                english INT,
                physics INT,
                maths INT,
                chemistry INT,
                biology INT,
                computer_science INT,
                tamil INT,
                total_marks INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create entrance_exams table
        print("Creating entrance_exams table...")
        cursor.execute("""
            CREATE TABLE entrance_exams (
                exam_id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                exam_name VARCHAR(100),
                physics_marks INT,
                chemistry_marks INT,
                maths_marks INT,
                biology_marks INT,
                total_marks INT,
                community_rank INT,
                overall_rank INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (student_id, exam_name)
            );
        """)
        
        # Create counselling_detail table
        print("Creating counselling_detail table...")
        cursor.execute("""
            CREATE TABLE counselling_detail (
                counselling_id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                forum VARCHAR(100),
                round INT,
                college_alloted VARCHAR(255),
                year_of_completion SMALLINT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create daily_test table
        print("Creating daily_test table...")
        cursor.execute("""
            CREATE TABLE daily_test (
                test_id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                grade INT,
                branch VARCHAR(100),
                test_date DATE,
                subject VARCHAR(100),
                unit_name VARCHAR(100),
                total_marks INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create mock_test table
        print("Creating mock_test table...")
        cursor.execute("""
            CREATE TABLE mock_test (
                test_id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                grade INT,
                branch VARCHAR(100),
                test_date DATE,
                maths_marks INT,
                physics_marks INT,
                biology_marks INT,
                chemistry_marks INT,
                maths_unit_names TEXT[],
                chemistry_unit_names TEXT[],
                biology_unit_names TEXT[],
                physics_unit_names TEXT[],
                total_marks INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create feedback table
        print("Creating feedback table...")
        cursor.execute("""
            CREATE TABLE feedback (
                feedback_id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
                teacher_feedback TEXT,
                suggestions TEXT,
                academic_director_signature VARCHAR(255),
                student_signature VARCHAR(255),
                parent_signature VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create achievers table
        print("Creating achievers table...")
        cursor.execute("""
            CREATE TABLE achievers (
                achievement_id SERIAL PRIMARY KEY,
                student_id VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Commit all changes
        conn.commit()
        print("\n✅ All tables created successfully!")
        
        # Display created tables
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print("\nCreated tables:")
        for table in tables:
            print(f"  - {table[0]}")
            
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"\n❌ Error: {e}")
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("\nDatabase connection closed.")


if __name__ == "__main__":
    print("=" * 60)
    print("GRAAVITONS SMS - Database Table Creation")
    print("=" * 60)
    
    confirmation = input("\n⚠️  This will DROP all existing tables and recreate them.\nAre you sure? (yes/no): ")
    
    if confirmation.lower() == 'yes':
        create_tables()
    else:
        print("Operation cancelled.")
