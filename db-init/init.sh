#!/bin/bash
set -e

# Wait for the database to be ready
# (Actually, scripts in /docker-entrypoint-initdb.d/ are run while the postgres server is up but before it accepts external connections)

for dump_file in /docker-entrypoint-initdb.d/*.dump; do
    if [ -f "$dump_file" ]; then
        echo "Found database dump: $dump_file"
        echo "Restoring database..."
        
        # We try pg_restore first. If it's a plain SQL file, pg_restore might fail, so we fallback to psql.
        # -Fc is custom format, -Fd is directory format, -Ft is tar format. pg_restore handles these.
        if pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" -1 "$dump_file" 2>/dev/null; then
            echo "Successfully restored $dump_file using pg_restore."
        else
            echo "pg_restore failed, attempting to run as plain SQL using psql..."
            psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$dump_file"
            echo "Successfully executed $dump_file using psql."
        fi
    fi
done
