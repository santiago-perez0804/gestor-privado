import { db } from "../db/index.js";

export default function registerExportRoutes(app) {
  app.get("/api/export", (req, res) => {
    const data = {
      exportedAt: new Date().toISOString(),
      weights: db.prepare("SELECT * FROM weights ORDER BY recordedAt ASC").all(),
      settings: db.prepare("SELECT * FROM settings").all(),
      plans: db.prepare("SELECT * FROM plans ORDER BY id ASC").all(),
      routines: db.prepare("SELECT * FROM routines ORDER BY id ASC").all(),
      routineExercises: db.prepare("SELECT * FROM routine_exercises ORDER BY id ASC").all(),
      exerciseLogs: db.prepare("SELECT * FROM exercise_logs ORDER BY recordedAt ASC").all(),
      bodyMeasurements: db.prepare("SELECT * FROM body_measurements ORDER BY date ASC").all(),
      progressPhotos: db.prepare("SELECT * FROM progress_photos ORDER BY date ASC").all(),
      expenses: db.prepare("SELECT * FROM expenses ORDER BY date ASC").all(),
      recurringExpenses: db.prepare("SELECT * FROM recurring_expenses ORDER BY id ASC").all(),
      budgets: db.prepare("SELECT * FROM budgets ORDER BY category ASC").all(),
      incomes: db.prepare("SELECT * FROM incomes ORDER BY date ASC").all(),
      savingsGoals: db.prepare("SELECT * FROM savings_goals ORDER BY id ASC").all(),
      recurringIncomes: db.prepare("SELECT * FROM recurring_incomes ORDER BY id ASC").all(),
      accounts: db.prepare("SELECT * FROM accounts ORDER BY id ASC").all(),
      accountSnapshots: db.prepare("SELECT * FROM account_snapshots ORDER BY date ASC").all(),
      debts: db.prepare("SELECT * FROM debts ORDER BY id ASC").all(),
      savingsContributions: db.prepare("SELECT * FROM savings_contributions ORDER BY date ASC").all(),
      // Ocio (modelo nuevo). media_items queda como respaldo del modelo anterior.
      mediaItemsLegacy: db.prepare("SELECT * FROM media_items ORDER BY id ASC").all(),
      works: db.prepare("SELECT * FROM works ORDER BY id ASC").all(),
      libraryEntries: db.prepare("SELECT * FROM library_entries ORDER BY id ASC").all(),
      passes: db.prepare("SELECT * FROM passes ORDER BY id ASC").all(),
      reviews: db.prepare("SELECT * FROM reviews ORDER BY id ASC").all(),
      highlights: db.prepare("SELECT * FROM highlights ORDER BY id ASC").all(),
      readingSessions: db.prepare("SELECT * FROM reading_sessions ORDER BY startTime ASC").all(),
      artworks: db.prepare("SELECT * FROM artworks ORDER BY id ASC").all(),
      ocioGoals: db.prepare("SELECT * FROM ocio_goals").all(),
      outings: db.prepare("SELECT * FROM outings ORDER BY date ASC").all(),
      outingExpenses: db.prepare("SELECT * FROM outing_expenses").all(),
      // El token de Instagram queda fuera del export a propósito.
      projects: db
        .prepare("SELECT * FROM projects ORDER BY id ASC")
        .all()
        .map(({ accessToken, ...rest }) => rest),
      projectSnapshots: db.prepare("SELECT * FROM project_snapshots ORDER BY projectId ASC, date ASC").all(),
      certificates: db.prepare("SELECT * FROM certificates ORDER BY issuedAt ASC").all(),
    };
    res.setHeader("Content-Disposition", "attachment; filename=fisico-export.json");
    res.json(data);
  });
}
