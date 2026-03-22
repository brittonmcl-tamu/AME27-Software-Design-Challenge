
// Triggered when a Subteam Lead clicks "Select for Interview" on an applicant's application.
// Transitions an application from "REVIEW" to "PENDING_APPLICANT_ACTION" 

interface SelectRequestPayload {
  applicationId: string;
  requestingSubteamId: string; // The ID of the subteam trying to claim the applicant
}

// Shape of a row from the applications table
interface ApplicationRecord {
  app_id: string;
  applicant_id: string;
  team_id: string;
  first_choice_subteam_id: string;
  second_choice_subteam_id: string;
  status: string;
  primary_interviewer_subteam_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// Custom error class so our Express error handler can send the right HTTP status
class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

async function selectForInterview(
  payload: SelectRequestPayload
): Promise<ApplicationRecord> {
  const { applicationId, requestingSubteamId } = payload;

  // everything below happens inside a single database transaction.
  // Callback receives a `client` object for all queries inside the transaction.
  // When the callback returns, it auto-commits otherwise it auto-rollbacks.
  const result = await db.transaction(async (client) => {

    // Fetch and lock the application row
    // FOR UPDATE locks that row so no other transaction can read or modify it until we commit/rollback

    const appResult = await client.query(
      `SELECT *
       FROM applications
       WHERE app_id = $1
       FOR UPDATE`,
      [applicationId]
    );

    // If no rows came back, the application ID doesn't exist
    if (appResult.rows.length === 0) {
      throw new HttpError(404, 'Application not found');
    }

    const application: ApplicationRecord = appResult.rows[0];

    // Validate the application is in 'REVIEW' status
    if (application.status !== 'REVIEW') {
      throw new HttpError(409,
        'Application is no longer in REVIEW status — it may have already been claimed'
      );
      // 409 Conflict because the resource is in a state that conflicts with the requested operation
    }

    // Validate the requesting subteam is a valid choice
    const isValidChoice =
      requestingSubteamId === application.first_choice_subteam_id ||
      requestingSubteamId === application.second_choice_subteam_id;

    if (!isValidChoice) {
      throw new HttpError(403,
        'Requesting subteam is not the applicant\'s 1st or 2nd choice'
      );
      // 403 Forbidden — you don't have permission to claim this applicant
    }

    // Check subteam capacity constraint
    // FOR UPDATE locks ALL the rows that where the subteam is the primary interviewer
    // and the status is one of the two statuses that count toward capacity
    const capacityResult = await client.query(
      `SELECT s.capacity
       FROM subteams s
       WHERE s.subteam_id = $1`,
      [requestingSubteamId]
    );

    if (capacityResult.rows.length === 0) {
      throw new HttpError(404, 'Requesting subteam not found');
    }

    const maxCapacity: number = capacityResult.rows[0].capacity;

    const countResult = await client.query(
      `SELECT COUNT(*) AS active_count
       FROM applications
       WHERE primary_interviewer_subteam_id = $1
         AND status IN ('PENDING_APPLICANT_ACTION', 'INTERVIEW_SCHEDULED')
       FOR UPDATE`,
      [requestingSubteamId]
    );

    const activeCount: number = parseInt(countResult.rows[0].active_count, 10);

    if (activeCount >= maxCapacity) {
      throw new HttpError(409,
        `Subteam has reached its capacity of ${maxCapacity} active applicants`
      );
    }

    // Claiming the applicant
    //  - Set the status to 'PENDING_APPLICANT_ACTION'
    //  - Record which subteam claimed them (primary_interviewer)
    const updateResult = await client.query(
      `UPDATE applications
       SET status = 'PENDING_APPLICANT_ACTION',
           primary_interviewer_subteam_id = $1
       WHERE app_id = $2
       RETURNING *`,
      [requestingSubteamId, applicationId]
    );

    return updateResult.rows[0] as ApplicationRecord;
  });
  // Transaction auto-commits here if no errors were thrown.
  // If any HttpError was thrown, the transaction auto-rolls back
  // and the error propagates up to the Express error handler.

  return result;
}

export { selectForInterview, SelectRequestPayload, ApplicationRecord };
