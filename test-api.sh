#!/bin/bash

# YB News API — Quick Test Script
# Usage: bash test-api.sh

BASE_URL="http://localhost:3000"
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 YB News API Test Script\n${NC}"

# Test 1: Health Check
echo -e "${BLUE}1️⃣  Testing Health Check...${NC}"
curl -s "$BASE_URL/api/health" | jq . || echo "❌ Health check failed"
echo ""

# Test 2: Get News
echo -e "${BLUE}2️⃣  Testing Get News List...${NC}"
curl -s "$BASE_URL/api/news?page=1&pageSize=5" | jq '.articles[0]' || echo "❌ News list failed"
echo ""

# Test 3: Get Categories
echo -e "${BLUE}3️⃣  Testing Get Categories...${NC}"
curl -s "$BASE_URL/api/news/categories" | jq . || echo "❌ Categories failed"
echo ""

# Test 4: Search News
echo -e "${BLUE}4️⃣  Testing Search News...${NC}"
curl -s "$BASE_URL/api/news/search?q=technology&page=1&pageSize=5" | jq '.articles[0]' || echo "❌ Search failed"
echo ""

# Test 5: Get News by Category
echo -e "${BLUE}5️⃣  Testing Get News by Category...${NC}"
curl -s "$BASE_URL/api/news/category/technology?page=1&pageSize=5" | jq '.articles[0]' || echo "❌ Category filter failed"
echo ""

# Test 6: Login (requires codingin19@gmail.com to exist)
echo -e "${BLUE}6️⃣  Testing Login...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"codingin19@gmail.com","password":"password"}')

echo "$LOGIN_RESPONSE" | jq .

USER_ID=$(echo "$LOGIN_RESPONSE" | jq -r '.userId // empty')
if [ -z "$USER_ID" ]; then
  echo "❌ Login failed or no userId in response"
else
  echo -e "${GREEN}✅ Got userId: $USER_ID${NC}"
fi
echo ""

echo -e "${GREEN}✨ All basic tests completed!${NC}"
echo ""
echo -e "${BLUE}📚 API Endpoints:${NC}"
echo "  GET  /api/health"
echo "  GET  /api/news"
echo "  GET  /api/news/search?q=keyword"
echo "  GET  /api/news/categories"
echo "  GET  /api/news/category/:category"
echo "  POST /api/auth/register"
echo "  POST /api/auth/login"
echo "  POST /api/auth/verify-otp"
echo "  GET  /api/auth/me (requires token)"
echo "  GET  /api/bookmarks (requires token)"
echo "  POST /api/bookmarks (requires token)"
echo ""
echo -e "${BLUE}💡 Pro tip: Import YB_News_API.postman_collection.json into Postman for full testing!${NC}"
