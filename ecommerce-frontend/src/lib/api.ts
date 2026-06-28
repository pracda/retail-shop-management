import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api/v1'

const api = axios.create({ baseURL: API_URL, withCredentials: false })

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('ec_access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('ec_refresh_token')
        if (!refresh) throw new Error('no refresh token')
        const { data } = await axios.post(`${API_URL}/ecommerce/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refresh}` },
        })
        const newAccess = data.data.accessToken
        const newRefresh = data.data.refreshToken
        localStorage.setItem('ec_access_token', newAccess)
        localStorage.setItem('ec_refresh_token', newRefresh)
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      } catch {
        localStorage.removeItem('ec_access_token')
        localStorage.removeItem('ec_refresh_token')
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
