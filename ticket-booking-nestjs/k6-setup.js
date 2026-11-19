/**
 * k6 Pre-Setup Script (Node.js)
 * 
 * Run BEFORE k6 to create & verify test users + test event data.
 * k6 cannot access the DB directly, so this script handles:
 *   1. Register test users via API
 *   2. Auto-verify emails via direct DB UPDATE
 *   3. Login all users & collect tokens
 *   4. Create venue, event, tier
 *   5. Publish event
 *   6. Write k6-test-data.json for k6 to consume
 * 
 * Usage: node k6-setup.js
 *        node k6-setup.js --users 50 --seats 20
 *        node k6-setup.js --cleanup   (delete test data)
 */

const { Client } = require('pg');
const http = require('http');

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ticket_booking',
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
};
if (!DB_CONFIG.user || !DB_CONFIG.password) {
  console.error('DB_USERNAME and DB_PASSWORD environment variables are required.');
  process.exit(1);
}

const args = process.argv.slice(2);
const USER_COUNT = parseInt(getArg('--users') || '50');
const SEAT_COUNT = parseInt(getArg('--seats') || '20');
const CLEANUP = args.includes('--cleanup');
const PASSWORD = process.env.K6_TEST_PASSWORD || 'Password123!';

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// ── HTTP Helper ─────────────────────────────────────────────────────────────
function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE.replace(/\/api\/v1$/, ''));
    const fullPath = `/api/v1${path}`;
    const options = {
      hostname: url.hostname || 'localhost',
      port: parseInt(url.port || '3001'),
      path: fullPath,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const db = new Client(DB_CONFIG);
  await db.connect();
  console.log('Connected to PostgreSQL');

  if (CLEANUP) {
    await cleanup(db);
    await db.end();
    return;
  }

  const testData = {
    users: [],
    adminToken: null,
    eventId: null,
    tierId: null,
    venueId: null,
  };

  // 1. Register admin
  console.log('\n── Registering admin user ──');
  const adminEmail = 'k6_admin@test.com';
  await registerUser(adminEmail, 'K6Admin', 'Test');
  await verifyEmail(db, adminEmail);
  const adminLogin = await loginUser(adminEmail);
  if (adminLogin) {
    testData.adminToken = adminLogin.accessToken;
    console.log(`  Admin logged in: ${adminEmail}`);
  } else {
    console.error('  FATAL: Cannot login admin. Is the server running?');
    await db.end();
    process.exit(1);
  }

  // 2. Register test users
  console.log(`\n── Registering ${USER_COUNT} test users ──`);
  const batchSize = 10;
  for (let i = 0; i < USER_COUNT; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, USER_COUNT); j++) {
      batch.push(registerUser(`k6_user${j}@test.com`, `K6User${j}`, 'Test'));
    }
    await Promise.all(batch);
    process.stdout.write(`  Registered ${Math.min(i + batchSize, USER_COUNT)}/${USER_COUNT}\r`);
  }
  console.log();

  // 3. Verify all emails at once via DB
  console.log('── Verifying all emails via DB ──');
  const verifyResult = await db.query(
    `UPDATE users SET email_verified = true, email_verified_at = NOW() 
     WHERE email LIKE 'k6_%@test.com' AND email_verified = false`
  );
  console.log(`  Verified ${verifyResult.rowCount} users`);

  // 4. Login all test users
  console.log(`\n── Logging in ${USER_COUNT} test users ──`);
  for (let i = 0; i < USER_COUNT; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, USER_COUNT); j++) {
      batch.push(
        loginUser(`k6_user${j}@test.com`).then((result) => {
          if (result) {
            testData.users.push({
              email: `k6_user${j}@test.com`,
              token: result.accessToken,
              userId: result.user?.id || `user-${j}`,
            });
          }
        })
      );
    }
    await Promise.all(batch);
    process.stdout.write(`  Logged in ${testData.users.length}/${USER_COUNT}\r`);
  }
  console.log();

  // 5. Create venue
  console.log('\n── Creating venue ──');
  const venueRes = await apiRequest('POST', '/venues', {
    name: 'K6 Test Arena',
    city: 'Ho Chi Minh City',
    country: 'Vietnam',
    capacity: 1000,
  }, testData.adminToken);

  if (venueRes.status === 201 || venueRes.status === 200) {
    testData.venueId = venueRes.body.id;
    console.log(`  Venue created: ${testData.venueId}`);
  } else {
    console.log(`  Venue creation failed (${venueRes.status}), trying to find existing...`);
    const venueList = await apiRequest('GET', '/venues', null, testData.adminToken);
    if (venueList.status === 200 && Array.isArray(venueList.body) && venueList.body.length > 0) {
      testData.venueId = venueList.body[0].id;
      console.log(`  Using existing venue: ${testData.venueId}`);
    }
  }

  // 6. Create event
  console.log('\n── Creating event ──');
  const eventDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const eventRes = await apiRequest('POST', '/events', {
    venueId: testData.venueId,
    name: `K6 Oversell Test - ${new Date().toISOString().slice(0, 16)}`,
    description: 'Load test event for concurrency verification',
    category: 'CONCERT',
    eventDate,
    maxTicketsPerUser: 2,
    queueEnabled: false,
  }, testData.adminToken);

  if (eventRes.status === 201 || eventRes.status === 200) {
    testData.eventId = eventRes.body.id;
    console.log(`  Event created: ${testData.eventId}`);
  } else {
    console.log(`  Event creation failed (${eventRes.status}): ${JSON.stringify(eventRes.body)}`);
  }

  // 7. Add ticket tier
  if (testData.eventId) {
    console.log(`\n── Adding tier with ${SEAT_COUNT} seats ──`);
    const tierRes = await apiRequest('POST', `/events/${testData.eventId}/tiers`, {
      name: 'VIP',
      price: 50,
      currency: 'USD',
      totalQuantity: SEAT_COUNT,
    }, testData.adminToken);

    if (tierRes.status === 201 || tierRes.status === 200) {
      const tiers = tierRes.body.ticketTiers || tierRes.body;
      testData.tierId = Array.isArray(tiers) ? tiers[0]?.id : tiers.id;
      console.log(`  Tier created: ${testData.tierId}`);
    } else {
      console.log(`  Tier creation failed (${tierRes.status}): ${JSON.stringify(tierRes.body)}`);
    }

    // 8. Publish event
    console.log('\n── Publishing event ──');
    const pubRes = await apiRequest('POST', `/events/${testData.eventId}/publish`, null, testData.adminToken);
    console.log(`  Publish: ${pubRes.status} - ${pubRes.body?.status || JSON.stringify(pubRes.body)}`);
  }

  // 9. Write test data JSON
  const outputPath = require('path').join(__dirname, 'k6-test-data.json');
  require('fs').writeFileSync(outputPath, JSON.stringify(testData, null, 2));
  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  Setup complete!`);
  console.log(`  Users: ${testData.users.length}`);
  console.log(`  Event: ${testData.eventId}`);
  console.log(`  Tier:  ${testData.tierId} (${SEAT_COUNT} seats)`);
  console.log(`  Data:  k6-test-data.json`);
  console.log(`══════════════════════════════════════════════`);
  console.log(`\nRun k6:`);
  console.log(`  k6 run k6-load-test.js`);
  console.log(`  k6 run k6-load-test.js --env SCENARIO=oversell_test`);

  await db.end();
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function registerUser(email, firstName, lastName) {
  try {
    await apiRequest('POST', '/auth/register', {
      firstName, lastName, email,
      password: PASSWORD,
      confirmPassword: PASSWORD,
    });
  } catch (e) {
    // Ignore - user may already exist
  }
}

async function verifyEmail(db, email) {
  await db.query(
    `UPDATE users SET email_verified = true, email_verified_at = NOW() WHERE email = $1`,
    [email]
  );
}

async function loginUser(email) {
  try {
    const res = await apiRequest('POST', '/auth/login', {
      email,
      password: PASSWORD,
      deviceId: `k6-${email.replace(/[@.]/g, '-')}`,
      deviceName: 'k6 Load Test',
      deviceType: 'DESKTOP',
    });
    if (res.status === 200) {
      return res.body.data || res.body;
    }
    return null;
  } catch {
    return null;
  }
}

async function cleanup(db) {
  console.log('── Cleaning up k6 test data ──');
  
  // Delete test reservations, tickets etc. via cascading from events
  const events = await db.query(
    `SELECT id FROM events WHERE name LIKE 'K6 %'`
  );
  for (const row of events.rows) {
    console.log(`  Deleting event data: ${row.id}`);
    await db.query(`DELETE FROM check_ins WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM comments WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM queue_entries WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM resale_listings WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM reservation_items WHERE reservation_id IN (SELECT id FROM reservations WHERE event_id = $1)`, [row.id]);
    await db.query(`DELETE FROM tickets WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM payments WHERE reservation_id IN (SELECT id FROM reservations WHERE event_id = $1)`, [row.id]);
    await db.query(`DELETE FROM reservations WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM seats WHERE event_id = $1`, [row.id]);
    await db.query(`DELETE FROM ticket_tiers WHERE event_id = $1`, [row.id]);
  }
  await db.query(`DELETE FROM events WHERE name LIKE 'K6 %'`);
  
  // Delete test users
  const users = await db.query(`SELECT id FROM users WHERE email LIKE 'k6_%@test.com'`);
  for (const row of users.rows) {
    await db.query(`DELETE FROM user_devices WHERE user_id = $1`, [row.id]);
    await db.query(`DELETE FROM audit_logs WHERE user_id = $1`, [row.id]);
    await db.query(`DELETE FROM password_history WHERE user_id = $1`, [row.id]);
    await db.query(`DELETE FROM verification_tokens WHERE user_id = $1`, [row.id]);
    await db.query(`DELETE FROM user_roles WHERE user_id = $1`, [row.id]);
  }
  await db.query(`DELETE FROM users WHERE email LIKE 'k6_%@test.com'`);

  console.log(`  Deleted ${events.rows.length} events, ${users.rows.length} users`);
  
  // Clean up JSON
  const fs = require('fs');
  const path = require('path').join(__dirname, 'k6-test-data.json');
  if (fs.existsSync(path)) fs.unlinkSync(path);
  console.log('  Cleanup complete');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
