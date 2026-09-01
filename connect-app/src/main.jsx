// connect-app/src/main.jsx

import React from "react";
import { createRoot } from "react-dom/client";
import { WagmiProvider } from "wagmi";
import {
  QueryClient,
  QueryClientProvider
} from "@tanstack/react-query";

import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { wagmiAdapter } from "./appkit.js";
import "./styles/connect.css";

const queryClient =
  new QueryClient();

createRoot(
  document.getElementById("root")
).render(
  <ErrorBoundary>
    <React.StrictMode>
      <WagmiProvider
        config={
          wagmiAdapter.wagmiConfig
        }
      >
        <QueryClientProvider
          client={
            queryClient
          }
        >
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    </React.StrictMode>
  </ErrorBoundary>
);
