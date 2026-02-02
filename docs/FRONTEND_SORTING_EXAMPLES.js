// ตัวอย่างการใช้งาน Property Sorting API ใน Frontend
// สามารถใช้กับ React, Vue, หรือ Vanilla JavaScript

// =============================================================================
// 1. ตัวอย่างการส่ง API Request
// =============================================================================

// วิธีที่ 1: ใช้ fetch
async function fetchProperties(filters = {}) {
    const params = new URLSearchParams();

    // เพิ่ม filters
    if (filters.status) params.append('status', filters.status);
    if (filters.province) params.append('province', filters.province);
    if (filters.type) params.append('type', filters.type);

    // เพิ่ม sorting
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.order) params.append('order', filters.order);

    // เพิ่ม pagination
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);

    const response = await fetch(`/api/properties?${params.toString()}`);
    const data = await response.json();

    return data;
}

// ตัวอย่างการใช้งาน
const result = await fetchProperties({
    status: 'rent',
    sort: 'price',
    order: 'asc',
    page: 1,
    limit: 20
});

console.log('Properties:', result.data);
console.log('Current sorting:', result.sorting); // { sort: 'price', order: 'ASC' }

// =============================================================================
// 2. React Component Example
// =============================================================================

import React, { useState, useEffect } from 'react';

function PropertyList() {
    const [properties, setProperties] = useState([]);
    const [sorting, setSorting] = useState({
        sort: 'created_at',
        order: 'desc'
    });
    const [filters, setFilters] = useState({
        status: '',
        province: ''
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0
    });

    // โหลดข้อมูล properties
    useEffect(() => {
        loadProperties();
    }, [sorting, filters, pagination.page]);

    const loadProperties = async () => {
        const params = {
            ...filters,
            ...sorting,
            page: pagination.page,
            limit: pagination.limit
        };

        const result = await fetchProperties(params);

        setProperties(result.data);
        setPagination(result.pagination);
    };

    // เปลี่ยนการเรียงลำดับ
    const handleSortChange = (newSort) => {
        setSorting(prev => ({
            sort: newSort,
            order: prev.sort === newSort
                ? (prev.order === 'desc' ? 'asc' : 'desc') // Toggle order ถ้าคลิกซ้ำ
                : 'desc' // Default desc ถ้าเปลี่ยน field
        }));
    };

    return (
        <div>
            {/* Sort Controls */}
            <div className="sort-controls">
                <select
                    value={sorting.sort}
                    onChange={(e) => handleSortChange(e.target.value)}
                >
                    <option value="created_at">เรียงตามวันที่</option>
                    <option value="price">เรียงตามราคา</option>
                    <option value="id">เรียงตาม ID</option>
                </select>

                <select
                    value={sorting.order}
                    onChange={(e) => setSorting(prev => ({ ...prev, order: e.target.value }))}
                >
                    <option value="desc">
                        {sorting.sort === 'created_at' ? 'ใหม่ > เก่า' : 'สูง > ต่ำ'}
                    </option>
                    <option value="asc">
                        {sorting.sort === 'created_at' ? 'เก่า > ใหม่' : 'ต่ำ > สูง'}
                    </option>
                </select>
            </div>

            {/* Property List */}
            <div className="property-list">
                {properties.map(property => (
                    <PropertyCard key={property.id} property={property} />
                ))}
            </div>

            {/* Pagination */}
            <Pagination
                current={pagination.page}
                total={pagination.pages}
                onChange={(page) => setPagination(prev => ({ ...prev, page }))}
            />
        </div>
    );
}

// =============================================================================
// 3. Dropdown Component Example (Material-UI style)
// =============================================================================

