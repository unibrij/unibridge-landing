// connect-app/src/appkit.js

import { createAppKit } from "@reown/appkit/react";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { mainnet, polygon, base, arbitrum } from "@reown/appkit/networks";

export const projectId = "c15ae70122dad197db547f7bc77cea37";

export const networks = [mainnet, polygon, base, arbitrum];

export const metadata = {
  name: "UniBridge",
  description: "UniBridge Connect",
  url: "https://unibrij.io",
  icons: ["https://unibrij.io/public/icons/social/Ub.png"]
};

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
  ssr: false
});

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata,
  features: {
    analytics: false,
    onramp: false,
    swaps: true
  }
});
