import { Routes } from '@angular/router';
import { CredentialIssuance } from "@pages/credential-issuance/credential-issuance";
import { CredentialVerification } from '@pages/credential-verification/credential-verification';

export const routes: Routes = [
    {
        title: 'Issuance',
        path: 'issuance',
        component: CredentialIssuance,
        data: { cssClass: 'tab-issuance' }
    },
    {
        title: 'Verification',
        path: 'verification',
        component: CredentialVerification,
        data: { cssClass: 'tab-verification' }
    },
    {
        path: '',
        redirectTo: 'issuance',
        pathMatch: 'full',
    },
    {
        path: '**',
        redirectTo: 'issuance',
    }
];
