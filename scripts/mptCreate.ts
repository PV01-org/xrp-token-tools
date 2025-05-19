import { setup } from "../lib/setup";
import { MPTokenIssuanceCreate } from "../types/mpt";

async function main() {
  const { ripple, signer, address } = await setup();

  const tx: MPTokenIssuanceCreate = {
    TransactionType: "MPTokenIssuanceCreate",
    Account: address,
    AssetScale: 2,
    TransferFee: 314, // 3.14%
    MaximumAmount: "50000000", // total cap = 500,000.00 (with AssetScale 2)
    Flags:
      2 + // tfMPTCanLock
      4 + // tfMPTRequireAuth
      8 + // tfMPTCanEscrow
      16 + // tfMPTCanTrade
      32 + // tfMPTCanTransfer
      64, // tfMPTCanClawback
    MPTokenMetadata: Buffer.from("FOO").toString("hex").toUpperCase(), // FOO → 464F4F
    Fee: "10",
  };

  await signer.submitTransaction(tx, "Creating MPT token issuance");

  await ripple.disconnect();
}

void main();
