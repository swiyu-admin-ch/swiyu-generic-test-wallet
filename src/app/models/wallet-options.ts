export interface WalletOptions {
  payloadEncryptionPreference: boolean;
  numberOfProofs: false | number;
  useSignedMetadata: boolean;
  useProtectedIssuance: boolean;
  useDPoP: boolean;
}
