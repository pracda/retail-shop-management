import api from './api'

export interface Category {
  id: number
  storeId: number
  storeName: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
}

export async function getCategories(storeId: number, activeOnly = false): Promise<Category[]> {
  const { data } = await api.get('/categories', {
    params: { storeId, activeOnly, size: 200 },
  })
  return data.data.content
}

export async function createCategory(
  storeId: number,
  name: string,
  description?: string,
): Promise<Category> {
  const { data } = await api.post('/categories', { storeId, name, description })
  return data.data
}

export async function updateCategory(
  id: number,
  name: string,
  description?: string,
): Promise<Category> {
  const { data } = await api.put(`/categories/${id}`, { name, description })
  return data.data
}

export async function setCategoryStatus(id: number, active: boolean): Promise<void> {
  await api.patch(`/categories/${id}/${active ? 'activate' : 'deactivate'}`)
}
