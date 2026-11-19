#!/usr/bin/env node

/**
 * SePay Webhook Verification Script
 *
 * PURPOSE:
 * Verifies SePay (Vietnamese payment gateway) webhook authenticity and processes
 * transaction data. Supports multiple authentication methods and validates
 * payload structure to prevent fraudulent transactions.
 *
 * WHY THIS SCRIPT:
 * - Validates incoming webhooks from SePay payment gateway
 * - Prevents duplicate transaction processing
 * - Supports API Key and OAuth2 authentication
 * - Extracts and validates transaction data
 *
 * AUTHENTICATION METHODS:
 *   1. api_key: Checks Authorization header for "Apikey <key>"
 *   2. oauth2: Checks for Bearer token (full verification needed in production)
 *   3. none: No authentication (NOT recommended for production)
 *
 * COMMAND LINE USAGE:
 *   node sepay-webhook-verify.js '<webhook-payload-json>'
 *
 * ENVIRONMENT VARIABLES:
 *   SEPAY_WEBHOOK_AUTH_TYPE - Authentication type: api_key, oauth2, none (default: none)
 *   SEPAY_WEBHOOK_API_KEY - API key for verification (required if auth_type=api_key)
 *
 * WEBHOOK PAYLOAD STRUCTURE:
 *   {
 *     "id": "transaction-123",
 *     "gateway": "sepay",
 *     "transactionDate": "2025-01-07T10:30:00Z",
 *     "accountNumber": "1234567890",
 *     "transferType": "in",  // "in" or "out"
 *     "transferAmount": 100000,
 *     "accumulated": 500000,
 *     "referenceCode": "REF123",
 *     "code": "TXN123",
 *     "content": "Payment for order #456",
 *     "subAccount": null
 *   }
 *
 * REQUIRED FIELDS:
 *   - id: Transaction identifier
 *   - gateway: Payment gateway name
 *   - transactionDate: ISO 8601 timestamp
 *   - accountNumber: Bank account number
 *   - transferType: "in" (incoming) or "out" (outgoing)
 *   - transferAmount: Amount in VND (must be positive)
 *   - referenceCode: Transaction reference code
 *
 * OUTPUT FORMAT (CLI):
 *   Success:
 *     ✓ Webhook verified successfully
 *     Transaction Details:
 *       ID: transaction-123
 *       Gateway: sepay
 *       Type: in
 *       Amount: 100,000 VND
 *       Reference: REF123
 *       Content: Payment for order #456
 *       Incoming: Yes
 *       Outgoing: No
 *
 *   Failure:
 *     ✗ Verification failed: <error message>
 *
 * EXIT CODES:
 *   0 - Verification successful
 *   1 - Verification failed or error occurred
 *
 * USAGE EXAMPLES:
 *   # Test with API key authentication
 *   SEPAY_WEBHOOK_AUTH_TYPE=api_key SEPAY_WEBHOOK_API_KEY=secret123 \
 *     node sepay-webhook-verify.js '{"id":"123","gateway":"sepay",...}'
 *
 *   # Test with no authentication (development only)
 *   node sepay-webhook-verify.js '{"id":"123","gateway":"sepay",...}'
 *
 * SERVER INTEGRATION EXAMPLE:
 *   const express = require('express');
 *   const SePayWebhookVerifier = require('./sepay-webhook-verify.js');
 *   const app = express();
 *   app.use(express.json());
 *
 *   app.post('/webhook/sepay', (req, res) => {
 *     const verifier = new SePayWebhookVerifier(
 *       process.env.SEPAY_WEBHOOK_AUTH_TYPE,
 *       process.env.SEPAY_WEBHOOK_API_KEY
 *     );
 *     const result = verifier.process(req.body, req.headers);
 *     if (result.success) {
 *       // Process transaction
 *       res.status(200).json({received: true});
 *     } else {
 *       res.status(400).json({error: result.error});
 *     }
 *   });
 *
 * SECURITY NOTES:
 *   - Always use api_key or oauth2 authentication in production
 *   - Never use 'none' authentication in production
 *   - Verify transaction ID is not duplicate before processing
 *   - Use HTTPS for webhook endpoint
 *   - Validate transferAmount is positive number
 *   - Check transactionDate is recent (not replay attack)
 *
 * CLASS STRUCTURE:
 *   SePayWebhookVerifier:
 *   - constructor(authType, apiKey): Initialize with auth config
 *   - verifyAuthentication(headers): Verify Authorization header
 *   - isDuplicate(transactionId, processedIds): Check for duplicates
 *   - validatePayload(payload): Validate required fields and types
 *   - process(payload, headers): Main verification method
 *
 * MODULE EXPORT:
 *   Exports SePayWebhookVerifier class for use in other scripts
 *   Can be imported: const SePayWebhookVerifier = require('./sepay-webhook-verify.js');
 */

const crypto = require('crypto');
const { createLogger } = require('../../../../test-utils/logger');

// Create logger for sepay webhook verifier
const logger = createLogger({ module: 'sepay-webhook-verify' });

class SePayWebhookVerifier {
  constructor(authType = 'none', apiKey = null) {
    this.authType = authType;
    this.apiKey = apiKey;
  }

