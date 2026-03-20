/**
 * VcStoreService - Usage Guide
 * 
 * This service manages requested credentials (VCs) that are collected
 * throughout the application lifecycle. It allows tracking of all VCs
 * requested from issuers.
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Inject the service in your component:
 * 
 *    import { VcStoreService } from '@services/vc-store.service';
 *    
 *    export class MyComponent {
 *      private vcStoreService = inject(VcStoreService);
 *    }
 * 
 * 2. Add a requested credential:
 * 
 *    this.vcStoreService.addVC('University Degree', 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...');
 * 
 * 3. Get all requested VCs:
 * 
 *    const requestedVCs = this.vcStoreService.getRequestedVCs();
 *    
 *    In your template:
 *    @for (vc of requestedVCs(); track vc.id) {
 *      <p>{{ vc.credentialType }} - {{ vc.issuedAt | date }}</p>
 *    }
 * 
 * 4. Count the number of VCs:
 * 
 *    const count = this.vcStoreService.getVCCount();
 * 
 * 5. Remove a specific VC:
 * 
 *    this.vcStoreService.removeVC(vcId);
 * 
 * 6. Clear all VCs:
 * 
 *    this.vcStoreService.clearAll();
 * 
 * VC RECORD STRUCTURE:
 * 
 * interface VCRecord {
 *   id: string;                      // Unique identifier for the VC
 *   credentialType: string;           // Type/name of the credential
 *   issuedAt: Date;                   // Timestamp when the VC was added
 *   sdJwt: string;                    // The SD-JWT token value
 * }
 */

