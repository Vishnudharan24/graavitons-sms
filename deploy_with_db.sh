#!/bin/bash
# deploy_with_db.sh
set -e

# Path to the dump file (assuming it's in the home directory as per the user's prompt)
DUMP_FILE="$HOME/data.dump"

if [ -f "data.dump" ]; then
    DUMP_FILE="data.dump"
elif [ ! -f "$DUMP_FILE" ]; then
    echo "Error: Could not find data.dump in the current directory or $HOME."
    echo "Please place data.dump in the same directory as this script and try again."
    exit 1
fi

echo "Copying data.dump ($DUMP_FILE) to db-init folder..."
cp "$DUMP_FILE" ./db-init/data.dump

echo "Starting the application and database..."
docker-compose down # Stop existing containers to ensure a clean slate if needed
docker-compose up -d --build

echo ""
echo "=========================================================="
echo "Application and database containers are starting up."
echo "The database is being automatically restored from the dump."
echo "You can monitor the database initialization logs with:"
echo "    docker-compose logs -f postgres"
echo "=========================================================="
