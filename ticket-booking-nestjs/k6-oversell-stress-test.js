/**
 * k6 Oversell Stress Test - Ticket Booking System
 * 
 * Đặc biệt thiết kế để kiểm tra tính toàn vẹn dữ liệu khi có lượng lớn
 * người dùng đồng thời mua cùng một sự kiện với số vé giới hạn.
 * 
 * Kịch bản:
 *   - Event có 20 vé VIP (hoặc tùy chỉnh qua k6-setup.js --seats N)
 *   - 200 VUs đồng thời cố gắng mua vé
 *   - Kiểm tra: tổng vé bán ra KHÔNG BAO GIỜ > tổng vé có sẵn
 *   - Kiểm tra: không có 2 user cùng nhận 1 seat
 *   - Kiểm tra: hệ thống tự chuyển sang SOLD_OUT khi hết vé
 * 
 * Prerequisites:
 *   - k6 installed: https://k6.io/docs/getting-started/installation/
 *   - node k6-setup.js --users 200 --seats 20
 *   - Backend running on localhost:3001
 *   - PostgreSQL + Redis running
 * 
 * Usage:
 *   k6 run k6-oversell-stress-test.js
 *   k6 run k6-oversell-stress-test.js --env VUS=300 --env ITERATIONS=500
 *   k6 run k6-oversell-stress-test.js --env SCENARIO=spike_sale
 *   k6 run k6-oversell-stress-test.js --env SCENARIO=endurance
 *   k6 run k6-oversell-stress-test.js --env SCENARIO=thundering_herd
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// ─── LOAD PRE-CREATED TEST DATA ────────────────────────────────────────────────
let preloadedData = null;
try {
  preloadedData = JSON.parse(open('./k6-test-data.json'));
  console.log(`✓ Loaded test data: ${preloadedData.users.length} users, event=${preloadedData.eventId}, tier=${preloadedData.tierId}`);
} catch (e) {
  console.error('✗ Missing k6-test-data.json. Run: node k6-setup.js --users 200 --seats 20');
}

// ─── CONFIG ─────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';
const SCENARIO = __ENV.SCENARIO || 'oversell_blitz';
const TARGET_VUS = parseInt(__ENV.VUS || '200');
const TARGET_ITERATIONS = parseInt(__ENV.ITERATIONS || '400');
const SEAT_LIMIT = parseInt(__ENV.SEATS || '20');

// ─── CUSTOM METRICS ─────────────────────────────────────────────────────────────
// Core oversell detection
const oversellDetected = new Counter('oversell_detected');         // MUST be 0
const duplicateSeatDetected = new Counter('duplicate_seat');       // MUST be 0

// Reservation tracking
const reservationSuccess = new Counter('reservation_success');
const reservationConflict = new Counter('reservation_conflict');   // 409 = system working correctly
const reservationFailed = new Counter('reservation_error');        // 5xx = system error
const reservationTimeout = new Counter('reservation_timeout');

// Capacity tracking  
const totalTicketsSold = new Counter('total_tickets_sold');
const capacityExceeded = new Counter('capacity_exceeded');         // MUST be 0

// Performance
const reservationDuration = new Trend('reservation_duration', true);
const seatMapDuration = new Trend('seat_map_duration', true);
const eventCheckDuration = new Trend('event_check_duration', true);

// Rates
const successRate = new Rate('success_rate');
const conflictRate = new Rate('conflict_rate');
const errorRate = new Rate('error_rate');

// Gauges
const concurrentBookings = new Gauge('concurrent_bookings');

// ─── SCENARIO OPTIONS ───────────────────────────────────────────────────────────
export const options = getScenarioOptions();

function getScenarioOptions() {
  const baseThresholds = {
    'oversell_detected':     ['count==0'],    // ZERO tolerance for overselling
    'duplicate_seat':        ['count==0'],    // ZERO duplicate seat assignments
    'capacity_exceeded':     ['count==0'],    // Never exceed capacity
    'reservation_duration':  ['p(95)<8000'],  // 95% under 8s (under contention)
    'error_rate':            ['rate<0.1'],    // Less than 10% server errors
  };

  switch (SCENARIO) {
    // ── Scenario 1: Blitz Attack ──────────────────────────────────────────
    // All users hit simultaneously - max contention
    case 'oversell_blitz':
      return {
        scenarios: {
          blitz: {
            executor: 'shared-iterations',
            vus: TARGET_VUS,
            iterations: TARGET_ITERATIONS,
            maxDuration: '180s',
          },
        },
        thresholds: {
          ...baseThresholds,
          'success_rate': ['rate>0.05'],  // At least some succeed (most will 409)
        },
      };

    // ── Scenario 2: Flash Sale Spike ──────────────────────────────────────
    // Simulates a flash sale: gradual ramp → massive spike → sustained
    case 'spike_sale':
      return {
        scenarios: {
          spike: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
              { duration: '5s',  target: 10 },    // Pre-sale warmup
              { duration: '3s',  target: 200 },   // Flash sale opens! 
              { duration: '30s', target: 200 },   // Sustained rush
              { duration: '5s',  target: 300 },   // Peak surge
              { duration: '20s', target: 300 },   // Sustained peak
              { duration: '10s', target: 50 },    // Settling
              { duration: '10s', target: 0 },     // Cool down
            ],
            gracefulRampDown: '10s',
            exec: 'flashSaleScenario',
          },
        },
        thresholds: {
          ...baseThresholds,
          'http_req_duration': ['p(99)<15000'],
        },
      };

    // ── Scenario 3: Thundering Herd ───────────────────────────────────────
    // All VUs start at the EXACT same time (worst case)
    case 'thundering_herd':
      return {
        scenarios: {
          herd: {
            executor: 'per-vu-iterations',
            vus: TARGET_VUS,
            iterations: 2,           // Each user tries twice
            maxDuration: '60s',
          },
        },
        thresholds: {
          ...baseThresholds,
        },
      };

    // ── Scenario 4: Endurance ─────────────────────────────────────────────
    // Sustained booking pressure for 5 minutes
    case 'endurance':
      return {
        scenarios: {
          endurance: {
            executor: 'constant-vus',
            vus: 50,
            duration: '5m',
            exec: 'enduranceScenario',
          },
        },
        thresholds: {
          ...baseThresholds,
          'http_req_duration': ['p(95)<5000'],
        },
      };

    // ── Scenario 5: Multi-Event ───────────────────────────────────────────
    // Mixed read + write: browsing + booking simultaneously
    case 'mixed':
      return {
        scenarios: {
          browsers: {
            executor: 'constant-vus',
            vus: 20,
            duration: '90s',
            exec: 'browseScenario',
            tags: { scenario: 'browse' },
          },
          bookers: {
            executor: 'shared-iterations',
            vus: TARGET_VUS,
            iterations: TARGET_ITERATIONS,
            maxDuration: '90s',
            exec: 'bookingBlitz',
            tags: { scenario: 'booking' },
          },
          verifiers: {
            executor: 'constant-vus',
            vus: 5,
            duration: '90s',
            exec: 'verifyIntegrity',
            startTime: '10s',
            tags: { scenario: 'verify' },
          },
        },
        thresholds: {
          ...baseThresholds,
        },
      };

    default:
      return {
        scenarios: {
          default_blitz: {
            executor: 'shared-iterations',
            vus: TARGET_VUS,
            iterations: TARGET_ITERATIONS,
            maxDuration: '180s',
          },
        },
        thresholds: baseThresholds,
      };
  }
}

// ─── SETUP ──────────────────────────────────────────────────────────────────────
export function setup() {
  if (!preloadedData || !preloadedData.users || !preloadedData.eventId) {
    console.error('═══════════════════════════════════════════════════');
    console.error('  FATAL: No test data found!');
    console.error('  Run: node k6-setup.js --users 200 --seats 20');
    console.error('═══════════════════════════════════════════════════');
    return { error: true };
  }

  // Verify event exists and is on sale
  const eventRes = http.get(`${BASE_URL}/events/${preloadedData.eventId}`);
  const eventOk = check(eventRes, {
    'setup: event exists': (r) => r.status === 200,
    'setup: event is ON_SALE': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.status === 'ON_SALE' || data.status === 'PRESALE';
      } catch { return false; }
    },
  });

  if (!eventOk) {
    console.error('Event is not available or not on sale. Run k6-setup.js first.');
  }

  // Get initial seat map to know starting state
  const seatRes = http.get(`${BASE_URL}/events/${preloadedData.eventId}/seats`);
  let initialAvailable = 0;
  if (seatRes.status === 200) {
    try {
      const seatData = JSON.parse(seatRes.body);
      if (Array.isArray(seatData)) {
        initialAvailable = seatData.filter(s => s.status === 'AVAILABLE').length;
      } else if (seatData.sections) {
        for (const section of Object.values(seatData.sections)) {
          if (Array.isArray(section)) {
            initialAvailable += section.filter(s => s.status === 'AVAILABLE').length;
          }
        }
      }
    } catch { /* ignore parse errors */ }
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  OVERSELL STRESS TEST - ${SCENARIO}`);
  console.log(`  Event:      ${preloadedData.eventId}`);
  console.log(`  Tier:       ${preloadedData.tierId}`);
  console.log(`  Users:      ${preloadedData.users.length}`);
  console.log(`  VUs:        ${TARGET_VUS}`);
  console.log(`  Iterations: ${TARGET_ITERATIONS}`);
  console.log(`  Seats:      ${initialAvailable} available`);
  console.log(`  Seat Limit: ${SEAT_LIMIT} (expected max)`);
  console.log('═══════════════════════════════════════════════════════════');

  return {
    ...preloadedData,
    initialAvailable,
  };
}

// ─── HELPERS ────────────────────────────────────────────────────────────────────
function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function getUser(data) {
  if (!data.users || data.users.length === 0) return null;
  const idx = (__VU - 1) % data.users.length;
  return data.users[idx];
}

function getRandomUser(data) {
  if (!data.users || data.users.length === 0) return null;
  const idx = Math.floor(Math.random() * data.users.length);
  return data.users[idx];
}

// ─── DEFAULT: OVERSELL BLITZ ────────────────────────────────────────────────────
export default function (data) {
  if (data.error) {
    console.log('Skipping - no test data');
    return;
  }
  bookingBlitz(data);
}

// ─── CORE BOOKING BLITZ ────────────────────────────────────────────────────────
export function bookingBlitz(data) {
  if (!data.users || !data.eventId || !data.tierId) {
    sleep(0.5);
    return;
  }

  const user = getUser(data);
  if (!user) return;

  group('Oversell Blitz - Reserve Ticket', () => {
    concurrentBookings.add(1);

    const payload = JSON.stringify({
      eventId: data.eventId,
      tierId: data.tierId,
      quantity: 1,
    });

    const start = Date.now();
    const res = http.post(`${BASE_URL}/bookings/reserve`, payload, {
      headers: authHeaders(user.token),
      timeout: '30s',
    });
    const duration = Date.now() - start;
    reservationDuration.add(duration);

    if (res.status === 200 || res.status === 201) {
      // SUCCESS: Got a ticket
      reservationSuccess.add(1);
      totalTicketsSold.add(1);
      successRate.add(1);
      conflictRate.add(0);
      errorRate.add(0);

      try {
        const body = JSON.parse(res.body);
        check(res, {
          'reservation has ID': () => !!body.id,
          'reservation is PENDING': () => body.status === 'PENDING',
          'ticket count matches': () => body.ticketCount === 1,
          'has expiry time': () => !!body.expiresAt,
        });

        // Verify seat details
        if (body.items && body.items.length > 0) {
          check(res, {
            'seat has section': () => !!body.items[0].section,
            'seat has row': () => !!body.items[0].rowName,
            'seat has number': () => body.items[0].seatNumber > 0,
          });
        }
      } catch { /* parse error, still counted as success */ }

    } else if (res.status === 409) {
      // CONFLICT: Expected when seats run out - system is working correctly!
      reservationConflict.add(1);
      successRate.add(1);  // 409 is correct behavior
      conflictRate.add(1);
      errorRate.add(0);

      try {
        const body = JSON.parse(res.body);
        check(res, {
          'conflict: has error message': () => !!body.message,
          'conflict: mentions availability': () => {
            const msg = (body.message || '').toLowerCase();
            return msg.includes('not') || msg.includes('available') ||
                   msg.includes('enough') || msg.includes('sold') ||
                   msg.includes('locked') || msg.includes('limit');
          },
        });
      } catch { /* ignore */ }

    } else if (res.status === 400) {
      // BAD REQUEST: Could be per-user limit or event not on sale
      reservationConflict.add(1);
      successRate.add(1);
      conflictRate.add(0);
      errorRate.add(0);

    } else if (res.status === 0 || duration > 29000) {
      // TIMEOUT
      reservationTimeout.add(1);
      errorRate.add(1);
      successRate.add(0);

    } else {
      // SERVER ERROR (5xx)
      reservationFailed.add(1);
      errorRate.add(1);
      successRate.add(0);
      console.log(`VU${__VU}: Unexpected ${res.status}: ${res.body}`);
    }
  });

  // Small random delay to simulate real-world slightly staggered requests
  sleep(Math.random() * 0.3);
}

// ─── FLASH SALE SCENARIO ────────────────────────────────────────────────────────
export function flashSaleScenario(data) {
  if (!data.users || !data.eventId || !data.tierId) {
    sleep(1);
    return;
  }

  const user = getRandomUser(data);
  if (!user) return;

  group('Flash Sale Flow', () => {
    // 1. Quick event check (simulating page load)
    const start1 = Date.now();
    const eventRes = http.get(`${BASE_URL}/events/${data.eventId}`, {
      headers: authHeaders(user.token),
    });
    eventCheckDuration.add(Date.now() - start1);

    check(eventRes, {
      'flash: event loads': (r) => r.status === 200,
    });

    // Check if already sold out before trying to book
    let soldOut = false;
    try {
      const eventData = JSON.parse(eventRes.body);
      if (eventData.status === 'SOLD_OUT' || eventData.availableTickets <= 0) {
        soldOut = true;
      }
    } catch { /* ignore */ }

    if (soldOut) {
      // Don't waste requests on sold-out events
      return;
    }

    // 2. Quick seat check
    const start2 = Date.now();
    http.get(`${BASE_URL}/events/${data.eventId}/seats`, {
      headers: authHeaders(user.token),
    });
    seatMapDuration.add(Date.now() - start2);

    // 3. Immediate booking attempt (flash sale urgency!)
    const payload = JSON.stringify({
      eventId: data.eventId,
      tierId: data.tierId,
      quantity: 1,
    });

    const start3 = Date.now();
    const reserveRes = http.post(`${BASE_URL}/bookings/reserve`, payload, {
      headers: authHeaders(user.token),
      timeout: '30s',
    });
    reservationDuration.add(Date.now() - start3);

    if (reserveRes.status === 200 || reserveRes.status === 201) {
      reservationSuccess.add(1);
      totalTicketsSold.add(1);
      successRate.add(1);
      errorRate.add(0);
    } else if (reserveRes.status === 409 || reserveRes.status === 400) {
      reservationConflict.add(1);
      successRate.add(1);
      errorRate.add(0);
    } else {
      reservationFailed.add(1);
      errorRate.add(1);
      successRate.add(0);
    }
  });

  sleep(Math.random() * 0.5);
}

// ─── ENDURANCE SCENARIO ─────────────────────────────────────────────────────────
export function enduranceScenario(data) {
  if (!data.users || !data.eventId || !data.tierId) {
    sleep(1);
    return;
  }

  const user = getRandomUser(data);
  if (!user) return;

  group('Endurance Booking', () => {
    // Mix of read and write operations
    const action = Math.random();

    if (action < 0.3) {
      // Browse
      http.get(`${BASE_URL}/events?page=0&size=20`);
      http.get(`${BASE_URL}/events/${data.eventId}`);
      sleep(1);
    } else if (action < 0.6) {
      // Book
      const res = http.post(`${BASE_URL}/bookings/reserve`, JSON.stringify({
        eventId: data.eventId,
        tierId: data.tierId,
        quantity: 1,
      }), { headers: authHeaders(user.token) });

      if (res.status === 200 || res.status === 201) {
        reservationSuccess.add(1);
        totalTicketsSold.add(1);
        successRate.add(1);

        // Sometimes cancel to free up seats (test release flow)
        try {
          const body = JSON.parse(res.body);
          if (body.id && Math.random() < 0.3) {
            sleep(2);
            http.post(`${BASE_URL}/bookings/${body.id}/cancel`, null, {
              headers: authHeaders(user.token),
            });
          }
        } catch { /* ignore */ }
      } else if (res.status === 409 || res.status === 400) {
        reservationConflict.add(1);
        successRate.add(1);
      } else {
        reservationFailed.add(1);
        errorRate.add(1);
      }
    } else {
      // Check my reservations
      http.get(`${BASE_URL}/bookings`, {
        headers: authHeaders(user.token),
      });
      http.get(`${BASE_URL}/tickets/my?page=0&size=10`, {
        headers: authHeaders(user.token),
      });
    }
  });

  sleep(Math.random() * 2 + 0.5);
}

// ─── BROWSE SCENARIO ────────────────────────────────────────────────────────────
export function browseScenario(data) {
  group('Browse During Sale', () => {
    // Event list (public)
    const listRes = http.get(`${BASE_URL}/events?page=0&size=20`);
    check(listRes, { 'browse: list ok': (r) => r.status === 200 });

    // Event detail
    if (data.eventId) {
      const detailRes = http.get(`${BASE_URL}/events/${data.eventId}`);
      check(detailRes, {
        'browse: detail ok': (r) => r.status === 200,
        'browse: has availability': (r) => {
          try {
            const d = JSON.parse(r.body);
            return d.availableTickets !== undefined;
          } catch { return false; }
        },
      });

      // Seat map
      const seatRes = http.get(`${BASE_URL}/events/${data.eventId}/seats`);
      check(seatRes, { 'browse: seats ok': (r) => r.status === 200 });
    }

    // Search
    http.get(`${BASE_URL}/events/search?q=test`);
  });

  sleep(Math.random() * 3 + 1);
}

// ─── VERIFY INTEGRITY (runs parallel to booking) ───────────────────────────────
export function verifyIntegrity(data) {
  if (!data.eventId) {
    sleep(5);
    return;
  }

  group('Integrity Verification', () => {
    // Check event state
    const eventRes = http.get(`${BASE_URL}/events/${data.eventId}`);
    if (eventRes.status === 200) {
      try {
        const event = JSON.parse(eventRes.body);
        const available = event.availableTickets || 0;
        const total = event.totalTickets || SEAT_LIMIT;

        // availableTickets should never go negative
        check(eventRes, {
          'integrity: available >= 0': () => available >= 0,
          'integrity: available <= total': () => available <= total,
        });

        if (available < 0) {
          oversellDetected.add(1);
          capacityExceeded.add(1);
          console.error(`!!! OVERSELL: available=${available}, total=${total}`);
        }
      } catch { /* ignore */ }
    }

    // Check seat map consistency
    const seatRes = http.get(`${BASE_URL}/events/${data.eventId}/seats`);
    if (seatRes.status === 200) {
      try {
        const seats = JSON.parse(seatRes.body);
        let seatArray = [];
        
        if (Array.isArray(seats)) {
          seatArray = seats;
        } else if (seats.sections) {
          for (const section of Object.values(seats.sections)) {
            if (Array.isArray(section)) {
              seatArray = seatArray.concat(section);
            }
          }
        }

        // Count seats by status
        const sold = seatArray.filter(s => s.status === 'SOLD').length;
        const reserved = seatArray.filter(s => s.status === 'RESERVED').length;
        const available = seatArray.filter(s => s.status === 'AVAILABLE').length;
        const total = seatArray.length;

        check(seatRes, {
          'integrity: sold + reserved + available <= total': () => 
            (sold + reserved + available) <= total,
          'integrity: no negative counts': () => 
            sold >= 0 && reserved >= 0 && available >= 0,
        });

        // Check for duplicate assignments
        const seatIds = seatArray.map(s => s.id);
        const uniqueIds = new Set(seatIds);
        if (uniqueIds.size !== seatIds.length) {
          duplicateSeatDetected.add(1);
          console.error('!!! DUPLICATE SEAT IDs detected in seat map!');
        }

        // If sold exceeds capacity
        if (sold > SEAT_LIMIT) {
          oversellDetected.add(1);
          console.error(`!!! OVERSELL: ${sold} seats sold, limit was ${SEAT_LIMIT}`);
        }
      } catch { /* ignore */ }
    }
  });

  sleep(5); // Check every 5 seconds
}

// ─── TEARDOWN: FINAL VERIFICATION ──────────────────────────────────────────────
export function teardown(data) {
  if (data.error) return;

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  POST-TEST INTEGRITY VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════');

  // Final event state check
  const eventRes = http.get(`${BASE_URL}/events/${data.eventId}`);
  if (eventRes.status === 200) {
    try {
      const event = JSON.parse(eventRes.body);
      console.log(`  Event Status:      ${event.status}`);
      console.log(`  Total Tickets:     ${event.totalTickets}`);
      console.log(`  Available Tickets: ${event.availableTickets}`);
      console.log(`  Sold/Reserved:     ${(event.totalTickets || 0) - (event.availableTickets || 0)}`);

      if (event.availableTickets < 0) {
        console.error('  ✗ CRITICAL: Available tickets is NEGATIVE → OVERSELL DETECTED!');
      } else {
        console.log('  ✓ Available tickets >= 0 (no oversell)');
      }
    } catch { /* ignore */ }
  }

  // Final seat map check
  const seatRes = http.get(`${BASE_URL}/events/${data.eventId}/seats`);
  if (seatRes.status === 200) {
    try {
      const seats = JSON.parse(seatRes.body);
      let seatArray = [];
      
      if (Array.isArray(seats)) {
        seatArray = seats;
      } else if (seats.sections) {
        for (const section of Object.values(seats.sections)) {
          if (Array.isArray(section)) {
            seatArray = seatArray.concat(section);
          }
        }
      }

      const sold = seatArray.filter(s => s.status === 'SOLD').length;
      const reserved = seatArray.filter(s => s.status === 'RESERVED').length;
      const available = seatArray.filter(s => s.status === 'AVAILABLE').length;
      const blocked = seatArray.filter(s => s.status === 'BLOCKED').length;

      console.log(`  Seat Breakdown:`);
      console.log(`    SOLD:      ${sold}`);
      console.log(`    RESERVED:  ${reserved}`);
      console.log(`    AVAILABLE: ${available}`);
      console.log(`    BLOCKED:   ${blocked}`);
      console.log(`    TOTAL:     ${seatArray.length}`);

      if (sold + reserved > SEAT_LIMIT) {
        console.error(`  ✗ CRITICAL: ${sold + reserved} sold+reserved > ${SEAT_LIMIT} seat limit → OVERSELL!`);
      } else {
        console.log(`  ✓ ${sold + reserved} sold+reserved <= ${SEAT_LIMIT} capacity (no oversell)`);
      }

      // Check for duplicate seat assignments
      const seatStatuses = {};
      let dupes = 0;
      for (const s of seatArray) {
        if (s.status === 'SOLD' || s.status === 'RESERVED') {
          if (seatStatuses[s.id]) {
            dupes++;
          }
          seatStatuses[s.id] = true;
        }
      }
      if (dupes > 0) {
        console.error(`  ✗ CRITICAL: ${dupes} duplicate seat assignments!`);
      } else {
        console.log(`  ✓ No duplicate seat assignments`);
      }
    } catch { /* ignore */ }
  }

  console.log('═══════════════════════════════════════════════════════════');
}
