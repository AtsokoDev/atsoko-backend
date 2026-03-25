# Frontend Filter Mapping for Properties

This document maps frontend filter controls to the exact backend query parameters for:

- `GET /api/properties`
- Option sources under `GET /api/options/*`

Use this as the source of truth when implementing or validating frontend filters.

## 1. Canonical Query Parameters

Use these parameter names exactly.

| Frontend control | Query key | Type | Example value | Backend behavior |
|---|---|---|---|---|
| Property type (Warehouse/Factory) | `type` | string | `warehouse`, `factory` | Special case: `warehouse` means no type filter (shows all types). Non-warehouse values apply `ILIKE`. |
| Listing status (For Rent/For Sale) | `status` | string | `rent`, `sale` | Applies `status ILIKE %value%`. |
| Province (single/multi) | `province` | string or CSV | `Bangkok` or `Bangkok,Chonburi` | Supports single or comma-separated multi values; multi uses OR conditions. |
| District (single/multi) | `district` | string or CSV | `Bang Bo` or `Bang Bo,Mueang` | Supports single or comma-separated multi values; multi uses OR conditions. |
| Sub-district (single/multi) | `sub_district` | string or CSV | `Bang Phriang` or `Bang Phriang,Bang Sao Thong` | Supports single or comma-separated multi values; multi uses OR conditions. |
| Area min (sqm) | `size_min` | number | `300` | Applies `size >= size_min`. |
| Area max (sqm) | `size_max` | number | `1200` | Applies `size <= size_max`. |
| Price min | `price_min` | number | `25000` | Applies against smart price field (see section 3). |
| Price max | `price_max` | number | `80000` | Applies against smart price field (see section 3). |
| Features (multi-select) | `features` | CSV or array-like input converted to CSV | `With Office area,Security guard` | Backend parses CSV to array and uses JSONB contains (`@>`), meaning all selected features must exist. |
| Single feature fallback | `feature` | string | `Security guard` | Used only when `features` is not provided. |
| Clear height min | `min_height` | number | `8` | Extracts numeric part from `clear_height` text and filters `>=`. |
| Clear height max | `max_height` | number | `12` | Extracts numeric part from `clear_height` text and filters `<=`. |
| Clear height exact (optional mode) | `clear_height` | string | `8m` | Used only when `min_height` and `max_height` are both absent. |
| Floor load minimum | `floor_load` | string or number-like | `3`, `3 tons` | Backend parses numeric value and filters floor load as `>= selected value`. |

## 2. Option Endpoints for Dropdowns

Use these endpoints to populate frontend controls.

| Frontend dropdown | Endpoint | Notes |
|---|---|---|
| Type | `GET /api/options/types` | Multi-language labels available. |
| Status | `GET /api/options/statuses` | Multi-language labels available. |
| Province | `GET /api/options/provinces` | Returns location IDs and names. |
| District (depends on province) | `GET /api/options/districts/:provinceId` | Cascade by selected province ID. |
| Sub-district (depends on district) | `GET /api/options/subdistricts/:districtId` | Cascade by selected district ID. |
| Features | `GET /api/options/features` | Use names/values consistently with property data. |
| Clear height | `GET /api/options/clear-height` | Returns `value` plus multi-language names. |
| Floor load | `GET /api/options/floor-load` | Distinct values from data. |

Important:

- Cascading endpoints use IDs to fetch children.
- Property list filtering uses names/text (`province`, `district`, `sub_district`) in query params.

## 3. Smart Price Field Rule

Backend decides the price column by `status`:

- If `status` includes `sale` -> filter uses `price_alternative`
- Otherwise -> filter uses `price`

Frontend should:

- Always send `price_min` and `price_max`
- Always send `status` clearly when filtering by price, so users get expected rent/sale pricing behavior

## 4. Known Naming Traps (Do Not Use)

Do not send old keys below for `GET /api/properties`:

- `min_size`, `max_size` -> use `size_min`, `size_max`
- `min_price`, `max_price` -> use `price_min`, `price_max`

## 5. Copy-Ready Frontend Mapping

```js
const filterToQueryMap = {
  type: "type",
  status: "status",
  provinces: "province",      // send CSV string
  districts: "district",      // send CSV string
  subDistricts: "sub_district", // send CSV string
  areaMin: "size_min",
  areaMax: "size_max",
  priceMin: "price_min",
  priceMax: "price_max",
  features: "features",       // send CSV string from selected features
  feature: "feature",         // optional single fallback
  minHeight: "min_height",
  maxHeight: "max_height",
  clearHeight: "clear_height", // only if min/max not set
  floorLoad: "floor_load",
};

function toCsv(values) {
  if (!Array.isArray(values)) return values || "";
  return values.map(v => String(v).trim()).filter(Boolean).join(",");
}

function buildPropertyQuery(filters) {
  const params = new URLSearchParams();

  const put = (key, value) => {
    if (value === undefined || value === null) return;
    const stringValue = String(value).trim();
    if (!stringValue) return;
    params.set(key, stringValue);
  };

  put("type", filters.type);
  put("status", filters.status);
  put("province", toCsv(filters.provinces));
  put("district", toCsv(filters.districts));
  put("sub_district", toCsv(filters.subDistricts));
  put("size_min", filters.areaMin);
  put("size_max", filters.areaMax);
  put("price_min", filters.priceMin);
  put("price_max", filters.priceMax);

  const featuresCsv = toCsv(filters.features);
  if (featuresCsv) {
    put("features", featuresCsv);
  } else {
    put("feature", filters.feature);
  }

  put("min_height", filters.minHeight);
  put("max_height", filters.maxHeight);

  // exact clear_height only when range is not used
  if (!filters.minHeight && !filters.maxHeight) {
    put("clear_height", filters.clearHeight);
  }

  put("floor_load", filters.floorLoad);

  return params.toString();
}
```

## 6. QA Checklist (Frontend Completeness)

Mark done only when each item is implemented and verified:

- [ ] `type` filter wired (`warehouse` behavior understood as no type restriction)
- [ ] `status` filter wired (`rent` / `sale`)
- [ ] province/district/sub-district cascading UI wired via options endpoints
- [ ] list query sends `province`, `district`, `sub_district` correctly
- [ ] area query keys use `size_min` / `size_max`
- [ ] price query keys use `price_min` / `price_max`
- [ ] features multi-select sends `features` CSV
- [ ] floor load sends numeric-comparable value through `floor_load`
- [ ] clear height supports range (`min_height`, `max_height`) and optional exact (`clear_height`)
- [ ] empty filters are removed before request
- [ ] multi-select location values serialize to CSV

## 7. Current Frontend_TEST Gaps (for quick review)

- Uses `min_size` / `max_size` in current test UI logic; should be `size_min` / `size_max`.
- Main page currently lacks district, sub-district, price range, features, clear height, and floor load controls.
- Test frontend does not currently consume `/api/options/*` for dynamic dropdown population.
