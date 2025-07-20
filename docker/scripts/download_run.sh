#!/bin/sh

VERSION=${1:-latest}

# Remove old binary
rm -rf /opt/fileshare/fileshare-server
rm -rf /opt/fileshare/public
rm -rf /opt/fileshare/migrations
rm -rf /opt/fileshare/f3d

# Download and extract desired fileshare version
wget -O /opt/fileshare/fileshare.zip https://github.com/PierreEVEN/fileshare/releases/$VERSION/download/fileshare_server_linux_musl.zip  > /opt/fileshare/update.log 2>&1
unzip /opt/fileshare/fileshare.zip -d /opt

# Install
chmod u+x /opt/fileshare/fileshare-server

cp -r /opt/fileshare/migrations /migrations

# Cleanup
rm /opt/fileshare/fileshare.zip

chmod u+x /opt/fileshare/f3d/bin/f3d
mv /opt/fileshare/f3d/bin/f3d /usr/local/bin/
mv /opt/fileshare/f3d/lib/* /usr/local/lib/

# Start virtual display server
export __GLX_VENDOR_LIBRARY_NAME=mesa
export LIBGL_ALWAYS_SOFTWARE=1
export DISPLAY=:5
Xvfb :5 -screen 0 800x600x24 &
sleep 3
exec "$@"

# Run
/opt/fileshare/fileshare-server