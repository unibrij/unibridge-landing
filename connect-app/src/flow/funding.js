// connect-app/src/flow/funding.js

export const REQUIRED_CHAIN_ID = 137;

export const POLYGON_TOKENS = {
  USDT: {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6
  },
  USDC: {
    address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
    decimals: 6
  },
  "USDC.e": {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    decimals: 6
  }
};

export const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
];

export function pickFundingAsset(funding = {}) {
  return String(
    funding.asset ||
      funding.currency ||
      funding.token ||
      ""
  ).trim();
}

export function pickFundingAmount(funding = {}) {
  return (
    funding.amount ??
    funding.expected_amount ??
    funding.required_amount ??
    ""
  );
}

export function pickFundingDepositAddress(funding = {}) {
  return String(
    funding.deposit_address ||
      funding.address ||
      funding.to_address ||
      funding.target_address ||
      ""
  ).trim();
}
