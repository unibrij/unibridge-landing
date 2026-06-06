import React from "react";
import { createRoot } from "react-dom/client";
import {
  ClerkProvider
} from "@clerk/clerk-react";

import "./style.css";
import { FiatAuthIsland } from "./FiatAuthIsland.jsx";

const CLERK_PUBLISHABLE_KEY =
  "pk_test_bW92aW5nLWtpZC04Ny5jbGVyay5hY2NvdW50cy5kZXYk";

const root =
  document.getElementById("fiatReactRoot");

if (!root) {
  throw new Error("fiat_react_root_missing");
}

createRoot(root).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <FiatAuthIsland />
    </ClerkProvider>
  </React.StrictMode>
);
