const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');
const config = require('../dist/config').default;

const {
  getFixedTestOtp,
  isFixedTestOtpEmail,
  isValidFixedTestOtp,
} = require('../dist/helpers/fixedTestOtp.js');

const fixedEmail = 'mdbayazid131.dev@gmail.com';

test('fixed OTP applies only to the configured development email', t => {
  const original = config.fixedTestOtp;
  t.after(() => { config.fixedTestOtp = original; });
  config.fixedTestOtp = { enabled: true, email: fixedEmail, code: 12345 };
  assert.equal(isFixedTestOtpEmail(fixedEmail), true);
  assert.equal(isFixedTestOtpEmail(`  ${fixedEmail.toUpperCase()}  `), true);
  assert.equal(getFixedTestOtp(fixedEmail), 12345);
  assert.equal(isValidFixedTestOtp(fixedEmail, 12345), true);
  assert.equal(isValidFixedTestOtp(fixedEmail, '12345'), true);

  assert.equal(isFixedTestOtpEmail('another-user@example.com'), false);
  assert.equal(getFixedTestOtp('another-user@example.com'), null);
  assert.equal(isValidFixedTestOtp('another-user@example.com', 12345), false);
  assert.equal(isValidFixedTestOtp(fixedEmail, 54321), false);
});

test('fixed OTP cannot authenticate anyone when disabled', t => {
  const original = config.fixedTestOtp;
  t.after(() => { config.fixedTestOtp = original; });
  config.fixedTestOtp = { enabled: false, email: fixedEmail, code: 12345 };
  assert.equal(isFixedTestOtpEmail(fixedEmail), false);
  assert.equal(getFixedTestOtp(fixedEmail), null);
  assert.equal(isValidFixedTestOtp(fixedEmail, 12345), false);
});

test('production configuration rejects the fixed OTP exception', () => {
  const result = spawnSync(
    process.execPath,
    ['-e', "require('./dist/config')"],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        ENABLE_APP_REVIEW_OTP: 'false',
        TEST_FIXED_OTP_EMAIL: fixedEmail,
        TEST_FIXED_OTP_CODE: '12345',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(
    `${result.stdout}${result.stderr}`,
    /Fixed test OTP credentials cannot be enabled in production/,
  );
});

test('production review opt-in accepts only the configured account and code', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const otp = require('./dist/helpers/fixedTestOtp');
    const assert = require('node:assert/strict');
    assert.equal(otp.isValidFixedTestOtp('${fixedEmail}', '12345'), true);
    assert.equal(otp.isValidFixedTestOtp('${fixedEmail.toUpperCase()}', 12345), true);
    assert.equal(otp.isValidFixedTestOtp('${fixedEmail}', '54321'), false);
    assert.equal(otp.isValidFixedTestOtp('other@example.com', '12345'), false);
    assert.equal(otp.getFixedTestOtp('other@example.com'), null);
  `], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', ENABLE_APP_REVIEW_OTP: 'true',
      TEST_FIXED_OTP_EMAIL: fixedEmail, TEST_FIXED_OTP_CODE: '12345' },
  });
  assert.equal(result.status, 0, result.stderr);
});

test('review opt-in without an account or code rejects startup', () => {
  const result = spawnSync(process.execPath, ['-e', "require('./dist/config')"], {
    cwd: process.cwd(), encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'production', ENABLE_APP_REVIEW_OTP: 'true',
      TEST_FIXED_OTP_EMAIL: '', TEST_FIXED_OTP_CODE: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /App review OTP requires a configured email and five-digit code/);
});
