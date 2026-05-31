#!/bin/bash

# ===========================================
# 生成自签名 SSL 证书（仅用于开发/测试）
# 生产环境请使用正式证书
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SSL_DIR="$SCRIPT_DIR/../nginx/ssl"

mkdir -p "$SSL_DIR"

echo "生成自签名 SSL 证书到 $SSL_DIR ..."

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout "$SSL_DIR/key.pem" \
  -out "$SSL_DIR/cert.pem" \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=MuuAgent/OU=Dev/CN=localhost"

echo "✓ 证书生成完成"
echo "  证书: $SSL_DIR/cert.pem"
echo "  私钥: $SSL_DIR/key.pem"
echo ""
echo "注意: 此证书仅用于开发测试，生产环境请替换为正式证书"
