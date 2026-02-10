import { Injectable } from '@angular/core';
import * as jose from "jose";
import { DcqlCredentialDto, DcqlQueryDto, Field, InputDescriptor, PresentationDefinition } from 'src/generated/verifier';
import { JwtPayload, RegistryEntry } from "@app/models/api-response";

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
        const claims: Record<string, unknown> = {
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

    public async decodeResponse(jwt: string, registryEntry: RegistryEntry[]): Promise<{ payload: JwtPayload, protectedHeader: JwtPayload }> {

        const kid = (jose.decodeProtectedHeader(jwt) as JwtPayload).kid;
        const verificationMethods = (registryEntry[3] as Record<string, unknown>)?.value as Record<string, unknown>;
        const verificationMethod = ((verificationMethods?.verificationMethod as Record<string, unknown>[]) || [])
            .map(meth => (meth as Record<string, unknown>).id === kid ? meth : null)
            .filter((meth: Record<string, unknown> | null): meth is Record<string, unknown> => meth != null)[0];
        const jwk = verificationMethod?.publicKeyJwk as CryptoKey;
        const { payload, protectedHeader } = await jose.jwtVerify(jwt, jwk, {})

        return { payload: payload as JwtPayload, protectedHeader: protectedHeader as JwtPayload };
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


    public extractFieldsFromPresentationDefinition(
        presentationDefinition: PresentationDefinition | undefined
    ): Field[] {

        if (!presentationDefinition?.input_descriptors) {
            return [];
        }

        const extractedFields: Field[] = [];
        const seenPaths = new Set<string>();

        presentationDefinition.input_descriptors.forEach((descriptor: InputDescriptor) => {
            const fields = descriptor.constraints?.fields ?? [];

            fields.forEach((field: Field) => {
                if (!Array.isArray(field.path)) {
                    return;
                }

                const pathKey = field.path.join('|');

                if (!seenPaths.has(pathKey)) {
                    seenPaths.add(pathKey);
                    extractedFields.push(field);
                }
            });
        });

        return extractedFields;
    }



    public extractCredentialsFromDCQL(dcqlQuery: DcqlQueryDto): DcqlCredentialDto[] {
        if (!dcqlQuery?.credentials) {
            return [];
        }

        return dcqlQuery.credentials;
    }

    public async createVerifiablePresentation(
        credential: string,
        verifierId: string,
        nonce: string,
        privateKey: CryptoKey,
        jwk: jose.JWK
    ): Promise<string> {
        const claims: Record<string, unknown> = {
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
