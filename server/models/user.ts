export interface User {
  id?: string
  email: string
  name: string
  avatar: string
  role: 'Admin' | 'Manager' | 'Personel'
  passwordHash?: string
  createdAt: string
}
