#!/bin/bash

# สคริปต์ทดสอบ API สำหรับ property sorting
# ทดสอบการเรียงลำดับแบบต่างๆ

echo "================================"
echo "ทดสอบ Property Sorting API"
echo "================================"
echo ""

API_URL="http://localhost:3000/api/properties"

# ทดสอบ 1: เรียงตาม created_at (new > old) - default
echo "1. เรียงตาม created_at จาก new > old (DESC - default):"
curl -s "${API_URL}?limit=5&sort=created_at&order=desc" | jq '{total: .pagination.total, sort: .sorting, first_item: .data[0] | {id, property_id, created_at}}'
echo ""

# ทดสอบ 2: เรียงตาม created_at (old > new)
echo "2. เรียงตาม created_at จาก old > new (ASC):"
curl -s "${API_URL}?limit=5&sort=created_at&order=asc" | jq '{total: .pagination.total, sort: .sorting, first_item: .data[0] | {id, property_id, created_at}}'
echo ""

# ทดสอบ 3: เรียงตาม price (low to high) - For Rent
echo "3. เรียงตามราคา low to high (ASC) - For Rent:"
curl -s "${API_URL}?limit=5&status=rent&sort=price&order=asc" | jq '{total: .pagination.total, sort: .sorting, price_field: .filters.price_range.field, first_item: .data[0] | {id, property_id, price, status}}'
echo ""

# ทดสอบ 4: เรียงตาม price (high to low) - For Rent
echo "4. เรียงตามราคา high to low (DESC) - For Rent:"
curl -s "${API_URL}?limit=5&status=rent&sort=price&order=desc" | jq '{total: .pagination.total, sort: .sorting, price_field: .filters.price_range.field, first_item: .data[0] | {id, property_id, price, status}}'
echo ""

# ทดสอบ 5: เรียงตาม price (low to high) - For Sale
echo "5. เรียงตามราคา low to high (ASC) - For Sale:"
curl -s "${API_URL}?limit=5&status=sale&sort=price&order=asc" | jq '{total: .pagination.total, sort: .sorting, price_field: .filters.price_range.field, first_item: .data[0] | {id, property_id, price_alternative, status}}'
echo ""

# ทดสอบ 6: เรียงตาม price (high to low) - For Sale
echo "6. เรียงตามราคา high to low (DESC) - For Sale:"
curl -s "${API_URL}?limit=5&status=sale&sort=price&order=desc" | jq '{total: .pagination.total, sort: .sorting, price_field: .filters.price_range.field, first_item: .data[0] | {id, property_id, price_alternative, status}}'
echo ""

# ทดสอบ 7: เรียงตาม id (default old behavior)
echo "7. เรียงตาม ID (DESC):"
curl -s "${API_URL}?limit=5&sort=id&order=desc" | jq '{total: .pagination.total, sort: .sorting, first_item: .data[0] | {id, property_id}}'
echo ""

echo "================================"
echo "ทดสอบเสร็จสิ้น!"
echo "================================"
