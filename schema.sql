
-- Application Status
CREATE TYPE application_status AS ENUM (
  'REVIEW',
  'PENDING_APPLICANT_ACTION',
  'INTERVIEW_SCHEDULED'
);


-- Design Challenge Status
CREATE TYPE challenge_status AS ENUM (
  'NOT_SUBMITTED',
  'SUBMITTED',
  'REVIEWED'
);


-- Applicants
CREATE TABLE applicants (
  applicant_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name            VARCHAR(255)  NOT NULL,
  last_name            VARCHAR(255)  NOT NULL,
  email           VARCHAR(255)  NOT NULL UNIQUE,
  phone           VARCHAR(20),
  classification  VARCHAR(50),        -- e.g. Freshman, Sophomore, Junior, Senior
);


-- Teams
CREATE TABLE teams (
  team_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name VARCHAR(100) NOT NULL UNIQUE
);


-- SUBTEAMS — Subdivisions within a team
-- Each subteam belongs to exactly one team.
CREATE TABLE subteams (
  subteam_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subteam_name  VARCHAR(100) NOT NULL,
  team_id       UUID         NOT NULL REFERENCES teams(team_id),
  capacity      INT          NOT NULL DEFAULT 30,
  UNIQUE (subteam_id, team_id)
);

-- APPLICATIONS — One per applicant per team and acts as the central table
-- 2 subteam choices using composite foreign keys to connect to subteams table
CREATE TABLE applications (
  app_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    UUID NOT NULL REFERENCES applicants(applicant_id),
  team_id         UUID NOT NULL REFERENCES teams(team_id),

  first_choice_subteam_id   UUID NOT NULL,
  second_choice_subteam_id  UUID NOT NULL,

  status  application_status NOT NULL DEFAULT 'REVIEW',

  -- Set when a subteam lead clicks "Select for Interview"
  -- Starts NULL, filled in by the selectForInterview function
  primary_interviewer_subteam_id  UUID,

  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Composite foreign keys: subteam choices must belong to this application's team
  FOREIGN KEY (first_choice_subteam_id, team_id)
    REFERENCES subteams(subteam_id, team_id),

  FOREIGN KEY (second_choice_subteam_id, team_id)
    REFERENCES subteams(subteam_id, team_id),

  -- The primary interviewer must be on the correct team
  FOREIGN KEY (primary_interviewer_subteam_id, team_id)
    REFERENCES subteams(subteam_id, team_id),

  -- An applicant can only apply to a team once
  UNIQUE (applicant_id, team_id),

  -- The two choices must be different subteams
  CHECK (first_choice_subteam_id != second_choice_subteam_id)
);

-- DESIGN_CHALLENGES - Tied to a specific application and assigned by the primary subteam
CREATE TABLE design_challenges (
  challenge_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id          UUID NOT NULL REFERENCES applications(app_id),
  subteam_id      UUID NOT NULL REFERENCES subteams(subteam_id),
  submission_url  TEXT,
  status          challenge_status NOT NULL DEFAULT 'NOT_SUBMITTED',
  submitted_at    TIMESTAMP
);

-- INTERVIEWS
CREATE TABLE interviews (
  interview_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id                      UUID NOT NULL REFERENCES applications(app_id),
  primary_interviewer_subteam_id  UUID NOT NULL REFERENCES subteams(subteam_id),
  scheduled_time              TIMESTAMP NOT NULL,
  scheduled_room              VARCHAR(100),
  notes                       TEXT
);
