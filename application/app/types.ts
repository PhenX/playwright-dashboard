export type Period = '1d' | '7d' | '30d' | '90d' | '1y' | 'daily' | 'weekly' | 'monthly'
export type Range = { start: Date, end: Date }

export interface Sale {
  id: string
  date: string
  status: 'paid' | 'failed' | 'refunded'
  email: string
  amount: number
}

export interface Stat {
  title: string
  icon: string
  value: string | number
  variation: number
}

export interface Member {
  id: string
  name: string
  username: string
  email: string
  role: string
  avatar?: Record<string, unknown>
}
