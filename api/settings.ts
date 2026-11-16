import { handle } from '../src/server/http.js'

export const runtime = 'nodejs'
export const regions = ['syd1']

export function GET(request: Request) {
  return handle(request)
}

export function PUT(request: Request) {
  return handle(request)
}