  /**
   * Verify webhook authenticity
   */
  verifyAuthentication(headers) {
    if (this.authType === 'none') {
      logger.warn('No authentication configured for webhook verification');
      console.log('⚠️  Warning: No authentication configured');
      return true;
    }

    if (this.authType === 'api_key') {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader) {
        logger.error('Missing Authorization header');
        throw new Error('Missing Authorization header');
      }

      const expectedAuth = `Apikey ${this.apiKey}`;
      if (authHeader !== expectedAuth) {
        logger.error('Invalid API key provided');
        throw new Error('Invalid API key');
      }

      logger.info('API key authentication successful');
      return true;
    }

    if (this.authType === 'oauth2') {
      const authHeader = headers['authorization'] || headers['Authorization'];

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.error('Missing or invalid OAuth2 Bearer token');
        throw new Error('Missing or invalid OAuth2 Bearer token');
      }

      // In production, verify token with OAuth2 provider
      logger.info('OAuth2 token present (full verification needed in production)');
      console.log('✓ OAuth2 token present (full verification needed in production)');
      return true;
    }

    logger.error('Unknown auth type', { authType: this.authType });
    throw new Error(`Unknown auth type: ${this.authType}`);
  }

  /**
   * Check for duplicate transactions
   */
  isDuplicate(transactionId, processedIds = new Set()) {
    return processedIds.has(transactionId);
  }

  /**
   * Validate webhook payload structure
   */
  validatePayload(payload) {
    const required = [
      'id',
      'gateway',
      'transactionDate',
      'accountNumber',
      'transferType',
      'transferAmount',
      'referenceCode'
    ];

    for (const field of required) {
      if (!(field in payload)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate transfer type
    if (!['in', 'out'].includes(payload.transferType)) {
      throw new Error(`Invalid transferType: ${payload.transferType}`);
    }

    // Validate amount
    if (typeof payload.transferAmount !== 'number' || payload.transferAmount <= 0) {
      throw new Error('Invalid transferAmount');
    }

    return true;
  }

  /**
   * Process webhook payload
   */
  process(payload, headers = {}) {
    try {
      // 1. Verify authentication
      this.verifyAuthentication(headers);

      // 2. Validate payload structure
      this.validatePayload(payload);

      // 3. Extract transaction data
      const transaction = {
        id: payload.id,
        gateway: payload.gateway,
        transactionDate: new Date(payload.transactionDate),
        accountNumber: payload.accountNumber,
        code: payload.code || null,
        content: payload.content || '',
        transferType: payload.transferType,
        transferAmount: payload.transferAmount,
        accumulated: payload.accumulated || 0,
        subAccount: payload.subAccount || null,
        referenceCode: payload.referenceCode
      };

      logger.info('Webhook processed successfully', {
        transactionId: transaction.id,
        transferType: transaction.transferType,
        amount: transaction.transferAmount,
        gateway: transaction.gateway
      });

      return {
        success: true,
        transaction,
        isIncoming: transaction.transferType === 'in',
        isOutgoing: transaction.transferType === 'out'
      };
    } catch (error) {
      logger.error('Webhook processing failed', {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: node sepay-webhook-verify.js <webhook-payload-json>');
    console.log('\nEnvironment Variables:');
    console.log('  SEPAY_WEBHOOK_AUTH_TYPE - Authentication type (api_key, oauth2, none)');
    console.log('  SEPAY_WEBHOOK_API_KEY - API key for verification');
    process.exit(1);
  }

  try {
    const payload = JSON.parse(args[0]);
    const authType = process.env.SEPAY_WEBHOOK_AUTH_TYPE || 'none';
    const apiKey = process.env.SEPAY_WEBHOOK_API_KEY || null;

    const verifier = new SePayWebhookVerifier(authType, apiKey);

    // Mock headers for CLI testing
    const headers = {};
    if (authType === 'api_key' && apiKey) {
      headers['Authorization'] = `Apikey ${apiKey}`;
    }

    const result = verifier.process(payload, headers);

    if (result.success) {
      logger.info('CLI webhook verification successful', {
        transactionId: result.transaction.id,
        amount: result.transaction.transferAmount
      });
      console.log('✓ Webhook verified successfully\n');
      console.log('Transaction Details:');
      console.log(`  ID: ${result.transaction.id}`);
      console.log(`  Gateway: ${result.transaction.gateway}`);
      console.log(`  Type: ${result.transaction.transferType}`);
      console.log(`  Amount: ${result.transaction.transferAmount.toLocaleString('vi-VN')} VND`);
      console.log(`  Reference: ${result.transaction.referenceCode}`);
      console.log(`  Content: ${result.transaction.content || 'N/A'}`);
      console.log(`\n  Incoming: ${result.isIncoming ? 'Yes' : 'No'}`);
      console.log(`  Outgoing: ${result.isOutgoing ? 'Yes' : 'No'}`);
    } else {
      logger.error('CLI webhook verification failed', { error: result.error });
      console.error('✗ Verification failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    logger.error('CLI error', { error: error.message, stack: error.stack });
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

module.exports = SePayWebhookVerifier;
