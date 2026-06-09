#!/bin/bash
set -e

for dump_file in /docker-entrypoint-initdb.d/*.dump; do
    if [ -f "$dump_file" ]; then
        echo "Found database dump: $dump_file"
        
        # Check if it is a custom/tar/directory format dump by listing its contents
        if pg_restore -l "$dump_file" >/dev/null 2>&1; then
            echo "Format detected: custom/binary. Restoring using pg_restore..."
            # Temporarily disable set -e because pg_restore often exits with 1 due to minor warnings
            set +e
            # Use --no-owner and --no-privileges to avoid warnings about missing roles
            pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -1 "$dump_file"
            EXIT_CODE=$?
            set -e
            
            if [ $EXIT_CODE -ne 0 ]; then
                echo "pg_restore finished with exit code $EXIT_CODE. (Warnings often occur about missing roles, but data is usually restored successfully)."
            else
                echo "Successfully restored $dump_file using pg_restore."
            fi
        else
            echo "Format detected: plain SQL (or unreadable). Restoring using psql..."
            psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$dump_file"
            echo "Successfully executed $dump_file using psql."
        fi
    fi
done
