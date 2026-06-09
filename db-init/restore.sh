#!/bin/bash
set -e

echo "=== Starting database restore from NeonDB dump ==="

DUMP_FILE="/docker-entrypoint-initdb.d/data.dump"

if [ ! -f "$DUMP_FILE" ]; then
    echo "WARNING: $DUMP_FILE not found. Skipping restore."
    echo "The database will start empty."
    exit 0
fi

echo "Restoring from $DUMP_FILE ..."

# pg_restore into the already-created database
# --no-owner: don't try to set original NeonDB ownership
# --no-privileges: skip NeonDB-specific GRANT statements
pg_restore \
    --verbose \
    --no-owner \
    --no-privileges \
    --dbname="$POSTGRES_DB" \
    --username="$POSTGRES_USER" \
    "$DUMP_FILE" || {
        echo "WARNING: pg_restore exited with errors (this is often OK for NeonDB dumps"
        echo "due to extension/role statements). Checking if tables were created..."

        # Verify that at least some tables exist
        TABLE_COUNT=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c \
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

        if [ "$TABLE_COUNT" -gt 0 ]; then
            echo "SUCCESS: Found $TABLE_COUNT tables in the database."
        else
            echo "ERROR: No tables found after restore. The dump may be corrupted."
            exit 1
        fi
    }

echo "=== Database restore complete ==="
