import {Routes} from '@angular/router';
import {CredentialIssuanceV1} from "./app/credential-issuance-v1/credential-issuance-v1";
import {CredentialIssuanceV2} from "./app/credential-issuance-v2/credential-issuance-v2";
import {CredentialVerificationV1} from "./app/credential-verification-v1/credential-verification-v1";

export const routes: Routes = [
    {
        title: 'Credential Issuance V1',
        path: '',
        component: CredentialIssuanceV1,
    },
    {
        title: 'Credential Issuance V2',
        path: 'v2',
        component: CredentialIssuanceV2,
    },
    {
        title: 'Credential Verification V1',
        path: 'verifications/v1',
        component: CredentialVerificationV1,
    }
];
