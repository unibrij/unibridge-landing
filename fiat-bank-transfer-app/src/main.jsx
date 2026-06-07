import React from "react";
import { createRoot } from "react-dom/client";
import {
  ClerkProvider
} from "@clerk/clerk-react";

import "./style.css";
import { FiatAuthIsland } from "./FiatAuthIsland.jsx";

const CLERK_PUBLISHABLE_KEY =
  "pk_live_Y2xlcmsudW5pYnJpai5pbyQ";

const root =
  document.getElementById("fiatReactRoot");

if (!root) {
  throw new Error("fiat_react_root_missing");
}

createRoot(root).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      appearance={{
        variables: {
          colorPrimary:
            "#14b8a6",

          colorBackground:
            "transparent",

          colorInputBackground:
            "rgba(255, 255, 255, 0.055)",

          colorInputText:
            "#ffffff",

          colorText:
            "#ffffff",

          colorTextSecondary:
            "rgba(255, 255, 255, 0.72)",

          borderRadius:
            "14px"
        }
      }}
    >
      <FiatAuthIsland />
    </ClerkProvider>
  </React.StrictMode>
);
