import {Injectable} from '@angular/core';
import * as jose from "jose";

@Injectable({
    providedIn: 'root'
})
export class CredentialService {

    constructor() {
    }

    public decodeDeeplink(url: string): string {
        if (!url) {
            return 'No url provided';
        }
        if (url.startsWith('swiyu://')) {
            const decodedUri = decodeURIComponent(url);
            const json = this.getCredentialOfferString(decodedUri);
            try {
                return JSON.parse(json);
            } catch (e) {
                return json;
            }
        }
    }

    public async createHolderBinding(
        credentialIssuer: string,
        nonce: string,
        proofSigningAlgValuesSupported: string,
        privateKey: CryptoKey,
        jwk: jose.JWK
    ): Promise<string> {
        const claims = {
            "aud": credentialIssuer,
            "iat": Math.floor(Date.now() / 1000),
            nonce
        }

        const jwt = await new jose.SignJWT(claims)
            .setProtectedHeader({alg: proofSigningAlgValuesSupported, typ: 'openid4vci-proof+jwt', jwk: jwk})
            .setIssuedAt(Math.floor(Date.now() / 1000))
            .setAudience(credentialIssuer)
            .setExpirationTime('2h')
            .sign(privateKey);

        console.log(jwt);
        return jwt;
    }

    public async decodeResponse(jwt: string, registryEntry: any[], issuer: string): Promise<any> {

        const kid = jose.decodeProtectedHeader(jwt).kid;
        const verificationMethod = registryEntry[3]?.value?.verificationMethod.map(meth => meth.id === kid ? meth : null).filter(meth => meth != null)[0];
        const jwk = verificationMethod?.publicKeyJwk;
        const {payload, protectedHeader} = await jose.jwtVerify(jwt, jwk, {
            // issuer: issuer
        })

        return {payload, protectedHeader};
    }

    public async createKeySet(): Promise<{ publicKey: CryptoKey, privateKey: CryptoKey, jwk: jose.JWK }> {
        const {publicKey, privateKey} = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256",
            },
            true,
            ["sign", "verify"]);

        const jwk = await jose.exportJWK(publicKey);

        return {publicKey: publicKey, privateKey: privateKey, jwk: jwk}
    }

    private getCredentialOfferString(deeplink: string): string {
        return deeplink.split('credential_offer=')[1];
    }
}
