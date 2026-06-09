import { Injectable } from "@angular/core";
import {
  compactDecrypt,
  CompactEncrypt,
  CompactJWEHeaderParameters,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
} from "jose";

@Injectable({
  providedIn: "root",
})
export class CryptoService {
  async generateEphemeralKeyPair(alg: string) {
    return await generateKeyPair(alg, { crv: "P-256" });
  }

  async exportPublicJwk(publicKey: CryptoKey) {
    const jwk = await exportJWK(publicKey);

    return {
      ...jwk,
      use: "enc",
      alg: "ECDH-ES",
      crv: "P-256",
    };
  }

  decodeJwtPayload<T = any>(token: string): T {
    const parts = token.split(".");

    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    try {
      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded) as T;
    } catch (error) {
      console.error("Failed to decode JWT payload:", error);
      throw new Error(`Failed to decode JWT payload: ${error}`);
    }
  }

  decodeIfJwt<T>(input: string | T): T {
    if (typeof input === "string") {
      return this.decodeJwtPayload<T>(input);
    }

    return input;
  }

  isJwt(input: unknown): boolean {
    return typeof input === "string" && input.split(".").length === 3;
  }

  async encryptPayload(
    payload: unknown,
    jwk: any,
    alg: string,
    enc: string,
    zip: string,
  ): Promise<string> {
    const publicKey = await importJWK(jwk, alg);
    const encoded = new TextEncoder().encode(JSON.stringify(payload));

    const protectedHeader: CompactJWEHeaderParameters = {
      typ: "JWT",
      kid: jwk.kid,
      alg,
      enc,
      zip,
    };

    const encryptedJwe = await new CompactEncrypt(encoded)
      .setProtectedHeader(protectedHeader)
      .encrypt(publicKey);

    return encryptedJwe;
  }

  async decryptPayload(
    input: unknown | string,
    privateKey: CryptoKey,
  ): Promise<unknown> {
    try {
      if (typeof input !== "string") {
        return input;
      }
      const { plaintext } = await compactDecrypt(input, privateKey, {
        maxDecompressedLength: 10 * 1024 * 1024,
      });
      const decoded = new TextDecoder().decode(plaintext);
      return JSON.parse(decoded);
    } catch (error) {
      throw new Error(`Failed to decrypt payload: ${error}`);
    }
  }

  async checkJwtIsValid(token: string, publicKey: CryptoKey): Promise<boolean> {
    try {
      await jwtVerify(token, publicKey);
      return true;
    } catch (error) {
      console.warn("JWT verification failed:", error);
      return false;
    }
  }

  async getCryptoKeyFromJwk(jwk: any): Promise<CryptoKey | Uint8Array> {
    return await importJWK(jwk, "ES256");
  }
}
