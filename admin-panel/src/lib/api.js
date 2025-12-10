import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('accessToken');
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for token refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                if (!refreshToken) throw new Error('No refresh token');

                const response = await axios.post(`${API_URL}/api/auth/refresh`, {
                    refreshToken
                });

                if (response.data.success) {
                    const { accessToken } = response.data.data;
                    localStorage.setItem('accessToken', accessToken);
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Redirect to login
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    login: (email, password) => api.post('/api/auth/login', { email, password }),
    logout: (refreshToken) => api.post('/api/auth/logout', { refreshToken }),
    refresh: (refreshToken) => api.post('/api/auth/refresh', { refreshToken }),
    me: () => api.get('/api/auth/me'),
    getUsers: () => api.get('/api/auth/users'),
    createUser: (data) => api.post('/api/auth/register', data),
    updateUser: (id, data) => api.put(`/api/auth/users/${id}`, data),
    resetPassword: (id, password) => api.put(`/api/auth/users/${id}/reset-password`, { password })
};

// Properties API
export const propertiesApi = {
    getAll: (params) => api.get('/api/properties', { params }),
    getById: (id) => api.get(`/api/properties/${id}`),
    create: (data) => api.post('/api/properties', data),
    update: (id, data) => api.put(`/api/properties/${id}`, data),
    delete: (id) => api.delete(`/api/properties/${id}`)
};

// Stats API
export const statsApi = {
    get: () => api.get('/api/stats')
};

// Tips API
export const tipsApi = {
    getAll: (params) => api.get('/api/tips', { params }),
    getById: (slug) => api.get(`/api/tips/${slug}`),
    create: (data) => api.post('/api/tips', data),
    update: (id, data) => api.put(`/api/tips/${id}`, data),
    delete: (id) => api.delete(`/api/tips/${id}`)
};

// FAQ API
export const faqApi = {
    getAll: (params) => api.get('/api/faq', { params }),
    getById: (id) => api.get(`/api/faq/${id}`),
    create: (data) => api.post('/api/faq', data),
    update: (id, data) => api.put(`/api/faq/${id}`, data),
    delete: (id) => api.delete(`/api/faq/${id}`)
};

// Contact API
export const contactApi = {
    getAll: (params) => api.get('/api/contact', { params }),
    getById: (id) => api.get(`/api/contact/${id}`),
    updateStatus: (id, status) => api.put(`/api/contact/${id}`, { status }),
    delete: (id) => api.delete(`/api/contact/${id}`)
};

// Upload API
export const uploadApi = {
    uploadImage: (formData) => api.post('/api/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    uploadImages: (formData) => api.post('/api/upload/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    })
};

export default api;
