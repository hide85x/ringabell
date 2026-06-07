declare module '#auth-utils' {
  interface User {
    email: string
    name: string
    avatar: string
    role: 'Admin' | 'Manager' | 'Personel'
  }
}

export {}
