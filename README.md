# AME27 Software Design Challenge

Database architecture and backend logic for Formula EV Design Challenge

## Deliverables

| # | Deliverable | File |
|---|-------------|------|
| 1 | Database Schema (ERD + SQL) | [`01-schema.sql`](.schema.sql) |
| 2 | Core Business Logic | [`02-selectForInterview.ts`](.selectForInterview.ts) |

## Key Design Decisions

- **Composite foreign keys** enforce that subteam choices belong to the correct team at the database level
- **Pessimistic locking** (`SELECT ... FOR UPDATE`) prevents both race condition scenarios atomically
- **Defense-in-depth authorization** with Express middleware + business logic validation

## Entity Relationship Diagram

```mermaid
erDiagram
    Applicants {
        UUID applicant_id PK
        VARCHAR first_name
        VARCHAR last_name
        VARCHAR email UK
        VARCHAR phone
        VARCHAR classification
    }

    Teams {
        UUID team_id PK
        VARCHAR team_name UK
    }

    Subteams {
        UUID subteam_id PK
        VARCHAR subteam_name
        UUID team_id FK
        INT capacity
    }

    Applications {
        UUID app_id PK
        UUID applicant_id FK
        UUID team_id FK
        UUID first_choice_subteam_id FK
        UUID second_choice_subteam_id FK
        application_status status
        UUID primary_interviewer_subteam_id FK
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    DesignChallenges {
        UUID challenge_id PK
        UUID app_id FK
        UUID subteam_id FK
        TEXT submission_url
        challenge_status status
        TIMESTAMP submitted_at
    }

    Interviews {
        UUID interview_id PK
        UUID app_id FK
        UUID primary_interviewer_subteam_id FK
        TIMESTAMP scheduled_time
        VARCHAR scheduled_room
        TEXT notes
    }

    Applicants ||--o{ Applications : "submits"
    Teams ||--o{ Subteams : "contains"
    Teams ||--o{ Applications : "receives"
    Subteams ||--o{ Applications : "composite FK (subteam_id, team_id)"
    Applications ||--o| DesignChallenges : "has"
    Subteams ||--o{ DesignChallenges : "assigns"
    Applications ||--o| Interviews : "schedules"
```

> **Key constraint:** The composite foreign keys on `first_choice_subteam_id` and `second_choice_subteam_id` reference `subteams(subteam_id, team_id)`, ensuring the database rejects any subteam choice that doesn't belong to the application's team.
