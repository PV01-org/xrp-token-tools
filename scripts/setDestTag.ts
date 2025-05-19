import { AccountSet, convertStringToHex } from "xrpl";
import { setup } from "../lib/setup";

// Enter the domain name that owns this account
const DOMAIN = "app.uat.pv0.one";

async function main() {
  const { ripple, signer, address } = await setup();

  const tx: AccountSet = {
    TransactionType: "AccountSet",
    Account: address,
    Fee: "1000",
    SetFlag: 1, // --> Enable dest tag required
    // "ClearFlag": 1 // --> Disable test tag required
  };

  let note = "Setting destination tag required flag";

  if (DOMAIN) {
    tx.Domain = convertStringToHex(DOMAIN.toLowerCase()).toUpperCase();

    console.info("Text domain:", DOMAIN);
    console.info("Hex domain:", tx.Domain);

    note = `Setting destination tag required flag and domain ${DOMAIN}`;
  }

  await signer.submitTransaction(tx, note);

  await ripple.disconnect();
}

void main();
