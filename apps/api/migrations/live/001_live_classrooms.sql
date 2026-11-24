-- Additive module migration. Existing users, courses, orders and data are not altered.
-- Platform student/course IDs currently originate in admin-store.json. They are
-- application-validated references, not duplicated user or course records. Add
-- external FKs only after the platform's existing JSON data is migrated to SQL.
BEGIN;
SELECT pg_advisory_xact_lock(719248102);
CREATE TABLE IF NOT EXISTS live_classes (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (payload->>'id' = id),
  teacher_id text GENERATED ALWAYS AS (payload->>'teacherId') STORED,
  course_id text GENERATED ALWAYS AS (payload->>'courseId') STORED,
  status text GENERATED ALWAYS AS (payload->>'status') STORED,
  starts_at text GENERATED ALWAYS AS (payload->>'startsAt') STORED,
  CHECK (payload->>'status' IN ('Draft','Scheduled','Live','Completed','Cancelled')),
  CHECK ((payload->>'capacity')::integer BETWEEN 1 AND 100),
  CHECK ((payload->>'price')::integer >= 0)
);
CREATE INDEX IF NOT EXISTS live_classes_schedule ON live_classes(teacher_id, status, starts_at);
CREATE INDEX IF NOT EXISTS live_classes_course ON live_classes(course_id, status);
CREATE TABLE IF NOT EXISTS live_payment_orders (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT,
  student_id text GENERATED ALWAYS AS (payload->>'studentId') STORED,
  provider_order_id text GENERATED ALWAYS AS (payload->>'providerOrderId') STORED UNIQUE,
  payment_id text GENERATED ALWAYS AS (payload->>'paymentId') STORED UNIQUE,
  idempotency_key text GENERATED ALWAYS AS (payload->>'idempotencyKey') STORED,
  UNIQUE(student_id, idempotency_key),
  CHECK (payload->>'status' IN ('Pending','Paid','Failed','Refunded')),
  CHECK ((payload->>'amount')::integer >= 0)
);
CREATE INDEX IF NOT EXISTS live_orders_student ON live_payment_orders(student_id);
CREATE TABLE IF NOT EXISTS live_class_enrollments (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT,
  student_id text GENERATED ALWAYS AS (payload->>'studentId') STORED,
  order_id text GENERATED ALWAYS AS (payload->>'orderId') STORED REFERENCES live_payment_orders(id) ON DELETE RESTRICT,
  UNIQUE(class_id, student_id)
);
CREATE TABLE IF NOT EXISTS live_join_tickets (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT,
  identity text GENERATED ALWAYS AS (payload->>'identity') STORED UNIQUE
);
CREATE INDEX IF NOT EXISTS live_tickets_class ON live_join_tickets(class_id);
CREATE TABLE IF NOT EXISTS live_attendance (
  id text PRIMARY KEY,
  payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT,
  student_id text GENERATED ALWAYS AS (payload->>'studentId') STORED,
  sid text GENERATED ALWAYS AS (payload->>'sid') STORED UNIQUE
);
CREATE INDEX IF NOT EXISTS live_attendance_student_class ON live_attendance(student_id, class_id);
CREATE TABLE IF NOT EXISTS live_chat_messages (
  id text PRIMARY KEY, payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS live_chat_class ON live_chat_messages(class_id);
CREATE TABLE IF NOT EXISTS live_session_events (
  id text PRIMARY KEY, payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS live_events_class ON live_session_events(class_id);
CREATE TABLE IF NOT EXISTS live_notifications (
  id text PRIMARY KEY, payload jsonb NOT NULL CHECK (payload->>'id' = id),
  class_id text GENERATED ALWAYS AS (payload->>'classId') STORED REFERENCES live_classes(id) ON DELETE RESTRICT,
  student_id text GENERATED ALWAYS AS (payload->>'studentId') STORED
);
CREATE INDEX IF NOT EXISTS live_notifications_student ON live_notifications(student_id);
CREATE TABLE IF NOT EXISTS live_webhook_receipts (id text PRIMARY KEY, payload jsonb NOT NULL CHECK (payload->>'id' = id));
COMMIT;
