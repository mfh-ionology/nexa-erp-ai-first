# Notifications (Twilio)

- What it does: Queue and send outbound notifications (SMS/Email placeholder).
- Key endpoints: `/api/notifications/send` (POST), `/api/jobs/status` (GET job state).
- Roles & permissions: superadmin/admin to send; users read own notices.
- Data model: `NotificationTemplate`, `NotificationJob`.
- Jobs: `notify:send` transitions queued -> sent in demo.
- Common tasks: create a template, queue a message, check job status.
- Troubleshooting: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` if using real providers.
