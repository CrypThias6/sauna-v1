import { SaunaProvider } from './state/store'
import { Shell } from './components/shell'

export function App() {
  return (
    <SaunaProvider>
      <Shell />
    </SaunaProvider>
  )
}
