import { Routes } from '@angular/router';
import { CredentialIssuanceV1 } from "./app/credential-issuance-v1/credential-issuance-v1";
import { CredentialIssuanceV2 } from "./app/credential-issuance-v2/credential-issuance-v2";
import { CredentialVerificationV1 } from "./app/credential-verification-v1/credential-verification-v1";
import { CredentialVerificationV2 } from '@app/credential-verification-v2/credential-verification-v2';

export const routes: Routes = [
    {
        title: 'Issuance V1',
        path: 'issuances/v1',
        component: CredentialIssuanceV1,
    },
    {
        title: 'Issuance V2 (Batch)',
        path: 'issuances/v2',
        component: CredentialIssuanceV2,
    },
    {
        title: 'Verification V1 (DIF)',
        path: 'verifications/v1',
        component: CredentialVerificationV1,
    },
    {
        title: 'Verification V2 (DCQL)',
        path: 'verifications/v2',
        component: CredentialVerificationV2,
    },
    {
        path: '',
        redirectTo: 'issuances/v1',
        pathMatch: 'full',
    },
    {
        path: '**',
        redirectTo: 'issuances/v1',
    }
];
