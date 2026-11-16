import { handle } from '../src/server/http.js'

export const runtime = 'nodejs'
export const regions = ['syd1']

export function POST(request: Request) {
  return handle(request)
}
