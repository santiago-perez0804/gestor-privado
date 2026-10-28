import { db } from "../db/index.js";

export default function registerExportRoutes(app) {
  app.get("/api/export", async (req, res) => {
    const data = {
      exportedAt: new Date().toISOString(),
      weights: await db.prepare("SELECT * FROM weights ORDER BY recordedAt ASC").all(),
      settings: await db.prepare("SELECT * FROM settings").all(),
      plans: await db.prepare("SELECT * FROM plans ORDER BY id ASC").all(),
      routines: await db.prepare("SELECT * FROM routines ORDER BY id ASC").all(),
      routineExercises: await db.prepare("SELECT * FROM routine_exercises ORDER BY id ASC").all(),
      exerciseLogs: await db.prepare("SELECT * FROM exercise_logs ORDER BY recordedAt ASC").all(),
      bodyMeasurements: await db.prepare("SELECT * FROM body_measurements ORDER BY date ASC").all(),
      progressPhotos: await db.prepare("SELECT * FROM progress_photos ORDER BY date ASC").all(),
      // Físico (rediseño). Las fotos van como datos (sin los archivos, que son privados).
      exercises: await db.prepare("SELECT * FROM exercises ORDER BY id ASC").all(),
      planSchedule: await db.prepare("SELECT * FROM plan_schedule ORDER BY planId, weekday").all(),
      workoutSessions: await db.prepare("SELECT * FROM workout_sessions ORDER BY startedAt ASC").all(),
      setLogs: await db.prepare("SELECT * FROM set_logs ORDER BY sessionId, exerciseOrder, setOrder").all(),
      goals: await db.prepare("SELECT * FROM goals ORDER BY id ASC").all(),
      measurementSessions: await db.prepare("SELECT * FROM measurement_sessions ORDER BY measuredOn ASC").all(),
      measurements: await db.prepare("SELECT * FROM measurements ORDER BY measuredOn ASC").all(),
      photoSessions: await db.prepare("SELECT * FROM photo_sessions ORDER BY date ASC").all(),
      photos: await db.prepare("SELECT id, sessionId, pose, variant, mime, width, height, note, createdAt FROM photos ORDER BY id ASC").all(),
      habits: await db.prepare("SELECT * FROM habits ORDER BY sortOrder ASC").all(),
      habitLogs: await db.prepare("SELECT * FROM habit_logs ORDER BY localDate ASC").all(),
      expenses: await db.prepare("SELECT * FROM expenses ORDER BY date ASC").all(),
      recurringExpenses: await db.prepare("SELECT * FROM recurring_expenses ORDER BY id ASC").all(),
      budgets: await db.prepare("SELECT * FROM budgets ORDER BY category ASC").all(),
      incomes: await db.prepare("SELECT * FROM incomes ORDER BY date ASC").all(),
      savingsGoals: await db.prepare("SELECT * FROM savings_goals ORDER BY id ASC").all(),
      recurringIncomes: await db.prepare("SELECT * FROM recurring_incomes ORDER BY id ASC").all(),
      accounts: await db.prepare("SELECT * FROM accounts ORDER BY id ASC").all(),
      accountSnapshots: await db.prepare("SELECT * FROM account_snapshots ORDER BY date ASC").all(),
      debts: await db.prepare("SELECT * FROM debts ORDER BY id ASC").all(),
      savingsContributions: await db.prepare("SELECT * FROM savings_contributions ORDER BY date ASC").all(),
      // Ocio (modelo nuevo). media_items queda como respaldo del modelo anterior.
      mediaItemsLegacy: await db.prepare("SELECT * FROM media_items ORDER BY id ASC").all(),
      works: await db.prepare("SELECT * FROM works ORDER BY id ASC").all(),
      libraryEntries: await db.prepare("SELECT * FROM library_entries ORDER BY id ASC").all(),
      passes: await db.prepare("SELECT * FROM passes ORDER BY id ASC").all(),
      reviews: await db.prepare("SELECT * FROM reviews ORDER BY id ASC").all(),
      highlights: await db.prepare("SELECT * FROM highlights ORDER BY id ASC").all(),
      readingSessions: await db.prepare("SELECT * FROM reading_sessions ORDER BY startTime ASC").all(),
      koreaderBooks: await db.prepare("SELECT * FROM koreader_books ORDER BY key ASC").all(),
      artworks: await db.prepare("SELECT * FROM artworks ORDER BY id ASC").all(),
      ocioGoals: await db.prepare("SELECT * FROM ocio_goals").all(),
      outings: await db.prepare("SELECT * FROM outings ORDER BY date ASC").all(),
      outingExpenses: await db.prepare("SELECT * FROM outing_expenses").all(),
      // El token de Instagram queda fuera del export a propósito.
      projects: (await db
        .prepare("SELECT * FROM projects ORDER BY id ASC")
        .all())
        .map(({ accessToken, ...rest }) => rest),
      projectSnapshots: await db.prepare("SELECT * FROM project_snapshots ORDER BY projectId ASC, date ASC").all(),
      certificates: await db.prepare("SELECT * FROM certificates ORDER BY issuedAt ASC").all(),
    };
    res.setHeader("Content-Disposition", "attachment; filename=fisico-export.json");
    res.json(data);
  });
}
