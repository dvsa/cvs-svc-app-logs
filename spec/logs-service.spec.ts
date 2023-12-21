import supertest from 'supertest';
import {
  startSlsOffline,
  stopSlsOffline,
} from './helpers/integration-test-lifecycle';

jest.setTimeout(30000);

const request = supertest('http://localhost:3000');

describe('integration test', () => {
  beforeAll((done) => {
    startSlsOffline((err: any) => {
      if (err) {
        console.error(err);
        fail();
      }
      done();
    });
  });

  afterAll(() => {
    stopSlsOffline();
  });

  // eslint-disable-next-line jest/expect-expect
  it('should respond 200 for a successful post', (done) => {
    request
      .post('/logs')
      .send({
        timestamp: new Date().getTime(),
        message: 'Test error message',
      })
      .expect(200)
      .end((err) => {
        if (err) throw err;
        done();
      });
  });

  // eslint-disable-next-line jest/expect-expect
  it('should respond 400 for a bad request', (done) => {
    request
      .post('/logs')
      .expect(400)
      .end((err) => {
        if (err) throw err;
        done();
      });
  });
});
