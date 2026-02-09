import { Injectable } from '@angular/core';
import * as jose from "jose";
import { DcqlCredentialDto, DcqlQueryDto, Field, InputDescriptor, PresentationDefinition } from 'src/generated/verifier';

@Injectable({
    providedIn: 'root'
})
export class VerificationService {

    public decodeDeeplink(url: string): Record<string, string> | null {
        if (!url) {
            return null;
        }

        if (url.startsWith('swiyu-verify://')) {
            const withoutProtocol = url.replace('swiyu-verify://?', '');
            const decodedUri = decodeURIComponent(withoutProtocol);

            const params = new URLSearchParams(decodedUri);
            const result: Record<string, string> = {};

            params.forEach((value, key) => {
                result[key] = value;
            });

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
            .setProtectedHeader({ alg: proofSigningAlgValuesSupported, typ: 'openid4vci-proof+jwt', jwk: jwk })
            .setIssuedAt(Math.floor(Date.now() / 1000))
            .setAudience(credentialIssuer)
            .setExpirationTime('2h')
            .sign(privateKey);

        return jwt;
    }

    public async decodeResponse(jwt: string, registryEntry: any[]): Promise<any> {

        const kid = jose.decodeProtectedHeader(jwt).kid;
        const verificationMethod = registryEntry[3]?.value?.verificationMethod.map(meth => meth.id === kid ? meth : null).filter(meth => meth != null)[0];
        const jwk = verificationMethod?.publicKeyJwk;
        const { payload, protectedHeader } = await jose.jwtVerify(jwt, jwk, {
        })

        return { payload, protectedHeader };
    }

    public async createKeySet(): Promise<{ publicKey: CryptoKey, privateKey: CryptoKey, jwk: jose.JWK }> {
        const { publicKey, privateKey } = await crypto.subtle.generateKey(
            {
                name: "ECDSA",
                namedCurve: "P-256",
            },
            true,
            ["sign", "verify"]);

        const jwk = await jose.exportJWK(publicKey);

        return { publicKey: publicKey, privateKey: privateKey, jwk: jwk }
    }


    public extractRequiredClaimsFromPresentationDefinition(presentationDefinition: PresentationDefinition): any[] {
        if (!presentationDefinition?.input_descriptors) {
            return [];
        }

        const requiredClaims: any[] = [];

        presentationDefinition.input_descriptors.forEach((descriptor: InputDescriptor) => {
            if (descriptor.constraints?.fields) {
                descriptor.constraints.fields.forEach((field: Field) => {
                    requiredClaims.push({
                        path: field.path,
                        filter: field.filter,
                        required: false,
                        //required: field.optional !== true @TODO
                    });
                });
            }
        });

        return requiredClaims;
    }

    public extractCredentialsFromDCQL(dcqlQuery: DcqlQueryDto): DcqlCredentialDto[] {
        if (!dcqlQuery?.credentials) {
            return [];
        }

        const credentials: DcqlCredentialDto[] = [];

        dcqlQuery.credentials.forEach((credential: DcqlCredentialDto) => {
            credentials.push({
                id: credential.id,
                format: credential.format,
                meta: credential.meta || {}
            });
        });

        return credentials;
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

        return vpToken;
    }
}
