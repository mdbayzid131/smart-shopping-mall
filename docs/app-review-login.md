# Store review login

Fixed OTP support lives on the backend. No review credentials are bundled in the Flutter app.

Create the designated reviewer account as an ordinary app user, and finish its profile setup. Configure the deployed API's `.env`:

```dotenv
ENABLE_APP_REVIEW_OTP=true
TEST_FIXED_OTP_EMAIL=your-review-account@example.com
TEST_FIXED_OTP_CODE=12345
```

Replace the example email with the actual review account. The code must contain exactly five digits. Restart/recreate the API container after changing its environment (`docker compose up -d --force-recreate api`). Deploy the backend code supporting this switch first.

The configured email can request login and verify with that fixed code repeatedly without receiving an email. Other email addresses keep normal randomly generated OTPs. Account eligibility checks still apply. Put the configured email and code in the store's reviewer login instructions.

Production rejects fixed credentials unless the review switch is explicitly enabled. To disable the exception, set the switch to `false` and clear both fixed-OTP variables, then recreate the API container.
