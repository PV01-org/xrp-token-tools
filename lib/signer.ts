import {
  FireblocksSDK,
  PeerType,
  TransactionOperation,
  TransactionResponse,
  TransactionStatus,
} from "fireblocks-sdk";
import { Client as RippleClient, Transaction, hashes } from "xrpl";
import binaryCodec from "ripple-binary-codec";
import isEqual from "lodash.isequal";
import { sentenceCase } from "sentence-case";

export class XrpSigner {
  private static TERMINAL_STATUSES = [
    TransactionStatus.COMPLETED,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELLED,
  ];

  private static rmPadding(buf: number[]) {
    let i = 0;
    let len = buf.length - 1;

    while (!buf[i] && !(buf[i + 1] & 0x80) && i < len) {
      i++;
    }

    if (i === 0) {
      return buf;
    }

    return buf.slice(i);
  }

  private static constructLength(arr: number[], len: number) {
    if (len < 0x80) {
      arr.push(len);
      return arr;
    }

    let octets = 1 + ((Math.log(len) / Math.LN2) >>> 3);

    arr.push(octets | 0x80);

    while (--octets) {
      arr.push((len >>> (octets << 3)) & 0xff);
    }

    arr.push(len);

    return arr;
  }

  private static toDER(rHex?: string, sHex?: string) {
    let r = [...Buffer.from(rHex ?? "", "hex")];
    let s = [...Buffer.from(sHex ?? "", "hex")];

    // Pad values
    if (r[0] & 0x80) {
      r = [0].concat(r);
    }
    // Pad values
    if (s[0] & 0x80) {
      s = [0].concat(s);
    }

    r = XrpSigner.rmPadding(r);
    s = XrpSigner.rmPadding(s);

    while (!s[0] && !(s[1] & 0x80)) {
      s = s.slice(1);
    }

    let derBytes = XrpSigner.constructLength([0x02], r.length);
    derBytes = derBytes.concat(r);
    derBytes.push(0x02);
    derBytes = XrpSigner.constructLength(derBytes, s.length);
    const backHalf = derBytes.concat(s);
    derBytes = XrpSigner.constructLength([0x30], backHalf.length);
    derBytes = derBytes.concat(backHalf);

    const derHex = Buffer.from(derBytes).toString("hex").toUpperCase();

    return derHex;
  }

  private static checkTxSerialization(serialized: string, tx: Transaction) {
    // Decode the serialized transaction:
    const decoded = binaryCodec.decode(serialized);

    // ...And ensure it is equal to the original tx, except:
    // - It must have a TxnSignature or Signers (multisign).
    if (!decoded.TxnSignature && !decoded.Signers) {
      throw new Error(
        "Serialized transaction must have a TxnSignature or Signers property"
      );
    }

    // - If SigningPubKey was not in the original tx, then we should delete it.
    //   But if it was in the original tx, then we should ensure that it has not been changed.
    if (!tx.SigningPubKey) {
      delete decoded.SigningPubKey;
    }

    if (!isEqual(decoded, tx)) {
      throw new Error(
        "Serialized transaction does not match original txJSON. See `error.data`"
      );
    }
  }

  constructor(
    private readonly ripple: RippleClient,
    private readonly fireblocks: FireblocksSDK,
    private readonly assetId: string,
    private readonly vaultAccountId: number
  ) {}

  private async waitForTxSignature(txId: string, initialStatus: string) {
    let txInfo: TransactionResponse | null = null;
    let currentStatus = initialStatus as TransactionStatus;

    while (!XrpSigner.TERMINAL_STATUSES.includes(currentStatus)) {
      try {
        console.info(
          `Raw signing tx ${txId} status: ${sentenceCase(currentStatus)}`
        );

        txInfo = await this.fireblocks.getTransactionById(txId);
        currentStatus = txInfo.status;
      } catch (err) {
        console.error(err);
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    const sig = txInfo?.signedMessages?.[0]?.signature;

    if (!sig || currentStatus === TransactionStatus.FAILED) {
      throw new Error(
        `Transaction signing failed${
          txInfo?.subStatus
            ? `. Sub-status: ${sentenceCase(txInfo.subStatus)}`
            : ""
        }`
      );
    }

    return sig;
  }

  private async signTx(tx: Transaction, note?: string) {
    if (tx.TxnSignature || tx.Signers) {
      throw new Error(
        'txJSON must not contain "TxnSignature" or "Signers" properties'
      );
    }

    const { publicKey } = await this.fireblocks.getPublicKeyInfoForVaultAccount(
      {
        vaultAccountId: this.vaultAccountId,
        assetId: this.assetId,
        change: 0,
        addressIndex: 0,
        compressed: true,
      }
    );

    tx.SigningPubKey = publicKey.toUpperCase();

    const binaryContent = binaryCodec.encode(tx);
    const content = hashes.hashTx(binaryContent);

    const { id, status } = await this.fireblocks.createTransaction({
      operation: TransactionOperation.RAW,
      assetId: this.assetId,
      source: {
        type: PeerType.VAULT_ACCOUNT,
        id: this.vaultAccountId.toString(),
      },
      note,
      extraParameters: { rawMessageData: { messages: [{ content }] } },
    });

    const sig = await this.waitForTxSignature(id, status);

    const derSig = XrpSigner.toDER(sig?.r, sig?.s);

    tx.TxnSignature = derSig;

    const serialized = binaryCodec.encode(tx);

    XrpSigner.checkTxSerialization(serialized, tx);

    const ledgerHash = hashes.hashSignedTx(serialized);

    return {
      tx: serialized,
      hash: ledgerHash,
    };
  }

  public async submitTransaction(tx: Transaction, note?: string) {
    if (typeof note === "string") {
      console.info(note);
    }

    console.info("Submitting Transaction using signer.submitTransaction()");
    console.info("Transaction type:", tx.TransactionType);
    console.info("Transaction:", JSON.stringify(tx));

    const _tx = await this.ripple.prepareTransaction(tx);

    if (typeof _tx.LastLedgerSequence === "undefined") {
      throw new Error("Transaction LastLedgerSequence not set");
    }

    _tx.LastLedgerSequence += 20;

    const { tx: signedTx, hash } = await this.signTx(_tx, note);

    const result = await this.ripple.submit(signedTx);

    console.info("Explorer:", `https://livenet.xrpl.org/transactions/${hash}`);
    console.info("Result:", result.result);

    await new Promise((r) => setTimeout(r, 3000));

    return result;
  }
}
