CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY, name varchar(100) NOT NULL, email varchar(254) NOT NULL,
  password_hash text NOT NULL, role varchar(10) NOT NULL, active boolean NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users(email);
CREATE TABLE IF NOT EXISTS refresh_sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
  token_hash varchar(64) NOT NULL, csrf_token varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL, revoked boolean NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_refresh_sessions_user_id ON refresh_sessions(user_id);
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), description text NOT NULL,
  category varchar(30) NOT NULL, latitude double precision NOT NULL, longitude double precision NOT NULL,
  accuracy double precision, image_path varchar(100) NOT NULL, status varchar(20) NOT NULL,
  created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL, deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS ix_reports_owner_id ON reports(owner_id);
CREATE INDEX IF NOT EXISTS ix_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS ix_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS ix_reports_created_at ON reports(created_at);
CREATE INDEX IF NOT EXISTS ix_reports_owner_status_created ON reports(owner_id,status,created_at);
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES reports(id), image_path varchar(100) NOT NULL,
  category varchar(30), confidence double precision, model_version varchar(100),
  outcome varchar(30) NOT NULL, probabilities_json text NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_predictions_report_id ON predictions(report_id);
CREATE TABLE IF NOT EXISTS report_status_history (
  id uuid PRIMARY KEY, report_id uuid NOT NULL REFERENCES reports(id), actor_id uuid NOT NULL REFERENCES users(id),
  previous_status varchar(20), next_status varchar(20) NOT NULL, note text NOT NULL, created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_report_status_history_report_id ON report_status_history(report_id);
