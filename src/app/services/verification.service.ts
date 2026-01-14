import {Injectable} from '@angular/core';
import * as jose from "jose";

@Injectable({
    providedIn: 'root'
})
export class VerificationService {

    constructor() {
    }

    public decodeDeeplink(url: string): any {
        if (!url) {
            return 'No url provided';
        }
        if (url.startsWith('swiyu-verify://')) {
            const withoutProtocol = url.replace('swiyu-verify://?', '');
            const decodedUri = decodeURIComponent(withoutProtocol);

            const params = new URLSearchParams(decodedUri);
            const result: any = {};

            params.forEach((value, key) => {
                result[key] = value;
            });

            console.log("Decoded deeplink:", result);
            return result;
        }
        return null;
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


    public extractRequiredClaimsFromPresentationDefinition(presentationDefinition: any): any[] {
        if (!presentationDefinition?.input_descriptors) {
            return [];
        }

        const requiredClaims: any[] = [];

        presentationDefinition.input_descriptors.forEach((descriptor: any) => {
            if (descriptor.constraints?.fields) {
                descriptor.constraints.fields.forEach((field: any) => {
                    requiredClaims.push({
                        path: field.path,
                        filter: field.filter,
                        required: field.optional !== true
                    });
                });
            }
        });

        return requiredClaims;
    }

    public async createVerifiablePresentation(
        credential: string,
        verifierId: string,
        nonce: string,
        privateKey: CryptoKey,
        jwk: jose.JWK
    ): Promise<string> {
        const claims = {
            "iss": "did:example:holder", 
            "aud": verifierId,
            "nonce": nonce,
            "iat": Math.floor(Date.now() / 1000),
            "vp": {
                "type": ["VerifiablePresentation"],
                "verifiableCredential": [credential]
            }
        };

        const vpToken = await new jose.SignJWT(claims)
            .setProtectedHeader({ alg: "ES256", typ: "kb+jwt", jwk: jwk })
            .setIssuedAt(Math.floor(Date.now() / 1000))
            .setAudience(verifierId)
            .setExpirationTime('2h')
            .sign(privateKey);

        console.log("VP Token created:", vpToken);
        return vpToken;
    }
}
