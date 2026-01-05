#!/bin/bash

echo "🧪 Testing BeatSync PAR URL API"
echo "================================"
echo ""

# Test 1: Generate Upload URL
echo "📤 Test 1: Generate Upload URL"
UPLOAD_RESPONSE=$(curl -s -X POST http://localhost:4000/api/generate-upload-url \
  -H "Content-Type: application/json" \
  -d '{"filename":"test-song.mp3"}')

echo "Response: $UPLOAD_RESPONSE"
UPLOAD_URL=$(echo $UPLOAD_RESPONSE | jq -r '.uploadUrl')
OBJECT_NAME=$(echo $UPLOAD_RESPONSE | jq -r '.objectName')

echo "✅ Upload URL: $UPLOAD_URL"
echo "✅ Object Name: $OBJECT_NAME"
echo ""

# Test 2: Upload a file using the URL
echo "📤 Test 2: Upload test file to OCI"
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: text/plain" \
  --data-binary @test-upload.txt \
  -w "\nHTTP Status: %{http_code}\n"

echo ""

# Test 3: Generate Delete URL
echo "🗑️  Test 3: Generate Delete URL"
DELETE_RESPONSE=$(curl -s -X POST http://localhost:4000/api/generate-delete-url \
  -H "Content-Type: application/json" \
  -d "{\"objectName\":\"$OBJECT_NAME\"}")

echo "Response: $DELETE_RESPONSE"
DELETE_URL=$(echo $DELETE_RESPONSE | jq -r '.deleteUrl')

echo "✅ Delete URL: $DELETE_URL"
echo ""

# Test 4: Delete the file
echo "🗑️  Test 4: Delete file from OCI"
curl -X DELETE "$DELETE_URL" \
  -w "\nHTTP Status: %{http_code}\n"

echo ""
echo "✅ All tests completed!"
