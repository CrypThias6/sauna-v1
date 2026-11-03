import { useEffect, useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

const cache = new Map<string, CanvasTexture>()

function woodTexture(base: string, grain: string) {
  const key = `${base}|${grain}`
  const existing = cache.get(key)
  if (existing) return existing

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not draw wood')

  context.fillStyle = base
  context.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 22; i++) {
    context.strokeStyle = grain
    context.globalAlpha = 0.12 + (i % 4) * 0.06
    context.lineWidth = i % 5 === 0 ? 2 : 1
    context.beginPath()
    const x = (i * 19) % 128
    context.moveTo(x, 0)
    context.bezierCurveTo(x + 4, 80, x - 6, 160, x + 2, 256)
    context.stroke()
  }

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.anisotropy = 4
  cache.set(key, texture)
  return texture
}

export function useWoodMap(base: string, grain: string, repeat: [number, number] = [1, 1]) {
  const map = useMemo(() => {
    const texture = woodTexture(base, grain).clone()
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(repeat[0], repeat[1])
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    return texture
  }, [base, grain, repeat[0], repeat[1]])

  useEffect(() => () => map.dispose(), [map])
  return map
}
