type AllowedOrigin = string

const allowedOrigins: AllowedOrigin[] = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:3500',
  'http://localhost:3501',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3500',
  'http://127.0.0.1:3501',
  'http://192.168.1.1:3001',
  'http://192.168.1.1:3500',
  'http://192.168.1.1:3501',
  'http://192.168.40.7:3001',
  'http://192.168.40.7:3500',
  'http://192.168.1.7:3001',
  'http://192.168.1.7:3500',
  'http://192.168.1.104:80',
  'http://192.168.1.104:80',
  'https://192.168.1.104:443',
  'https://192.168.1.104:443',
  'https://bl1231.als.lbl.gov',
  'https://bilbomd.bl1231.als.lbl.gov'
]

export { allowedOrigins }