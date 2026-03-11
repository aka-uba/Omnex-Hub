#!/bin/sh
set -e

PASSWD_FILE="/mosquitto/config/passwd"

# Generate password file if not exists or env changed
if [ -n "$MQTT_SERVER_USER" ] && [ -n "$MQTT_SERVER_PASS" ]; then
    echo "[mqtt-entrypoint] Creating/updating password file..."

    # Create fresh password file
    : > "$PASSWD_FILE"

    # Add server user (app container uses this)
    mosquitto_passwd -b "$PASSWD_FILE" "$MQTT_SERVER_USER" "$MQTT_SERVER_PASS"

    # Add device user (ESL devices use this)
    if [ -n "$MQTT_DEVICE_USER" ] && [ -n "$MQTT_DEVICE_PASS" ]; then
        mosquitto_passwd -b "$PASSWD_FILE" "$MQTT_DEVICE_USER" "$MQTT_DEVICE_PASS"
    fi

    echo "[mqtt-entrypoint] Password file ready ($(wc -l < "$PASSWD_FILE") users)"
else
    echo "[mqtt-entrypoint] WARNING: MQTT_SERVER_USER/PASS not set, using existing passwd file"
fi

# Ensure data directory exists
mkdir -p /mosquitto/data /mosquitto/log
chown -R mosquitto:mosquitto /mosquitto/data /mosquitto/log

echo "[mqtt-entrypoint] Starting Mosquitto broker..."
exec /usr/sbin/mosquitto -c /mosquitto/config/mosquitto.conf
