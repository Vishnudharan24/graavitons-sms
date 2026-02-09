import psycopg2

# Database connection parameters
DB_CONFIG = {
    'host': 'localhost',
    'database': 'graavitons_db',
    'user': 'graav_user',
    'password': '123456'
}


def create_achiever_feedback_tables():
    """Create the achievers and student_feedback tables in the database."""
    conn = None
    cursor = None

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("Connected to database successfully!")

        # ── Drop existing tables if they exist ──
        print("\nDropping existing achievers & student_feedback tables (if any)...")
        cursor.execute("""
            DROP TABLE IF EXISTS student_feedback CASCADE;
            DROP TABLE IF EXISTS achievers CASCADE;
        """)
        conn.commit()
        print("Existing tables dropped successfully!")

        # ── 1. Achievers Table ──
        print("\nCreating achievers table...")
        cursor.execute("""
            CREATE TABLE achievers (
                achievement_id  SERIAL PRIMARY KEY,
                student_id      VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                batch_id        INT REFERENCES batch(batch_id) ON DELETE SET NULL,
                achievement     VARCHAR(255) NOT NULL,
                achievement_details TEXT,
                rank            VARCHAR(50),
                score           DECIMAL(5, 2),
                photo_url       VARCHAR(255),
                achieved_date   DATE DEFAULT CURRENT_DATE,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("✅ achievers table created.")

        # ── 2. Student Feedback Table ──
        print("\nCreating student_feedback table...")
        cursor.execute("""
            CREATE TABLE student_feedback (
                feedback_id                  SERIAL PRIMARY KEY,
                student_id                   VARCHAR(50) REFERENCES student(student_id) ON DELETE CASCADE,
                batch_id                     INT REFERENCES batch(batch_id) ON DELETE SET NULL,
                feedback_date                DATE NOT NULL DEFAULT CURRENT_DATE,
                feedback_type                VARCHAR(50) DEFAULT 'general',
                teacher_name                 VARCHAR(100),
                teacher_feedback             TEXT,
                academic_performance         VARCHAR(20),
                attendance_remark            VARCHAR(50),
                behaviour_remark             VARCHAR(50),
                strengths                    TEXT,
                areas_of_improvement         TEXT,
                suggestions                  TEXT,
                parent_feedback              TEXT,
                academic_director_signature  VARCHAR(255),
                teacher_signature            VARCHAR(255),
                student_signature            VARCHAR(255),
                parent_signature             VARCHAR(255),
                created_at                   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        print("✅ student_feedback table created.")

        # Commit all changes
        conn.commit()
        print("\n✅ All tables created successfully!")

        # Display created tables for confirmation
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN ('achievers', 'student_feedback')
            ORDER BY table_name;
        """)
        tables = cursor.fetchall()
        print("\nVerified tables:")
        for table in tables:
            print(f"  - {table[0]}")

        # Show column details for each table
        for tbl in ['achievers', 'student_feedback']:
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """, (tbl,))
            columns = cursor.fetchall()
            print(f"\n  📋 {tbl} columns:")
            for col in columns:
                print(f"     {col[0]:35s} {col[1]:20s} nullable={col[2]}  default={col[3]}")

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
    print("GRAAVITONS SMS - Achievers & Student Feedback Tables")
    print("=" * 60)

    confirmation = input(
        "\n⚠️  This will DROP and recreate the 'achievers' and "
        "'student_feedback' tables.\nAre you sure? (yes/no): "
    )

    if confirmation.lower() == 'yes':
        create_achiever_feedback_tables()
    else:
        print("Operation cancelled.")
