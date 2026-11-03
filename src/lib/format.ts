export function formatTemp(celsius: number) {
  return celsius.toFixed(1)
}

export function formatMin(min: number) {
  if (min < 1) return '<1 min'
  return `${Math.floor(min)} min`
}

export function formatClock(now: number) {
  return new Date(now).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatWhen(now: number) {
  return new Date(now).toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function peopleWord(count: number) {
  return count === 1 ? 'person' : 'people'
}
