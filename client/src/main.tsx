import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import { WorkspaceProvider } from "./context/WorkspaceContext.tsx"
import { ErrorBoundary } from "./components/ErrorBoundary.tsx"
import App from "./App"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
