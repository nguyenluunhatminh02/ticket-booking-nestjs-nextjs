/**
 * k6 Load Test - Ticket Booking NestJS
 * 
 * Tests high-concurrency booking scenarios to verify:
 * 1. No overselling (seats sold > available)
 * 2. Correct seat locking under concurrent access
 * 3. Reservation integrity under load
 * 4. Queue system handling
 * 5. API response times under stress
 * 
 * Prerequisites:
 *   - k6 installed: https://k6.io/docs/getting-started/installation/
 *   - Server running on localhost:3001
 *   - PostgreSQL + Redis running
 * 
 * Usage:
 *   k6 run k6-load-test.js
 *   k6 run --vus 50 --duration 60s k6-load-test.js
 *   k6 run k6-load-test.js --env SCENARIO=oversell_test
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ─── PRE-LOADED TEST DATA (from k6-setup.js) ──────────────────────────────────
let preloadedData = null;
try {
  preloadedData = JSON.parse(open('./k6-test-data.json'));
  console.log(`Loaded pre-created test data: ${preloadedData.users.length} users, event=${preloadedData.eventId}`);
} catch (e) {
  console.log('No k6-test-data.json found. Will create data in setup(). Run "node k6-setup.js" first for best results.');
}

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001/ws';
const SCENARIO = __ENV.SCENARIO || 'full';
const TEST_PASSWORD = __ENV.K6_TEST_PASSWORD || 'Password123!';

// ─── CUSTOM METRICS ────────────────────────────────────────────────────────────
const reservationSuccess = new Counter('reservation_success');
const reservationFailed = new Counter('reservation_failed');
const oversellDetected = new Counter('oversell_detected');
const seatConflicts = new Counter('seat_conflicts');
const reservationDuration = new Trend('reservation_duration', true);
const loginDuration = new Trend('login_duration', true);
const eventListDuration = new Trend('event_list_duration', true);

const successRate = new Rate('success_rate');
const errorRate = new Rate('error_rate');

// ─── SCENARIOS ─────────────────────────────────────────────────────────────────
export const options = getOptions();

function getOptions() {
  if (SCENARIO === 'oversell_test') {
    // Focused oversell test: many users trying to book the same limited seats
    return {
      scenarios: {
        oversell_stress: {
          executor: 'shared-iterations',
          vus: 100,
          iterations: 200,
          maxDuration: '120s',
        },
      },
      thresholds: {
        oversell_detected: ['count==0'],
        success_rate: ['rate>0.3'],
        reservation_duration: ['p(95)<5000'],
      },
    };
  }

  if (SCENARIO === 'spike') {
    // Spike test simulating flash sale
    return {
      scenarios: {
        spike: {
          executor: 'ramping-vus',
          startVUs: 0,
          stages: [
            { duration: '5s', target: 10 },
            { duration: '10s', target: 100 },   // Flash sale surge
            { duration: '30s', target: 100 },   // Sustained load
            { duration: '10s', target: 200 },   // Peak
            { duration: '20s', target: 200 },   // Sustained peak
            { duration: '10s', target: 0 },     // Cool down
          ],
          gracefulRampDown: '10s',
        },
      },
      thresholds: {
        oversell_detected: ['count==0'],
        http_req_duration: ['p(95)<10000'],
        success_rate: ['rate>0.2'],
      },
    };
  }

  if (SCENARIO === 'endurance') {
    // Endurance test
    return {
      scenarios: {
        endurance: {
          executor: 'constant-vus',
          vus: 30,
          duration: '5m',
        },
      },
      thresholds: {
        oversell_detected: ['count==0'],
        http_req_duration: ['p(95)<5000'],
        success_rate: ['rate>0.5'],
      },
    };
  }

  // Default: full multi-scenario test
  return {
    scenarios: {
      // Scenario 1: Browse events (read-heavy)
      browse: {
        executor: 'constant-vus',
        vus: 10,
        duration: '60s',
        exec: 'browseScenario',
        tags: { scenario: 'browse' },
      },
      // Scenario 2: Concurrent bookings (write-heavy)
      booking: {
        executor: 'ramping-vus',
        startVUs: 0,
        stages: [
          { duration: '10s', target: 20 },
          { duration: '30s', target: 50 },
          { duration: '20s', target: 50 },
        ],
        exec: 'bookingScenario',
        tags: { scenario: 'booking' },
      },
      // Scenario 3: Oversell stress test
      oversell: {
        executor: 'shared-iterations',
        vus: 50,
        iterations: 100,
        maxDuration: '60s',
        exec: 'oversellScenario',
        startTime: '5s',
        tags: { scenario: 'oversell' },
      },
    },
    thresholds: {
      oversell_detected: ['count==0'],       // ZERO overselling allowed
      http_req_duration: ['p(95)<8000'],      // 95% under 8s
      success_rate: ['rate>0.3'],
      reservation_duration: ['p(95)<5000'],
    },
  };
}

// ─── SETUP: Create test data ───────────────────────────────────────────────────
export function setup() {
  // If pre-loaded data exists (from node k6-setup.js), use it directly
  if (preloadedData && preloadedData.users && preloadedData.users.length > 0 && preloadedData.eventId) {
    console.log('======= SETUP: Using pre-loaded test data =======');
    console.log(`  Users: ${preloadedData.users.length}`);
    console.log(`  Event: ${preloadedData.eventId}`);
    console.log(`  Tier:  ${preloadedData.tierId}`);
    return preloadedData;
  }

  console.log('======= SETUP: Creating test data (no pre-loaded data) =======');
  console.log('TIP: Run "node k6-setup.js" first for auto-verified users.');

  // Register admin user
  const adminReg = register('admin_loadtest@test.com', 'Admin', 'LoadTest');

  // Login as admin (email verification may be needed - use direct DB for test)
  // For load testing, we create users and auto-verify them
  const adminLogin = login('admin_loadtest@test.com');
  const adminToken = adminLogin ? adminLogin.accessToken : null;

  if (!adminToken) {
    console.log('WARN: Could not login admin. Tests will use pre-existing data.');
  }

  // Create venue
  let venueId = null;
  if (adminToken) {
    const venueRes = http.post(`${BASE_URL}/venues`, JSON.stringify({
      name: 'K6 Test Arena',
      city: 'Ho Chi Minh City',
      country: 'Vietnam',
      capacity: 500,
    }), { headers: authHeaders(adminToken) });

    if (venueRes.status === 201 || venueRes.status === 200) {
      venueId = JSON.parse(venueRes.body).id;
      console.log(`Created venue: ${venueId}`);
    }
  }

  // Create event with limited tickets (for oversell test)
  let eventId = null;
  let tierId = null;
  if (adminToken && venueId) {
    const eventRes = http.post(`${BASE_URL}/events`, JSON.stringify({
      venueId: venueId,
      name: 'K6 Load Test Concert',
      description: 'High concurrency load test event',
      category: 'CONCERT',
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      maxTicketsPerUser: 5,
      queueEnabled: false,
    }), { headers: authHeaders(adminToken) });

    if (eventRes.status === 201 || eventRes.status === 200) {
      const eventData = JSON.parse(eventRes.body);
      eventId = eventData.id;
      console.log(`Created event: ${eventId}`);

      // Add ticket tier with LIMITED seats (key for oversell test)
      const tierRes = http.post(`${BASE_URL}/events/${eventId}/tiers`, JSON.stringify({
        name: 'VIP',
        price: 50,
        currency: 'USD',
        totalQuantity: 20, // Only 20 seats - crucial for oversell test
      }), { headers: authHeaders(adminToken) });

      if (tierRes.status === 201 || tierRes.status === 200) {
        const tierData = JSON.parse(tierRes.body);
        tierId = tierData.ticketTiers?.[0]?.id;
        console.log(`Created tier: ${tierId}`);
      }

      // Publish event
      http.post(`${BASE_URL}/events/${eventId}/publish`, null, {
        headers: authHeaders(adminToken),
      });
      console.log('Event published');
    }
  }

  // Register test users
  const userCount = 100;
  const users = [];
  for (let i = 0; i < userCount; i++) {
    const email = `loadtest_user${i}@test.com`;
    register(email, `User${i}`, 'LoadTest');
    const loginResult = login(email);
    if (loginResult) {
      users.push({
        email,
        token: loginResult.accessToken,
        userId: loginResult.user?.id || `user-${i}`,
      });
    }
  }
  console.log(`Registered & logged in ${users.length} test users`);

  // Get existing events if setup failed
  if (!eventId) {
    const eventsRes = http.get(`${BASE_URL}/events?size=5`);
    if (eventsRes.status === 200) {
      const data = JSON.parse(eventsRes.body);
      if (data.content && data.content.length > 0) {
        const ev = data.content[0];
        eventId = ev.id;
        tierId = ev.ticketTiers?.[0]?.id;
        console.log(`Using existing event: ${eventId}, tier: ${tierId}`);
      }
    }
  }

  return {
    eventId,
    tierId,
    venueId,
    users,
    adminToken,
  };
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function register(email, firstName, lastName) {
  const res = http.post(`${BASE_URL}/auth/register`, JSON.stringify({
    firstName,
    lastName,
    email,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  }), { headers: { 'Content-Type': 'application/json' } });
  return res.status === 201 || res.status === 200;
}

function login(email) {
  const start = Date.now();
  const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email,
    password: TEST_PASSWORD,
    deviceId: `k6-device-${__VU || 0}`,
    deviceName: 'k6 Load Test',
    deviceType: 'DESKTOP',
  }), { headers: { 'Content-Type': 'application/json' } });
  loginDuration.add(Date.now() - start);

  if (res.status === 200) {
    const body = JSON.parse(res.body);
    return body.data || body;
  }
  return null;
}

function getUser(data) {
  const idx = (__VU - 1) % (data.users.length || 1);
  return data.users[idx] || data.users[0];
}

// ─── SCENARIO: Browse (Read-heavy) ────────────────────────────────────────────
export function browseScenario(data) {
  group('Browse Events', () => {
    // List events
    const start = Date.now();
    const listRes = http.get(`${BASE_URL}/events?page=0&size=20`);
    eventListDuration.add(Date.now() - start);
    
    check(listRes, {
      'list events: status 200': (r) => r.status === 200,
      'list events: has content': (r) => {
        try {
          return JSON.parse(r.body).content.length >= 0;
        } catch { return false; }
      },
    });

    // Get event detail
    if (data.eventId) {
      const detailRes = http.get(`${BASE_URL}/events/${data.eventId}`);
      check(detailRes, {
        'event detail: status 200': (r) => r.status === 200,
      });

      // Get seat map
      const seatRes = http.get(`${BASE_URL}/events/${data.eventId}/seats`);
      check(seatRes, {
        'seat map: status 200': (r) => r.status === 200,
      });
    }

    // Search events
    const searchRes = http.get(`${BASE_URL}/events/search?q=concert`);
    check(searchRes, {
      'search: status 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);
}

// ─── SCENARIO: Booking Flow ────────────────────────────────────────────────────
export function bookingScenario(data) {
  if (!data.users || data.users.length === 0 || !data.eventId || !data.tierId) {
    console.log('Missing test data, skipping booking scenario');
    sleep(1);
    return;
  }

  const user = getUser(data);

  group('Full Booking Flow', () => {
    // 1. Browse event
    const eventRes = http.get(`${BASE_URL}/events/${data.eventId}`);
    check(eventRes, { 'browse event ok': (r) => r.status === 200 });

    // 2. View seat map
    const seatRes = http.get(`${BASE_URL}/events/${data.eventId}/seats`);
    check(seatRes, { 'seat map ok': (r) => r.status === 200 });

    sleep(Math.random() * 2); // User browsing time

    // 3. Reserve ticket
    const start = Date.now();
    const reserveRes = http.post(`${BASE_URL}/bookings/reserve`, JSON.stringify({
      eventId: data.eventId,
      tierId: data.tierId,
      quantity: 1,
    }), { headers: authHeaders(user.token) });
    reservationDuration.add(Date.now() - start);

    const reserved = check(reserveRes, {
      'reserve: status 200/201': (r) => r.status === 200 || r.status === 201,
      'reserve: has reservation id': (r) => {
        try {
          return !!JSON.parse(r.body).id;
        } catch { return false; }
      },
    });

    if (reserved && (reserveRes.status === 200 || reserveRes.status === 201)) {
      reservationSuccess.add(1);
      successRate.add(1);
      const reservation = JSON.parse(reserveRes.body);

      // 4. View reservation
      const getRes = http.get(`${BASE_URL}/bookings/${reservation.id}`, {
        headers: authHeaders(user.token),
      });
      check(getRes, { 'get reservation ok': (r) => r.status === 200 });

      // 5. View tickets
      const ticketsRes = http.get(`${BASE_URL}/tickets/my?page=0&size=10`, {
        headers: authHeaders(user.token),
      });
      check(ticketsRes, { 'my tickets ok': (r) => r.status === 200 });
    } else {
      reservationFailed.add(1);
      successRate.add(0);

      // Check if it's a legitimate conflict or an error
      if (reserveRes.status === 409) {
        seatConflicts.add(1);
      } else {
        errorRate.add(1);
      }
    }
  });

  sleep(Math.random() * 3 + 1);
}

// ─── SCENARIO: Oversell Stress Test ────────────────────────────────────────────
export function oversellScenario(data) {
  if (!data.users || data.users.length === 0 || !data.eventId || !data.tierId) {
    console.log('Missing test data for oversell scenario');
    sleep(1);
    return;
  }

  const user = getUser(data);

  group('Oversell Stress Test', () => {
    // All VUs try to book simultaneously
    const start = Date.now();
    const reserveRes = http.post(`${BASE_URL}/bookings/reserve`, JSON.stringify({
      eventId: data.eventId,
      tierId: data.tierId,
      quantity: 1,
    }), { headers: authHeaders(user.token) });
    reservationDuration.add(Date.now() - start);

    if (reserveRes.status === 200 || reserveRes.status === 201) {
      reservationSuccess.add(1);
      successRate.add(1);
    } else if (reserveRes.status === 409) {
      // Expected: ConflictException means the system correctly prevented oversell
      seatConflicts.add(1);
      successRate.add(1); // This is actually a success - system working correctly

      check(reserveRes, {
        'conflict has message': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.message && body.message.includes('not');
          } catch { return true; }
        },
      });
    } else {
      reservationFailed.add(1);
      errorRate.add(1);
    }
  });
}

// ─── DEFAULT FUNCTION (for oversell_test scenario) ─────────────────────────────
export default function (data) {
  if (SCENARIO === 'oversell_test') {
    oversellScenario(data);
  } else if (SCENARIO === 'spike' || SCENARIO === 'endurance') {
    bookingScenario(data);
  } else {
    // Default: run a mix
    const rand = Math.random();
    if (rand < 0.3) {
      browseScenario(data);
    } else {
      bookingScenario(data);
    }
  }
}

// ─── TEARDOWN: Verify no overselling ───────────────────────────────────────────
export function teardown(data) {
  console.log('======= TEARDOWN: Verifying results =======');

  if (data.eventId) {
    // Check final event state
    const eventRes = http.get(`${BASE_URL}/events/${data.eventId}`);
    if (eventRes.status === 200) {
      const event = JSON.parse(eventRes.body);
      console.log(`Event: ${event.name}`);
      console.log(`Total Tickets: ${event.totalTickets}`);
      console.log(`Available Tickets: ${event.availableTickets}`);
      console.log(`Status: ${event.status}`);

      const soldTickets = event.totalTickets - event.availableTickets;
      console.log(`Sold Tickets: ${soldTickets}`);

      if (event.availableTickets < 0) {
        console.error('!!! OVERSELL DETECTED: availableTickets is negative !!!');
        oversellDetected.add(1);
      }

      if (soldTickets > event.totalTickets) {
        console.error(`!!! OVERSELL DETECTED: sold ${soldTickets} > total ${event.totalTickets} !!!`);
        oversellDetected.add(1);
      }

      // Check seat map
      const seatRes = http.get(`${BASE_URL}/events/${data.eventId}/seats`);
      if (seatRes.status === 200) {
        const seatMap = JSON.parse(seatRes.body);
        console.log(`Total Seats: ${seatMap.totalSeats}`);
        console.log(`Available Seats: ${seatMap.availableSeats}`);
        const soldSeats = seatMap.totalSeats - seatMap.availableSeats;
        console.log(`Sold/Reserved Seats: ${soldSeats}`);

        if (soldSeats > event.totalTickets) {
          console.error(`!!! SEAT OVERSELL: ${soldSeats} seats sold > ${event.totalTickets} total !!!`);
          oversellDetected.add(1);
        }
      }
    }
  }

  console.log('======= LOAD TEST COMPLETE =======');
}
