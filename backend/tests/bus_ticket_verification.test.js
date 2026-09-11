const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'super_secret_test_jwt_key';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);

  app = require('../server');
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Bus Ticket Verification & Anti-Replay Suite', () => {
  const uniqueTicketNum = 'PMPML-' + Math.floor(100000 + Math.random() * 900000);
  let verifiedTicketId;

  it('1. POST /api/metro/bus/verify-ticket should validate realistic PMPML bus ticket OCR', async () => {
    const today = new Date().toISOString().split('T')[0];
    const rawOcr = 'PUNE MAHANAGAR PARIVAHAN MAHAMANDAL LTD\nTicket No: ' + uniqueTicketNum + '\nDate: ' + today + ' Time: 10:15\nBus No: MH12-RN-4821\nRoute: 103 (Katraj - Bitwise)\nFare: Rs. 25.00';

    const res = await request(app)
      .post('/api/metro/bus/verify-ticket')
      .send({
        rawText: rawOcr,
        parsedData: {
          ticketNumber: uniqueTicketNum,
          date: today,
          time: '10:15',
          busNumber: 'MH12-RN-4821',
          route: 'Route 103',
          fare: 25,
          routeOrigin: 'Katraj',
          routeDestination: 'Bitwise Tower',
        },
        originName: 'Katraj',
        destName: 'Bitwise Tower',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.ticket.ticketNumber, uniqueTicketNum);
    assert.equal(res.body.ticket.busNumber, 'MH12-RN-4821');
    assert.ok(res.body.ticket._id, 'Ticket must return database ID');
    verifiedTicketId = res.body.ticket._id;
  });

  it('2. POST /api/metro/bus/verify-ticket should reject duplicate ticket via Anti-Replay ledger', async () => {
    const today = new Date().toISOString().split('T')[0];
    const rawOcr = 'PUNE MAHANAGAR PARIVAHAN MAHAMANDAL LTD\nTicket No: ' + uniqueTicketNum + '\nDate: ' + today + '\nBus No: MH12-RN-4821';

    const res = await request(app)
      .post('/api/metro/bus/verify-ticket')
      .send({
        rawText: rawOcr,
        parsedData: {
          ticketNumber: uniqueTicketNum,
          date: today,
          busNumber: 'MH12-RN-4821',
        },
        originName: 'Katraj',
        destName: 'Bitwise Tower',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errorState, 'TICKET_ALREADY_USED');
    assert.ok(res.body.error.includes('already been submitted'));
  });

  it('3. POST /api/metro/link-ticket should attach verified ticket to journey', async () => {
    const jRes = await request(app)
      .post('/api/journey/start')
      .send({
        plannedMode: 'PUBLIC_TRANSPORT',
        origin: { name: 'Katraj' },
        destination: { name: 'Bitwise Tower' },
      });

    assert.equal(jRes.status, 201);
    const jId = jRes.body.journeyId;
    assert.ok(jId, 'Journey ID must be returned');

    const linkRes = await request(app)
      .post('/api/metro/link-ticket')
      .send({
        journeyId: jId,
        ticketId: verifiedTicketId,
        ticketNumber: uniqueTicketNum,
        operator: 'PMPML',
      });

    assert.equal(linkRes.status, 200);
    assert.equal(linkRes.body.success, true);
  });

  it('4. GET /api/transit/routes/search should return bus routes matching entered origin and destination', async () => {
    const origin = 'Symbiosis University Hospital & Research Centre';
    const destination = 'Sus Gaon';

    const res = await request(app)
      .get(`/api/transit/routes/search?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.itineraries.length > 0, 'Must return at least one itinerary');

    const firstItin = res.body.itineraries[0];
    assert.ok(firstItin.name.includes('Symbiosis University Hospital'), 'Route name must include origin');
    assert.ok(firstItin.name.includes('Sus Gaon'), 'Route name must include destination');
    assert.equal(firstItin.originName, origin);
    assert.equal(firstItin.destinationName, destination);
    assert.ok(firstItin.firstStop.name.includes('Symbiosis University Hospital'));
    assert.ok(firstItin.lastStop.name.includes('Sus Gaon'));
    assert.ok(firstItin.steps.length >= 3);
    assert.equal(firstItin.steps[0].type, 'WALK');
    assert.equal(firstItin.steps[1].type, 'BUS');
    assert.equal(firstItin.steps[2].type, 'WALK');
  });

  it('5. POST /api/metro/bus/verify-ticket should validate ticket for dynamic route and places', async () => {
    const today = new Date().toISOString().split('T')[0];
    const ticketNo = 'PMPML-SYM-' + Math.floor(10000 + Math.random() * 90000);
    const origin = 'Symbiosis University Hospital';
    const destination = 'Sus Gaon';
    const rawOcr = `PUNE MAHANAGAR PARIVAHAN MAHAMANDAL LTD\nTicket No: ${ticketNo}\nDate: ${today} Time: 11:30\nBus No: 115\nRoute: Symbiosis - Sus Gaon\nFare: Rs. 20.00`;

    const res = await request(app)
      .post('/api/metro/bus/verify-ticket')
      .send({
        rawText: rawOcr,
        parsedData: {
          ticketNumber: ticketNo,
          date: today,
          time: '11:30',
          busNumber: '115',
          route: 'Route 115 — Symbiosis ⇄ Sus Gaon',
          fare: 20,
          routeOrigin: origin,
          routeDestination: destination,
        },
        originName: origin,
        destName: destination,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.ticket.ticketNumber, ticketNo);
    assert.equal(res.body.ticket.busNumber, '115');
  });
});
