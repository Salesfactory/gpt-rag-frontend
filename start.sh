#!/usr/bin/env bash
echo "starting script"

# Loading env variables

export $(grep -v '^#' .env | xargs)

# Install system dependencies for PDF processing
echo "Installing system dependencies"
sudo apt-get update
sudo apt-get install -y \
    libpango-1.0-0 \
    libharfbuzz0b \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    libffi-dev \
    libjpeg-dev \
    libopenjp2-7-dev \
    libglib2.0-0 \
    libglib2.0-dev \
    libcairo2 \
    libcairo2-dev \
    libpangocairo-1.0-0 \
    pkg-config \
    python3-dev \
    python3-cffi \
    libgobject-2.0-0 \
    fonts-liberation \
    libgdk-pixbuf2.0-0 \
    shared-mime-info
    
# echo ""
# echo "Loading azd .env file from current environment"
# echo ""

# while IFS='=' read -r key value; do
#     value=$(echo "$value" | sed 's/^"//' | sed 's/"$//')
#     export "$key=$value"
# done <<EOF
# $(azd env get-values)
# EOF

# if [ $? -ne 0 ]; then
#     echo "Failed to load environment variables from azd environment"
#     exit $?
# fi

echo 'Creating python virtual environment "backend/backend_env"'
python3 -m venv backend/backend_env

echo ""
echo "Restoring backend python packages"
echo ""

cd backend
./backend_env/bin/python3 -m pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "Failed to restore backend python packages"
    exit $?
fi

echo ""
echo "Restoring frontend npm packages"
echo ""

cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "Failed to restore frontend npm packages"
    exit $?
fi

echo ""
echo "Building frontend"
npm run build
echo ""

# npm run build
if [ $? -ne 0 ]; then
    echo "Failed to build frontend"
    exit $?
fi

echo ""
echo "Starting backend"
echo ""

cd ../backend
xdg-open http://127.0.0.1:8000
./backend_env/bin/python3 ./app.py
if [ $? -ne 0 ]; then
    echo "Failed to start backend"
    exit $?
fi
