import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

/** A dead WebGL context should not take the readings and cameras with it. */
export class ViewError extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="view-fallback">
          <p>The 3D view didn't start in this browser.</p>
          <p>Temperature, people, and cameras underneath are still live.</p>
        </div>
      )
    }
    return this.props.children
  }
}