function SortDropdown({ value, onChange }) {
    const sortOptions = [
        { value: 'created_at_desc', label: 'ใหม่ล่าสุด', sort: 'created_at', order: 'desc' },
        { value: 'created_at_asc', label: 'เก่าที่สุด', sort: 'created_at', order: 'asc' },
        { value: 'price_asc', label: 'ราคา: ต่ำ - สูง', sort: 'price', order: 'asc' },
        { value: 'price_desc', label: 'ราคา: สูง - ต่ำ', sort: 'price', order: 'desc' },
    ];

    const currentValue = `${value.sort}_${value.order}`;

    const handleChange = (e) => {
        const selected = sortOptions.find(opt => opt.value === e.target.value);
        if (selected) {
            onChange({
                sort: selected.sort,
                order: selected.order
            });
        }
    };

    return (
        <select value={currentValue} onChange={handleChange} className="sort-dropdown">
            {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

// ตัวอย่างการใช้งาน
function App() {
    const [sorting, setSorting] = useState({ sort: 'created_at', order: 'desc' });

    return (
        <div>
            <SortDropdown value={sorting} onChange={setSorting} />
            <PropertyList sorting={sorting} />
        </div>
    );
}

// =============================================================================
// 4. URL State Management Example (Next.js)
// =============================================================================

import { useRouter } from 'next/router';

function PropertyPage() {
    const router = useRouter();
    const { sort = 'created_at', order = 'desc', page = '1' } = router.query;

    const updateSort = (newSort, newOrder) => {
        router.push({
            pathname: router.pathname,
            query: {
                ...router.query,
                sort: newSort,
                order: newOrder,
                page: 1 // Reset to page 1 when sorting changes
            }
        }, undefined, { shallow: true });
    };

    return (
        <div>
            <button onClick={() => updateSort('created_at', 'desc')}>
                ใหม่ล่าสุด
            </button>
            <button onClick={() => updateSort('price', 'asc')}>
                ราคาต่ำสุด
            </button>
            <button onClick={() => updateSort('price', 'desc')}>
                ราคาสูงสุด
            </button>
        </div>
    );
}

// =============================================================================
// 5. Advanced Example: Table with Sortable Columns
// =============================================================================

function PropertyTable() {
    const [sorting, setSorting] = useState({ sort: 'created_at', order: 'desc' });

    const SortableHeader = ({ field, label }) => {
        const isActive = sorting.sort === field;
        const isAsc = sorting.order === 'asc';

        const handleClick = () => {
            setSorting({
                sort: field,
                order: isActive && !isAsc ? 'asc' : 'desc'
            });
        };

        return (
            <th onClick={handleClick} className="sortable">
                {label}
                {isActive && (
                    <span className="sort-icon">
                        {isAsc ? '↑' : '↓'}
                    </span>
                )}
            </th>
        );
    };

    return (
        <table>
            <thead>
                <tr>
                    <SortableHeader field="id" label="ID" />
                    <th>Property ID</th>
                    <SortableHeader field="created_at" label="วันที่สร้าง" />
                    <SortableHeader field="price" label="ราคา" />
                    <th>สถานะ</th>
                </tr>
            </thead>
            <tbody>
                {/* Render properties... */}
            </tbody>
        </table>
    );
}

// =============================================================================
// 6. Helper Functions
// =============================================================================

// แปลง sorting object เป็น URL params
function sortingToParams(sorting) {
    return new URLSearchParams({
        sort: sorting.sort,
        order: sorting.order
    }).toString();
}

// แปลง URL params เป็น sorting object
function paramsToSorting(params) {
    const urlParams = new URLSearchParams(params);
    return {
        sort: urlParams.get('sort') || 'created_at',
        order: urlParams.get('order') || 'desc'
    };
}

// ตรวจสอบว่า sorting ที่เลือกเป็น default หรือไม่
function isDefaultSorting(sorting) {
    return sorting.sort === 'created_at' && sorting.order === 'desc';
}

// แสดงชื่อ sorting แบบ user-friendly
function getSortingLabel(sorting, status = null) {
    const { sort, order } = sorting;

    if (sort === 'created_at') {
        return order === 'desc' ? 'ใหม่ล่าสุด' : 'เก่าที่สุด';
    }

    if (sort === 'price') {
        const priceType = status === 'sale' ? 'ราคาขาย' : 'ราคาเช่า';
        return order === 'desc'
            ? `${priceType}: สูง - ต่ำ`
            : `${priceType}: ต่ำ - สูง`;
    }

    if (sort === 'id') {
        return order === 'desc' ? 'ID: ใหม่ - เก่า' : 'ID: เก่า - ใหม่';
    }

    return 'ไม่ระบุ';
}

// ตัวอย่างการใช้งาน helper
console.log(getSortingLabel({ sort: 'price', order: 'asc' }, 'rent'));
// Output: "ราคาเช่า: ต่ำ - สูง"

console.log(getSortingLabel({ sort: 'created_at', order: 'desc' }));
// Output: "ใหม่ล่าสุด"

// =============================================================================
// 7. TypeScript Types (ถ้าใช้ TypeScript)
// =============================================================================

/*
type SortField = 'created_at' | 'price' | 'id';
type SortOrder = 'asc' | 'desc';

interface Sorting {
  sort: SortField;
  order: SortOrder;
}

interface PropertyFilters {
  keyword?: string;
  status?: string;
  province?: string;
  district?: string;
  sort?: SortField;
  order?: SortOrder;
  page?: number;
  limit?: number;
}

interface PropertyResponse {
  success: boolean;
  data: Property[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  sorting: {
    sort: SortField;
    order: 'ASC' | 'DESC'; // Note: Backend returns uppercase
  };
}
*/

export {
    fetchProperties,
    SortDropdown,
    PropertyTable,
    sortingToParams,
    paramsToSorting,
    isDefaultSorting,
    getSortingLabel
};
