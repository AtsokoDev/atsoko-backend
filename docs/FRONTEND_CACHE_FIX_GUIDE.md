# 🔧 Frontend Cache Issue - แนวทางแก้ไขสำหรับทีม Frontend

## 🐛 ปัญหาที่พบ

**อาการ:** ข้อมูลที่สร้าง/อัพเดทใหม่ไม่แสดงทันที ต้อง refresh หน้าเว็บถึงจะเห็น

**สาเหตุ:** Frontend cache ไม่ invalidate หลังจากมีการเปลี่ยนแปลงข้อมูล

---

## ✅ สิ่งที่ต้องตรวจสอบและแก้ไข

### 1. **React Query / TanStack Query Cache Settings**

#### ปัญหา: `staleTime` และ `cacheTime` สูงเกินไป

```javascript
// ❌ ไม่ดี - cache นานเกินไป
const { data } = useQuery('properties', fetchProperties, {
  staleTime: 5 * 60 * 1000,  // 5 นาที
  cacheTime: 30 * 60 * 1000, // 30 นาที
});
```

#### แก้ไข: ลด staleTime หรือใช้ invalidation

```javascript
// ✅ ดีกว่า - ลด staleTime
const { data } = useQuery('properties', fetchProperties, {
  staleTime: 0,              // ถือว่าข้อมูลเก่าทันที
  cacheTime: 5 * 60 * 1000,  // เก็บใน cache 5 นาที
  refetchOnMount: true,      // ดึงข้อมูลใหม่เมื่อ mount
  refetchOnWindowFocus: true // ดึงข้อมูลใหม่เมื่อกลับมาที่หน้าต่าง
});
```

### 2. **Invalidate Cache หลังจาก Mutation**

#### ปัญหา: สร้าง/อัพเดทข้อมูลแล้วไม่ invalidate cache

```javascript
// ❌ ไม่ดี - ไม่ invalidate cache
const createProperty = async (data) => {
  await api.post('/properties', data);
  // ไม่มีการ invalidate → ข้อมูลเก่ายังอยู่ใน cache
};
```

#### แก้ไข: ใช้ `useMutation` พร้อม `invalidateQueries`

```javascript
// ✅ ดี - invalidate cache หลัง mutation
import { useMutation, useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

const createPropertyMutation = useMutation({
  mutationFn: (data) => api.post('/properties', data),
  onSuccess: () => {
    // Invalidate และ refetch
    queryClient.invalidateQueries(['properties']);
    queryClient.invalidateQueries(['property-stats']);
  },
});

// ใช้งาน
const handleCreate = async (data) => {
  await createPropertyMutation.mutateAsync(data);
  // ข้อมูลจะถูก refetch อัตโนมัติ
};
```

### 3. **Invalidate Cache สำหรับทุก Mutation**

```javascript
// ✅ Pattern ที่ควรใช้สำหรับทุก mutation

// CREATE
const createMutation = useMutation({
  mutationFn: (data) => api.post('/properties', data),
  onSuccess: () => {
    queryClient.invalidateQueries(['properties']);
  },
});

// UPDATE
const updateMutation = useMutation({
  mutationFn: ({ id, data }) => api.put(`/properties/${id}`, data),
  onSuccess: (data, variables) => {
    // Invalidate list
    queryClient.invalidateQueries(['properties']);
    // Invalidate specific item
    queryClient.invalidateQueries(['property', variables.id]);
  },
});

// DELETE
const deleteMutation = useMutation({
  mutationFn: (id) => api.delete(`/properties/${id}`),
  onSuccess: () => {
    queryClient.invalidateQueries(['properties']);
  },
});
```

### 4. **SWR Cache (ถ้าใช้ SWR แทน React Query)**

```javascript
// ❌ ไม่ดี
import useSWR from 'swr';

const { data } = useSWR('/api/properties', fetcher, {
  revalidateOnFocus: false,  // ไม่ revalidate
  dedupingInterval: 60000,   // 1 นาที
});
```

```javascript
// ✅ ดี
import useSWR, { mutate } from 'swr';

const { data } = useSWR('/api/properties', fetcher, {
  revalidateOnFocus: true,   // revalidate เมื่อกลับมาที่หน้าต่าง
  revalidateOnMount: true,   // revalidate เมื่อ mount
  dedupingInterval: 2000,    // ลดเหลือ 2 วินาที
});

// หลัง mutation
const handleUpdate = async (data) => {
  await api.put('/properties/123', data);
  // Revalidate cache
  mutate('/api/properties');
};
```

