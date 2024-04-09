export type FoxsDataPoint = {
  q: number
  exp_intensity: number
  model_intensity: number
  error: number
}

export type FoxsData = {
  filename: string
  chisq: number
  c1?: number
  c2?: number
  data: FoxsDataPoint[]
}
