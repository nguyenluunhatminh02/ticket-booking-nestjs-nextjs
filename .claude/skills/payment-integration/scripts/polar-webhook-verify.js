#!/usr/bin/env node

/**
 * Polar Webhook Verification Script
 *
 * PURPOSE:
 * Verifies Polar webhook signatures following the Standard Webhooks specification.
 * Polar is a payment platform for digital products and subscriptions. This script
 * ensures webhook authenticity using HMAC-SHA256 signatures.
 *
 * WHY THIS SCRIPT:
 * - Validates incoming webhooks from Polar payment platform
 * - Prevents replay attacks via timestamp validation (5-minute window)
 * - Supports signature versioning (v1)
 * - Categorizes events (checkout, order, subscription, etc.)
 *
 * STANDARD WEBHOOKS SPECIFICATION:
 * - Uses HMAC-SHA256 for signature generation
 * - Signed payload format: "{timestamp}.{payload}"
 * - Signature header format: "v1={signature}"
 * - Timestamp must be within 5 minutes of current time
 * - Secret is base64-encoded
 *
 * COMMAND LINE USAGE:
 *   node polar-webhook-verify.js '<webhook-payload-json>' [webhook-secret]
 *
 * ENVIRONMENT VARIABLES:
 *   POLAR_WEBHOOK_SECRET - Webhook secret in base64 format (required)
 *   Can also be provided as second command-line argument
 *
 * WEBHOOK HEADERS (required):
 *   webhook-id: Unique message identifier
 *   webhook-timestamp: Unix timestamp (seconds)
 *   webhook-signature: Signature in format "v1={base64_signature}"
 *
 * WEBHOOK PAYLOAD STRUCTURE:
 *   {
 *     "type": "order.paid",
 *     "data": {
 *       "id": "order-123",
 *       "amount": 9900,
 *       "currency": "usd",
 *       "customer_id": "cust_456",
 *       ...
 *     }
 *   }
 *
 * EVENT CATEGORIES:
 *   - checkout: Checkout flow events
 *   - order: Order lifecycle (created, paid, refunded)
 *   - subscription: Subscription changes (created, updated, canceled)
 *   - customer: Customer events
 *   - benefit: Benefit grant events
 *   - refund: Refund events
 *   - product: Product events
 *
 * PAYMENT EVENTS:
 *   - order.paid: Order successfully paid
 *   - order.created: Order created (not yet paid)
 *
 * SUBSCRIPTION EVENTS:
 *   - subscription.created: New subscription
 *   - subscription.updated: Subscription modified
 *   - subscription.canceled: Subscription canceled
 *   - All events starting with "subscription."
 *
 * OUTPUT FORMAT (CLI):
 *   Success:
 *     ✓ Webhook verified successfully
 *     Event Details:
 *       Type: order.paid
 *       Category: order
 *       Is Payment: Yes
 *       Is Subscription: No
 *     Event Data:
 *       {...}
 *
 *   Failure:
 *     ✗ Verification failed: <error message>
 *
 * EXIT CODES:
 *   0 - Verification successful
 *   1 - Verification failed or error occurred
 *
 * USAGE EXAMPLES:
 *   # Test with secret as argument
 *   node polar-webhook-verify.js '{"type":"order.paid","data":{...}}' base64secret
 *
 *   # Test with environment variable
 *   POLAR_WEBHOOK_SECRET=base64secret \
 *     node polar-webhook-verify.js '{"type":"order.paid","data":{...}}'
 *
 * SERVER INTEGRATION EXAMPLE:
 *   const express = require('express');
 *   const PolarWebhookVerifier = require('./polar-webhook-verify.js');
 *   const app = express();
 *   app.use(express.json());
 *
 *   app.post('/webhook/polar', (req, res) => {
 *     const verifier = new PolarWebhookVerifier(process.env.POLAR_WEBHOOK_SECRET);
 *     const result = verifier.process(req.body, req.headers);
 *     if (result.success) {
 *       const eventType = result.event.type;
 *       if (PolarWebhookVerifier.isPaymentEvent(eventType)) {
 *         // Handle payment
 *       } else if (PolarWebhookVerifier.isSubscriptionEvent(eventType)) {
 *         // Handle subscription change
 *       }
 *       res.status(200).json({received: true});
 *     } else {
 *       res.status(400).json({error: result.error});
 *     }
 *   });
 *
 * SECURITY NOTES:
 *   - Always verify webhook signature before processing
 *   - Reject webhooks with timestamp > 5 minutes old (prevents replay attacks)
 *   - Use HTTPS for webhook endpoint
 *   - Store webhook secret securely (environment variable, not in code)
 *   - Verify event type before processing (prevent unexpected events)
 *   - Check for duplicate webhook-id to prevent double processing
 *
 * SIGNATURE VERIFICATION PROCESS:
 *   1. Extract webhook-id, webhook-timestamp, webhook-signature from headers
 *   2. Validate timestamp is within 5 minutes of current time
 *   3. Parse signature header (may contain multiple signatures)
 *   4. Create signed payload: "{timestamp}.{payload}"
 *   5. Compute HMAC-SHA256 with base64-decoded secret
 *   6. Compare computed signature with provided signature (v1)
 *   7. Return true if any signature matches
 *
 * CLASS STRUCTURE:
 *   PolarWebhookVerifier:
 *   - constructor(secret): Initialize with base64-encoded secret
 *   - verifySignature(payload, headers): Verify HMAC signature
 *   - process(payload, headers): Main verification method
 *   - static getEventCategory(eventType): Categorize event by prefix
 *   - static isPaymentEvent(eventType): Check if payment event
 *   - static isSubscriptionEvent(eventType): Check if subscription event
 *
 * MODULE EXPORT:
 *   Exports PolarWebhookVerifier class for use in other scripts
 *   Can be imported: const PolarWebhookVerifier = require('./polar-webhook-verify.js');
 */

