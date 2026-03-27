const { defineConfig } = require('@playwright/test');

// The remote browser needs to reach our fixture server.
// eth1 (10.23.7.50) is routable from the LAN where the browser lives.
const FIXTURE_HOST = process.env.FIXTURE_HOST || '10.23.7.50';
const FIXTURE_PORT = process.env.FIXTURE_PORT || 8787;

module.exports = defineConfig({
  testDir: './test',
  timeout: 30_000,
  retries: 0,
  workers: 1, // single remote browser — serialize tests

  use: {
    baseURL: `http://${FIXTURE_HOST}:${FIXTURE_PORT}`,
  },

  // Serve test fixtures on the LAN-routable address
  webServer: {
    command: `python3 -m http.server ${FIXTURE_PORT} --bind ${FIXTURE_HOST} --directory test/fixtures`,
    url: `http://${FIXTURE_HOST}:${FIXTURE_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
