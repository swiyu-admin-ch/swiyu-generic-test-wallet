import { Routes } from '@angular/router';
import { CredentialIssuance } from "@pages/credential-issuance/credential-issuance";
import { CredentialVerificationV1 } from "@pages/credential-verification-v1/credential-verification-v1";
import { CredentialVerificationV2 } from '@pages/credential-verification-v2/credential-verification-v2';

export const routes: Routes = [
    {
        title: 'Issuance',
        path: 'issuance',
        component: CredentialIssuance,
        data: { cssClass: 'tab-issuance' }
    },
    {
        title: 'Verification V1 (DIF)',
        path: 'verifications/v1',
        component: CredentialVerificationV1,
        data: { cssClass: 'tab-verification' }
    },
    {
        title: 'Verification V2 (DCQL)',
        path: 'verifications/v2',
        component: CredentialVerificationV2,
        data: { cssClass: 'tab-verification' }
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
