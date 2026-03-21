/**
 * WalletService - Usage Guide
 * 
 * This service manages wallet configuration options that are accessible
 * throughout the entire application.
 * 
 * USAGE EXAMPLES:
 * 
 * 1. Inject the service in your component:
 * 
 *    import { WalletService } from '@services/wallet-options.service';
 *    
 *    export class MyComponent {
 *      private WalletService = inject(WalletService);
 *    }
 * 
 * 2. Access the current options:
 * 
 *    const options = this.walletService.getOptions();
 *    console.log(options.payloadEncryptionPreference);
 *    console.log(options.numberOfProofs);
 * 
 * 3. Use the signal for reactive updates:
 * 
 *    walletOptions = this.walletService.getOptionsSignal();
 *    
 *    In your template:
 *    {{ walletOptions().payloadEncryptionPreference }}
 * 
 * 4. Update options:
 * 
 *    this.walletService.updatePayloadEncryptionPreference(true);
 *    this.walletService.updateNumberOfProofs(5);
 *    this.walletService.updateNumberOfProofs(false); // Use batch size
 *    this.walletService.updateUseSignedMetadata(true);
 * 
 * 5. Listen to changes:
 * 
 *    import { effect } from '@angular/core';
 *    
 *    effect(() => {
 *      const options = this.walletService.getOptions();
 *      console.log('Wallet options updated:', options);
 *    });
 * 
 * WALLET OPTIONS STRUCTURE:
 * 
 * interface WalletOptions {
 *   payloadEncryptionPreference: boolean;
 *   // false: No preference (default behavior)
 *   // true: Prefer payload encryption even if not enforced
 *   
 *   numberOfProofs: false | number;
 *   // false: Use the batch size from metadata (default)
 *   // number: Use a specific number of proofs
 *   
 *   useSignedMetadata: boolean;
 *   // false: Use unsigned metadata (default)
 *   // true: Use signed metadata
 * }
 */

