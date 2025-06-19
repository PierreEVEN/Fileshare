#!/bin/sh

VERSION=${1:-latest}

# Remove old binary
rm -rf /opt/fileshare/fileshare-server
rm -rf /opt/fileshare/libpdfium.so
rm -rf /opt/fileshare/public
rm -rf /opt/fileshare/migrations

# Download and extract desired fileshare version
wget -O /opt/fileshare/fileshare.zip https://github.com/PierreEVEN/fileshare/releases/$VERSION/download/fileshare_server_linux_musl.zip  > /opt/fileshare/update.log 2>&1
unzip /opt/fileshare/fileshare.zip -d /opt

# Install
chmod u+x /opt/fileshare/fileshare-server

cp -r /opt/fileshare/migrations /migrations

# Cleanup
rm /opt/fileshare/fileshare.zip

# Run
/opt/fileshare/fileshare-server