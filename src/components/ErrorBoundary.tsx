import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/** Catches render errors so one bad panel does not blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container py-16 text-center space-y-4">
          <h2 className="font-display text-2xl">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {this.props.label ? `${this.props.label} could not load.` : "This section could not load."}{" "}
            Try refreshing — your data is safe.
          </p>
          <Button variant="outline" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
