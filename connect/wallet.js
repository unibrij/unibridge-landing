// connect/wallet.js

import {
  BrowserProvider
} from "https://esm.sh/ethers@6.11.0";

export function cleanString(
  value
) {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  return (
    value.trim() ||
    null
  );
}

export function cleanAddress(
  value
) {
  return (
    cleanString(
      value
    )?.toLowerCase() ||
    null
  );
}

export function cleanChainId(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const raw =
    String(
      value
    ).trim();

  if (!raw) {
    return null;
  }

  const candidate =
    raw.includes(":")
      ? raw
          .split(":")
          .pop()
      : raw;

  const chainId =
    Number(
      candidate
    );

  return Number.isInteger(
    chainId
  )
    ? chainId
    : null;
}

function addressFromCaip(
  value
) {
  const caipAddress =
    cleanString(
      value
    );

  if (!caipAddress) {
    return null;
  }

  return cleanAddress(
    caipAddress
      .split(":")
      .pop()
  );
}

function getWalletAddress(
  account
) {
  return (
    cleanAddress(
      account?.address
    ) ||
    addressFromCaip(
      account?.caipAddress
    ) ||
    cleanAddress(
      account
        ?.allAccounts
        ?.[0]
        ?.address
    ) ||
    addressFromCaip(
      account
        ?.allAccounts
        ?.[0]
        ?.caipAddress
    ) ||
    null
  );
}

function getChainId(
  network,
  account
) {
  return (
    cleanChainId(
      network?.chainId
    ) ||
    cleanChainId(
      network
        ?.caipNetwork
        ?.chainId
    ) ||
    cleanChainId(
      network
        ?.caipNetwork
        ?.id
    ) ||
    cleanChainId(
      network
        ?.caipNetworkId
    ) ||
    cleanChainId(
      account?.chainId
    ) ||
    cleanChainId(
      account
        ?.allAccounts
        ?.[0]
        ?.chainId
    ) ||
    null
  );
}

function mapAccount(
  account
) {
  if (
    !account ||
    typeof account !==
      "object"
  ) {
    return null;
  }

  const address =
    cleanAddress(
      account.address
    ) ||
    addressFromCaip(
      account.caipAddress
    );

  if (!address) {
    return null;
  }

  return {
    namespace:
      cleanString(
        account.namespace
      ),

    address,

    chain_id:
      cleanChainId(
        account.chainId
      ),

    caip_address:
      cleanString(
        account.caipAddress
      ),

    type:
      cleanString(
        account.type
      ),

    public_key:
      cleanString(
        account.publicKey
      )
  };
}

function mapEmbeddedWallet(
  account
) {
  const info =
    account?.embeddedWalletInfo;

  if (
    !info ||
    typeof info !==
      "object"
  ) {
    return null;
  }

  return {
    email:
      cleanString(
        info.user?.email
      ),

    username:
      cleanString(
        info.user?.username
      ),

    account_type:
      cleanString(
        info.accountType
      ),

    auth_provider:
      cleanString(
        info.authProvider
      ),

    is_smart_account_deployed:
      info
        .isSmartAccountDeployed ===
      true
  };
}

export function readAppKitState() {
  const appkit =
    window.appKit;

  if (!appkit) {
    return {
      appkit:
        null,

      account:
        null,

      network:
        null
    };
  }

  const account =
    typeof appkit.getAccount ===
      "function"
      ? appkit.getAccount()
      : typeof appkit.getAddress ===
          "function"
        ? {
            address:
              appkit.getAddress()
          }
        : null;

  const network =
    typeof appkit.getNetwork ===
      "function"
      ? appkit.getNetwork()
      : null;

  return {
    appkit,
    account,
    network
  };
}

export function buildConnectPayload(
  account,
  network
) {
  const accounts =
    Array.isArray(
      account?.allAccounts
    )
      ? account.allAccounts
          .map(
            mapAccount
          )
          .filter(
            Boolean
          )
      : [];

  return {
    source:
      "reown",

    wallet_address:
      getWalletAddress(
        account
      ),

    chain_id:
      getChainId(
        network,
        account
      ),

    caip_address:
      cleanString(
        account?.caipAddress
      ),

    embedded_wallet:
      mapEmbeddedWallet(
        account
      ),

    accounts
  };
}

export function createFingerprint(
  payload
) {
  const accounts =
    [
      ...payload.accounts
    ].sort(
      (
        left,
        right
      ) => {
        const leftKey =
          `${left.namespace || ""}:${left.address}:${left.chain_id ?? ""}`;

        const rightKey =
          `${right.namespace || ""}:${right.address}:${right.chain_id ?? ""}`;

        return leftKey.localeCompare(
          rightKey
        );
      }
    );

  return JSON.stringify({
    wallet_address:
      payload.wallet_address,

    chain_id:
      payload.chain_id,

    caip_address:
      payload.caip_address,

    embedded_wallet:
      payload.embedded_wallet,

    accounts
  });
}

function getWalletProvider(
  appkit
) {
  const walletProvider =
    typeof appkit
      ?.getWalletProvider ===
      "function"
      ? appkit
          .getWalletProvider()
      : null;

  if (
    !walletProvider ||
    typeof walletProvider.request !==
      "function"
  ) {
    throw new Error(
      "wallet_provider_unavailable"
    );
  }

  return walletProvider;
}

export async function signSiwxMessage({
  appkit,
  address,
  message
}) {
  const provider =
    new BrowserProvider(
      getWalletProvider(
        appkit
      )
    );

  const signer =
    await provider.getSigner(
      address
    );

  const signerAddress =
    cleanAddress(
      await signer.getAddress()
    );

  const expectedAddress =
    cleanAddress(
      address
    );

  if (
    !signerAddress ||
    signerAddress !==
      expectedAddress
  ) {
    throw new Error(
      "wallet_signer_mismatch"
    );
  }

  const signature =
    cleanString(
      await signer.signMessage(
        message
      )
    );

  if (
    !signature ||
    !/^0x[a-fA-F0-9]+$/.test(
      signature
    )
  ) {
    throw new Error(
      "invalid_wallet_signature"
    );
  }

  return signature;
}

export function isUserRejectedError(
  error
) {
  const codes = [
    error?.code,
    error?.error?.code,
    error?.info?.error?.code,
    error?.cause?.code
  ];

  const rejectedByCode =
    codes.some(
      code =>
        code ===
          "ACTION_REJECTED" ||
        Number(
          code
        ) === 4001
    );

  const message =
    [
      error?.shortMessage,
      error?.message,
      error?.error?.message,
      error?.info?.error?.message,
      error?.cause?.message
    ]
      .filter(
        value =>
          typeof value ===
          "string"
      )
      .join(
        " "
      )
      .toLowerCase();

  return (
    rejectedByCode ||
    message.includes(
      "user rejected"
    ) ||
    message.includes(
      "user denied"
    ) ||
    message.includes(
      "request rejected"
    ) ||
    message.includes(
      "action_rejected"
    )
  );
}