const crypto = require('crypto');
const { createLogger } = require('../../../../test-utils/logger');

// Create logger for polar webhook verifier
const logger = createLogger({ module: 'polar-webhook-verify' });

class PolarWebhookVerifier {
  constructor(secret) {
    if (!secret) {
      throw new Error('Webhook secret is required');
    }
    // Decode base64 secret
    this.secret = Buffer.from(secret, 'base64');
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, headers) {
    const webhookId = headers['webhook-id'];
    const webhookTimestamp = headers['webhook-timestamp'];
    const webhookSignature = headers['webhook-signature'];

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      logger.error('Missing webhook headers', { webhookId, webhookTimestamp: !!webhookTimestamp, webhookSignature: !!webhookSignature });
      throw new Error('Missing required webhook headers');
    }

    // Check timestamp (reject if > 5 minutes old)
    const timestamp = parseInt(webhookTimestamp);
    const now = Math.floor(Date.now() / 1000);

    if (Math.abs(now - timestamp) > 300) {
      logger.warn('Webhook timestamp out of range', { timestamp, now, diff: Math.abs(now - timestamp) });
      throw new Error('Webhook timestamp too old or in future');
    }

    // Parse signatures
    const signatures = webhookSignature.split(',').map(sig => {
      const parts = sig.split('=');
      const version = parts[0];
      const signature = parts.slice(1).join('='); // Rejoin in case signature contains '='
      return { version, signature };
    });

    // Create signed payload
    const signedPayload = `${webhookTimestamp}.${payload}`;

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(signedPayload)
      .digest('base64');

    // Check if any signature matches using timing-safe comparison
    const isValid = signatures.some(sig => {
      if (sig.version !== 'v1') return false;

      // Timing-safe comparison to prevent timing attacks
      const sigBuffer = Buffer.from(sig.signature, 'base64');
      const expectedBuffer = Buffer.from(expectedSignature, 'base64');

      if (sigBuffer.length !== expectedBuffer.length) return false;

      return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    });

    if (!isValid) {
      throw new Error('Invalid webhook signature');
    }

    return true;
  }

  /**
   * Process webhook event
   */
  process(payload, headers) {
    try {
      // Verify signature
      this.verifySignature(payload, headers);

      // Parse payload
      const event = typeof payload === 'string' ? JSON.parse(payload) : payload;

      // Validate event structure
      if (!event.type || !event.data) {
        logger.error('Invalid event structure', { hasType: !!event.type, hasData: !!event.data });
        throw new Error('Invalid event structure');
      }

      logger.info('Webhook verified successfully', {
        eventType: event.type,
        category: PolarWebhookVerifier.getEventCategory(event.type)
      });

      return {
        success: true,
        event: {
          type: event.type,
          data: event.data
        }
      };
    } catch (error) {
      logger.error('Webhook verification failed', {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get event category
   */
  static getEventCategory(eventType) {
    const categories = {
      'checkout.': 'checkout',
      'order.': 'order',
      'subscription.': 'subscription',
      'customer.': 'customer',
      'benefit_grant.': 'benefit',
      'refund.': 'refund',
      'product.': 'product'
    };

    for (const [prefix, category] of Object.entries(categories)) {
      if (eventType.startsWith(prefix)) {
        return category;
      }
    }

    return 'unknown';
  }

  /**
   * Check if event is a payment
   */
  static isPaymentEvent(eventType) {
    return ['order.paid', 'order.created'].includes(eventType);
  }

  /**
   * Check if event is a subscription change
   */
  static isSubscriptionEvent(eventType) {
    return eventType.startsWith('subscription.');
  }
}

// CLI Usage
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node polar-webhook-verify.js <webhook-payload-json> [webhook-secret]');
    console.log('\nWebhook secret can also be provided via POLAR_WEBHOOK_SECRET environment variable');
    console.log('\nExample:');
    console.log('  node polar-webhook-verify.js \'{"type":"order.paid","data":{...}}\' base64secret');
    process.exit(1);
  }

  try {
    const payload = args[0];
    const secret = args[1] || process.env.POLAR_WEBHOOK_SECRET;

    if (!secret) {
      logger.error('Missing webhook secret');
      console.error('✗ Error: Webhook secret is required');
      console.error('Provide it as second argument or set POLAR_WEBHOOK_SECRET environment variable');
      process.exit(1);
    }

    // Mock headers for CLI testing
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', Buffer.from(secret, 'base64'))
      .update(signedPayload)
      .digest('base64');

    const headers = {
      'webhook-id': 'msg_test_' + Date.now(),
      'webhook-timestamp': timestamp.toString(),
      'webhook-signature': `v1=${signature}`
    };

    const verifier = new PolarWebhookVerifier(secret);
    const result = verifier.process(payload, headers);

    if (result.success) {
      logger.info('CLI webhook verification successful', { eventType: result.event.type });
      console.log('✓ Webhook verified successfully\n');
      console.log('Event Details:');
      console.log(`  Type: ${result.event.type}`);
      console.log(`  Category: ${PolarWebhookVerifier.getEventCategory(result.event.type)}`);
      console.log(`  Is Payment: ${PolarWebhookVerifier.isPaymentEvent(result.event.type) ? 'Yes' : 'No'}`);
      console.log(`  Is Subscription: ${PolarWebhookVerifier.isSubscriptionEvent(result.event.type) ? 'Yes' : 'No'}`);
      console.log('\nEvent Data:');
      console.log(JSON.stringify(result.event.data, null, 2));
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

module.exports = PolarWebhookVerifier;