### 5. **Polling / Auto-refetch สำหรับหน้าที่สำคัญ**

```javascript
// ✅ Auto-refetch ทุก 30 วินาทีสำหรับหน้ารายการหลัก
const { data } = useQuery('properties', fetchProperties, {
  refetchInterval: 30000, // refetch ทุก 30 วินาที
  refetchIntervalInBackground: false, // หยุด polling เมื่อไม่ได้ดูหน้านี้
});
```

### 6. **ตรวจสอบ HTTP Cache Headers**

```javascript
// ✅ ตั้งค่า axios/fetch ให้ไม่ cache
const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  },
});
```

---

## 🧪 วิธีทดสอบว่าแก้ไขถูกต้อง

### Test Case 1: Create Property
1. สร้าง property ใหม่ใน admin panel
2. ดูหน้ารายการ property
3. **ต้องเห็น property ใหม่ทันที** (ไม่ต้อง refresh)

### Test Case 2: Update Property
1. แก้ไข property ที่มีอยู่
2. กลับไปดูหน้ารายการ
3. **ต้องเห็นข้อมูลที่อัพเดทแล้ว** (ไม่ต้อง refresh)

### Test Case 3: Delete Property
1. ลบ property
2. ดูหน้ารายการ
3. **property ที่ลบต้องหายไป** (ไม่ต้อง refresh)

---

## 📋 Checklist สำหรับทีม Frontend

- [ ] ตรวจสอบ `staleTime` ใน React Query config (ควรเป็น 0 หรือต่ำ)
- [ ] เพิ่ม `queryClient.invalidateQueries()` ในทุก mutation
- [ ] ตั้งค่า `refetchOnMount: true` และ `refetchOnWindowFocus: true`
- [ ] ตรวจสอบว่าไม่มี custom cache middleware ที่ขัดขวาง
- [ ] ลบ `Cache-Control` headers ที่อาจทำให้ browser cache
- [ ] ทดสอบทั้ง 3 test cases ด้านบน

---

## 🎯 Code Examples ที่พร้อมใช้

### Example 1: Properties List Component

```javascript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function PropertiesList() {
  const queryClient = useQueryClient();

  // Fetch properties
  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetch('/api/properties?limit=100&sort=updated_at').then(r => r.json()),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => fetch(`/api/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['properties']);
    },
  });

  return (
    <div>
      {data?.data?.map(property => (
        <div key={property.id}>
          {property.title}
          <button onClick={() => deleteMutation.mutate(property.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Example 2: Property Form Component

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';

function PropertyForm({ propertyId, onSuccess }) {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => 
      fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      // Invalidate list
      queryClient.invalidateQueries(['properties']);
      // Invalidate specific item
      queryClient.invalidateQueries(['property', propertyId]);
      onSuccess?.();
    },
  });

  const handleSubmit = (formData) => {
    updateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  );
}
```

### Example 3: Global Query Client Config

```javascript
// App.js หรือ main.jsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,              // ข้อมูลเก่าทันที
      cacheTime: 5 * 60 * 1000,  // เก็บใน cache 5 นาที
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* app content */}
    </QueryClientProvider>
  );
}
```

---

## 🔍 Debug Tools

### React Query Devtools
```javascript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

ใช้ Devtools เพื่อ:
- ดู cache status
- ดูว่า query ไหน stale/fresh
- Manually invalidate queries
- ดู refetch behavior

---

## 📞 ติดต่อกลับ

หลังจากแก้ไขแล้ว กรุณาทดสอบและแจ้งผลลัพธ์:
- ✅ แก้ไขแล้ว ทำงานปกติ
- ⚠️ ยังมีปัญหาบางกรณี (ระบุกรณีที่ยังมีปัญหา)
- ❌ ยังไม่ได้ผล (ส่ง console logs และ network tab screenshots)

---

## 🎓 อ่านเพิ่มเติม

- [React Query - Invalidation](https://tanstack.com/query/latest/docs/react/guides/invalidations-from-mutations)
- [React Query - Window Focus Refetching](https://tanstack.com/query/latest/docs/react/guides/window-focus-refetching)
- [SWR - Mutation and Revalidation](https://swr.vercel.app/docs/mutation)
