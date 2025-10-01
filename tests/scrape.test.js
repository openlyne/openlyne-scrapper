jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockImplementation(() => ({
      goto: jest.fn().mockResolvedValue(),
      content: jest.fn().mockResolvedValue('<html><body><h1>Title</h1></body></html>'),
      evaluate: jest.fn().mockResolvedValue('Title'),
      screenshot: jest.fn().mockResolvedValue(Buffer.from('')),
      close: jest.fn().mockResolvedValue()
    })),
    close: jest.fn().mockResolvedValue(),
    on: jest.fn()
  })
}));

const request = require('supertest');
const app = require('../src/app');

const auth = (req) => {
  const key = process.env.API_KEY || 'abcd1234';
  return req.set('Authorization', `Bearer ${key}`);
};

describe('Scrape', () => {
  it('rejects invalid body', async () => {
  const res = await auth(request(app).post('/scrape')).send({ urls: [] });
    expect(res.status).toBe(400);
  });

  it('scrapes a simple site', async () => {
  const res = await auth(request(app).post('/scrape')).send({ urls: ['https://example.com'], format: 'text', screenshot: true });
    expect(res.status).toBe(200);
    expect(res.body.results[0].url).toBe('https://example.com/');
    expect(res.body.results[0].content).toBeDefined();
    expect(res.body.results[0].screenshotBase64).toBeDefined();
  });
});
