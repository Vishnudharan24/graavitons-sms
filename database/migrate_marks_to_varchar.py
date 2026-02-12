"""
Migration script: Change mark columns from INT to VARCHAR(20)
This allows storing non-numeric mark values like 'A' (absent), '-' (not applicable), negative marks, etc.

Run this script ONCE against your existing database to alter the columns.
It will NOT drop any data — existing integer values will be preserved as strings.
"""

import psycopg2
import os
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'graavitons_db'),
    'user': os.getenv('DB_USER', 'graav_user'),
    'password': os.getenv('DB_PASSWORD', ''),
}


def migrate():
    conn = None
    cursor = None

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        print("Connected to database successfully!")
        print("\n--- Migration: Change mark columns from INT to VARCHAR(20) ---\n")

        # 1. Create safe_numeric function for use in queries
        print("Creating safe_numeric() function...")
        cursor.execute("""
            CREATE OR REPLACE FUNCTION safe_numeric(val text)
            RETURNS NUMERIC AS $$
            BEGIN
                IF val IS NULL OR val = '' THEN
                    RETURN NULL;
                END IF;
                RETURN val::NUMERIC;
            EXCEPTION WHEN OTHERS THEN
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql IMMUTABLE;
        """)
        print("  ✅ safe_numeric() function created")

        # 2. Alter daily_test table
        print("\nAltering daily_test table...")
        cursor.execute("""
            ALTER TABLE daily_test
            ALTER COLUMN total_marks TYPE VARCHAR(20)
            USING total_marks::VARCHAR;
        """)
        print("  ✅ daily_test.total_marks changed to VARCHAR(20)")

        # 3. Alter mock_test table
        print("\nAltering mock_test table...")
        columns = ['maths_marks', 'physics_marks', 'biology_marks', 'chemistry_marks', 'total_marks']
        for col in columns:
            cursor.execute(f"""
                ALTER TABLE mock_test
                ALTER COLUMN {col} TYPE VARCHAR(20)
                USING {col}::VARCHAR;
            """)
            print(f"  ✅ mock_test.{col} changed to VARCHAR(20)")

        conn.commit()
        print("\n✅ Migration completed successfully!")
        print("\nAll mark columns now support values like:")
        print("  - Integer marks: 85, 100, 0")
        print("  - Absent: A")
        print("  - Not applicable: -")
        print("  - Negative marks: -4, -2")

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
    print("GRAAVITONS SMS - Mark Columns Migration")
    print("INT → VARCHAR(20)")
    print("=" * 60)

    confirmation = input("\nThis will alter mark columns in daily_test and mock_test tables.\nExisting data will be preserved. Continue? (yes/no): ")

    if confirmation.lower() == 'yes':
        migrate()
    else:
        print("Migration cancelled.")
