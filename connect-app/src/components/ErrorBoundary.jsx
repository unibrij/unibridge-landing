// connect-app/src/components/ErrorBoundary.jsx

import {
  Component
} from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError:
        false
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError:
        true
    };
  }

  componentDidCatch(
    error,
    info
  ) {
    console.error(
      "[CONNECT_RENDER_ERROR]",
      {
        error,
        componentStack:
          info?.componentStack || ""
      }
    );
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (
      this.state.hasError
    ) {
      return (
        <main
          style={{
            minHeight:
              "100vh",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding:
              "24px",
            boxSizing:
              "border-box"
          }}
        >
          <div
            style={{
              width:
                "100%",
              maxWidth:
                "420px",
              textAlign:
                "center"
            }}
          >
            <h1>
              Something went wrong
            </h1>

            <p>
              UniBridge Connect could not load correctly.
            </p>

            <button
              type="button"
              onClick={
                this.handleReload
              }
            >
              Reload
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
