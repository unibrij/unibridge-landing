// unibridge-landing/connect/reown.js

import {
  Buffer
} from 'https://esm.sh/buffer'

globalThis.Buffer =
  globalThis.Buffer || Buffer

const [
  appKitModule,
  ethersAdapterModule,
  networksModule,
  siwxModule
] = await Promise.all([
  import('https://esm.sh/@reown/appkit'),
  import('https://esm.sh/@reown/appkit-adapter-ethers'),
  import('https://esm.sh/@reown/appkit/networks'),
  import('https://esm.sh/@reown/appkit-siwx')
])

const {
  createAppKit
} = appKitModule

const {
  EthersAdapter
} = ethersAdapterModule

const {
  mainnet,
  polygon,
  base,
  arbitrum
} = networksModule

const {
  ReownAuthentication
} = siwxModule

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

export const appKit = createAppKit({
  adapters: [
    new EthersAdapter()
  ],

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
  },

  siwx: new ReownAuthentication({
    required: true
  })
})

window.appKit = appKit
