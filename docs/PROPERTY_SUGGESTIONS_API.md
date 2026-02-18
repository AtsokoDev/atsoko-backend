# Property Suggestions API

## Overview

This endpoint provides lightweight search suggestions for search-as-you-type UI (autocomplete dropdown).

- Endpoint: `GET /api/properties/suggestions`
- Auth: Optional
  - Guest: only published properties
  - Agent: only own team properties
  - Admin: all properties

## Query Parameters

- `q` (required): search text, minimum 2 characters
- `limit` (optional): max suggestions to return, default `8`, max `20`
- `status` (optional): filter by status
- `type` (optional): filter by type (`warehouse` keeps all types, same behavior as main endpoint)
- `province` (optional): filter by province
- `district` (optional): filter by district
- `sub_district` (optional): filter by sub-district

## Response

```json
{
  "success": true,
  "data": [
    {
      "id": 1844,
      "property_id": "AT57R",
      "title": "Factory or Warehouse 220 sqm for Rent at ...",
      "subtitle": "Khlong Song, Khlong Luang, Pathum Thani",
      "type": "Factory",
      "status": "For Rent",
      "slug": "factory-or-warehouse-220-sqm-for-rent-at-...",
      "size": "220.00",
      "price": "30000.00",
      "price_alternative": null
    }
  ],
  "meta": {
    "query": "warehouse",
    "limit": 8
  }
}
```

## Search Logic

Ranking combines:

1. Full-text search (`to_tsvector` + `plainto_tsquery`)
2. Exact match boost for `property_id`
3. Trigram similarity (`pg_trgm`) for typo tolerance
4. Fallback partial match via `ILIKE`

Final order:

1. relevance score (`search_rank`) descending
2. `updated_at` descending

## Frontend Integration (Example)

```javascript
import { useEffect, useState } from 'react';

export function usePropertySuggestions(query, filters = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ q, limit: '8' });
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, String(value));
        });

        const res = await fetch(`/api/properties/suggestions?${params.toString()}`, {
          signal: controller.signal
        });
        const data = await res.json();
        setItems(data.success ? data.data : []);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250); // debounce

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, JSON.stringify(filters)]);

  return { items, loading };
}
```

## Recommended UX Behavior

- Call endpoint only when `q.length >= 2`
- Debounce requests (`200-300ms`)
- Cancel previous request when user keeps typing
- Show top 5-8 suggestions
- On suggestion click:
  - Navigate to property detail (`slug` or `property_id`)
  - Or fill input and submit full search
