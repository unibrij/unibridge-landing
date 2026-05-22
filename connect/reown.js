// unibridge-landing/connect/reown.js

import { createAppKit } from 'https://esm.sh/@reown/appkit'
import { EthersAdapter } from 'https://esm.sh/@reown/appkit-adapter-ethers'

import {
  mainnet,
  polygon,
  base,
  arbitrum
} from 'https://esm.sh/@reown/appkit/networks'

export const projectId =
  'c15ae70122dad197db547f7bc77cea37'

export const metadata = {
  name: 'UniBridge',
  description: 'UniBridge Connect',
  url: window.location.origin,
  icons: [
    'https://unibrij.io/connect/assets/unibridge-logo.png'
  ]
}

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [
    mainnet,
    polygon,
    base,
    arbitrum
  ],
  metadata,
  projectId,
  features: {
    analytics: false
  }
})
