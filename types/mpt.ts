export type RawTransaction = {
  TransactionType: string;
  Account?: string;
  Fee?: string;
  Sequence?: number;
  LastLedgerSequence?: number;
  SigningPubKey?: string;
  TxnSignature?: string;
  Signers?: unknown;
  [key: string]: any;
};

export type MPTokenIssuanceCreate = RawTransaction & {
  TransactionType: "MPTokenIssuanceCreate";
  AssetScale?: number;
  TransferFee?: number;
  MaximumAmount?: string;
  Flags: number;
  MPTokenMetadata: string;
};

export type MPTokenAuthorize = RawTransaction & {
  TransactionType: "MPTokenAuthorize";
  MPTokenIssuanceID: string;
  Holder?: string;
  Flags?: number;
};

export type MPTokenIssuanceDestroy = RawTransaction & {
  TransactionType: "MPTokenIssuanceDestroy";
  MPTokenIssuanceID: string;
};

export type MPTokenIssuanceSet = RawTransaction & {
  TransactionType: "MPTokenIssuanceSet";
  MPTokenIssuanceID: string;
  Holder?: string;
  Flags: number;
};

export const MPTokenIssuanceCreateFlags = {
  tfMPTCanLock: 0x00000002,
  tfMPTRequireAuth: 0x00000004,
  tfMPTCanEscrow: 0x00000008,
  tfMPTCanTrade: 0x00000010,
  tfMPTCanTransfer: 0x00000020,
  tfMPTCanClawback: 0x00000040,
};

export const MPTokenAuthorizeFlags = {
  tfMPTUnauthorize: 0x00000001,
};

export const MPTokenIssuanceSetFlags = {
  tfMPTLock: 0x00000001,
  tfMPTUnlock: 0x00000002,
};
