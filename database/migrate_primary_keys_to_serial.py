"""
Migration script: move primary keys to auto-increment bigint counters.

What this migration does:
1) Adds bigint counter columns:
   - users.user_no
   - student.student_no
   - parent_info.parent_info_no
   - tenth_mark.tenth_mark_no
   - twelfth_mark.twelfth_mark_no
2) Switches primary keys to those counter columns.
3) Keeps existing business keys (like student.student_id) as UNIQUE for application compatibility.

Notes:
- Existing serial primary keys in other tables already auto-increment and are left as-is.
- Existing data is preserved.
"""

import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Load .env from backend directory
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(dotenv_path=env_path)

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("DB_NAME", "graavitons_db"),
    "user": os.getenv("DB_USER", "graav_user"),
    "password": os.getenv("DB_PASSWORD", ""),
}


def table_exists(cursor, table_name: str) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        );
        """,
        (table_name,),
    )
    return bool(cursor.fetchone()[0])


def ensure_counter_pk(cursor, table: str, pk_column: str):
    sequence_name = f"{table}_{pk_column}_seq"

    # Add counter column if missing
    cursor.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {pk_column} BIGINT;")

    # Ensure sequence exists and is attached
    cursor.execute(
        f"""
        CREATE SEQUENCE IF NOT EXISTS {sequence_name};
        ALTER SEQUENCE {sequence_name} OWNED BY {table}.{pk_column};
        ALTER TABLE {table} ALTER COLUMN {pk_column} SET DEFAULT nextval('{sequence_name}');
        """
    )

    # Backfill existing rows
    cursor.execute(f"UPDATE {table} SET {pk_column} = nextval('{sequence_name}') WHERE {pk_column} IS NULL;")

    # Sync sequence with max value
    cursor.execute(
        f"""
        SELECT setval(
            '{sequence_name}',
            COALESCE((SELECT MAX({pk_column}) FROM {table}), 0),
            true
        );
        """
    )

    # Ensure not null
    cursor.execute(f"ALTER TABLE {table} ALTER COLUMN {pk_column} SET NOT NULL;")

    # Replace existing primary key, if needed
    cursor.execute(
        f"""
        DO $$
        DECLARE
            existing_pk_name text;
            existing_pk_def text;
        BEGIN
            SELECT c.conname, pg_get_constraintdef(c.oid)
            INTO existing_pk_name, existing_pk_def
            FROM pg_constraint c
            WHERE c.conrelid = '{table}'::regclass
              AND c.contype = 'p';

            IF existing_pk_name IS NOT NULL
               AND existing_pk_def NOT ILIKE '%({pk_column})%'
            THEN
                EXECUTE format('ALTER TABLE {table} DROP CONSTRAINT %I', existing_pk_name);
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint c2
                WHERE c2.conrelid = '{table}'::regclass
                  AND c2.contype = 'p'
                  AND pg_get_constraintdef(c2.oid) ILIKE '%({pk_column})%'
            ) THEN
                EXECUTE 'ALTER TABLE {table} ADD CONSTRAINT {table}_pkey PRIMARY KEY ({pk_column})';
            END IF;
        END
        $$;
        """
    )


def ensure_unique_not_null(cursor, table: str, column: str, index_name: str):
    cursor.execute(f"ALTER TABLE {table} ALTER COLUMN {column} SET NOT NULL;")
    cursor.execute(f"CREATE UNIQUE INDEX IF NOT EXISTS {index_name} ON {table}({column});")


def migrate():
    conn = None
    cursor = None

    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        print("Connected to database successfully!")
        print("\n--- Migration: bigint counter primary keys ---\n")

        targets = [
            ("users", "user_no", [("id", "users_id_key")]),
            ("student", "student_no", [("student_id", "student_student_id_key")]),
            ("parent_info", "parent_info_no", [("student_id", "parent_info_student_id_key")]),
            ("tenth_mark", "tenth_mark_no", [("student_id", "tenth_mark_student_id_key")]),
            ("twelfth_mark", "twelfth_mark_no", [("student_id", "twelfth_mark_student_id_key")]),
        ]

        for table, pk_column, preserved_keys in targets:
            if not table_exists(cursor, table):
                print(f"⏭️  Skipping {table} (table not found)")
                continue

            print(f"Updating {table}...")
            ensure_counter_pk(cursor, table, pk_column)
            for col, index_name in preserved_keys:
                ensure_unique_not_null(cursor, table, col, index_name)
            print(f"  ✅ {table} updated")

        conn.commit()
        print("\n✅ Migration completed successfully!")
        print("New inserts will use bigint counter primary keys.")

    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        if conn:
            conn.rollback()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
        print("\nDatabase connection closed.")


if __name__ == "__main__":
    print("=" * 60)
    print("GRAAVITONS SMS - Primary Key Migration")
    print("Switch PKs to bigint counters")
    print("=" * 60)

    confirmation = input(
        "\nThis will change primary keys for users/student/parent_info/tenth_mark/twelfth_mark.\n"
        "Existing data will be preserved. Continue? (yes/no): "
    )

    if confirmation.lower() == "yes":
        migrate()
    else:
        print("Migration cancelled.")
