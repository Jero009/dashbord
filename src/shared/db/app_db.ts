import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SQLiteDBConnection, SQLiteConnection as SQLiteConnType } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
const sqlite: SQLiteConnType = new SQLiteConnection(CapacitorSQLite);

let db: SQLiteDBConnection | null = null;

const EXPORT_DELETE_TABLES = [
  'workout_exercise_sets',
  'workout_exercise',
  'workout_template_exercise',
  'workout',
  'workout_template',
  'exercise',
  'exercise_pr',
  'muscle_group',
  'equipment',
  'health_metric',
  'readiness_score',
  'sleep_session',
  'habit_log',
  'habit',
  'goal',
  'calendar_event',
  'body_log',
  'finance_subscription',
  'finance_investment',
  'finance_transaction',
  'finance_budget',
  'finance_account',
  'net_worth_snapshot',
  'circadian_log'
];

const EXPORT_INSERT_TABLES = [
  'muscle_group',
  'equipment',
  'workout_template',
  'exercise',
  'workout',
  'workout_template_exercise',
  'workout_exercise',
  'workout_exercise_sets',
  'exercise_pr',
  'health_metric',
  'readiness_score',
  'sleep_session',
  'habit',
  'habit_log',
  'goal',
  'calendar_event',
  'body_log',
  'finance_account',
  'finance_investment',
  'finance_subscription',
  'finance_budget',
  'finance_transaction',
  'net_worth_snapshot',
  'circadian_log'
];

function toSqlLiteral(value: unknown) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseSqlStatements(sqlContent: string) {
  const statements: string[] = [];
  let current = '';
  let insideString = false;

  for (let i = 0; i < sqlContent.length; i++) {
    const char = sqlContent[i];
    const next = sqlContent[i + 1] ?? '';

    // Skip single-line SQL comments, but only outside string literals so
    // values containing "--" survive the round-trip.
    if (!insideString && char === '-' && next === '-') {
      while (i < sqlContent.length && sqlContent[i] !== '\n') i++;
      continue;
    }

    current += char;

    if (char === "'") {
      // Handle escaped quote in SQL string literal.
      if (insideString && next === "'") {
        current += next;
        i++;
        continue;
      }
      insideString = !insideString;
      continue;
    }

    if (char === ';' && !insideString) {
      const statement = current.slice(0, -1).trim();
      if (statement) statements.push(statement);
      current = '';
    }
  }

  const tail = current.trim();
  if (tail) statements.push(tail);

  return statements.filter((statement) => {
    const upper = statement.toUpperCase();
    // Avoid nested transaction errors on plugins that wrap operations.
    return upper !== 'BEGIN TRANSACTION' && upper !== 'COMMIT';
  });
}

let initPromise: Promise<SQLiteDBConnection | null> | null = null;

export async function initDB() {
  if (Capacitor.getPlatform() === 'web') {
    console.warn('SQLite not available on web');
    return null;
  }

  if (db) return db;

  // Concurrent callers (App.vue, auto-sync) share one connection attempt
  // instead of each opening their own.
  if (initPromise) return initPromise;
  initPromise = doInitDB();
  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

async function doInitDB() {
  try {
    // @ts-expect-error - SQLite connection type mismatch
    db = await sqlite.createConnection('workout_db', false, 'no-encryption', 1);

    await db.open();

    await db.execute(`PRAGMA foreign_keys = ON;`);

    await db.execute(`
  CREATE TABLE IF NOT EXISTS workout_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS workout (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_workout_template INTEGER,
    name TEXT,
    time_start TEXT DEFAULT CURRENT_TIMESTAMP,
    time_end TEXT,
    total_kg INTEGER,
    FOREIGN KEY (id_workout_template)
      REFERENCES workout_template(id)
      ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    id_muscle_group INTEGER,
    id_equipment INTEGER,
    rest_seconds INTEGER,
    FOREIGN KEY (id_muscle_group) REFERENCES muscle_group(id),
    FOREIGN KEY (id_equipment) REFERENCES equipment(id)
  );

  CREATE TABLE IF NOT EXISTS workout_template_exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_workout_template INTEGER,
    id_exercise INTEGER,
    set_number INTEGER,
    rep_number INTEGER,
    order_index INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_workout_template)
      REFERENCES workout_template(id)
      ON DELETE CASCADE,
    FOREIGN KEY (id_exercise)
      REFERENCES exercise(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_exercise (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER,
    exercise_id INTEGER,
    order_index INTEGER,
    FOREIGN KEY (workout_id)
      REFERENCES workout(id)
      ON DELETE CASCADE,
    FOREIGN KEY (exercise_id)
      REFERENCES exercise(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS workout_exercise_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id INTEGER,
    set_number INTEGER,
    reps INTEGER,
    weight INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (workout_exercise_id)
      REFERENCES workout_exercise(id)
      ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS muscle_group (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS exercise_pr (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER NOT NULL,
    pr_weight REAL NOT NULL,
    pr_reps INTEGER NOT NULL,
    one_rep_max REAL NOT NULL,
    date_achieved TEXT DEFAULT CURRENT_TIMESTAMP,
    workout_id INTEGER,
    FOREIGN KEY (exercise_id)
      REFERENCES exercise(id)
      ON DELETE CASCADE,
    FOREIGN KEY (workout_id)
      REFERENCES workout(id)
      ON DELETE SET NULL,
    UNIQUE(exercise_id)
  );

  CREATE TABLE IF NOT EXISTS health_metric (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT,
    source TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS readiness_score (
    date TEXT PRIMARY KEY,
    score REAL NOT NULL,
    inputs_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS habit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    frequency TEXT DEFAULT 'daily',
    target INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS habit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (habit_id)
      REFERENCES habit(id)
      ON DELETE CASCADE,
    UNIQUE(habit_id, date)
  );

  CREATE TABLE IF NOT EXISTS goal (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    target_value REAL NOT NULL,
    current_value REAL DEFAULT 0,
    due_date TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS calendar_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT DEFAULT 'general',
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS circadian_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,
    day_type TEXT NOT NULL DEFAULT 'work',
    energy_wake INTEGER,
    energy_noon INTEGER,
    energy_evening INTEGER,
    meal_first TEXT,
    meal_last TEXT,
    morning_light INTEGER NOT NULL DEFAULT 0,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS finance_account (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'cash',
    institution TEXT,
    balance REAL DEFAULT 0,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS finance_investment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'stock',
    quantity REAL DEFAULT 0,
    value REAL DEFAULT 0,
    account_id INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS finance_subscription (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL DEFAULT 0,
    cadence TEXT DEFAULT 'monthly',
    next_due_date TEXT,
    account_id INTEGER,
    status TEXT DEFAULT 'active'
  );

  CREATE TABLE IF NOT EXISTS finance_transaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'other',
    amount REAL DEFAULT 0,
    type TEXT DEFAULT 'expense',
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS finance_budget (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL UNIQUE,
    monthly_limit REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS net_worth_snapshot (
    date TEXT PRIMARY KEY,
    total_assets REAL DEFAULT 0,
    total_liabilities REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS body_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    weight_kg REAL NOT NULL,
    notes TEXT,
    photo_path TEXT
  );
  
  INSERT OR IGNORE INTO muscle_group (name) VALUES
    ('chest'),
    ('back'),
    ('legs'),
    ('shoulders'),
    ('arms'),
    ('core');

  INSERT OR IGNORE INTO equipment (name) VALUES
    ('barbell'),
    ('dumbbell'),
    ('machine'),
    ('bodyweight'),
    ('cables'),
    ('other');

  WITH base_exercises(name, id_muscle_group, id_equipment, rest_seconds) AS (
    VALUES
      ('Bench Press', 1, 1, 120),
      ('Chest Fly', 1, 5, 60),
      ('Push-Up', 1, 4, 60),
      ('Incline Dumbbell Press', 1, 2, 90),
      ('Chest Press Machine', 1, 3, 90),
      ('Cable Fly', 1, 5, 60),
      ('Incline Barbell Bench Press', 1, 1, 120),
      ('Decline Hammer Strength Press', 1, 3, 90),
      ('Cable Crossover', 1, 5, 60),
      ('Deadlift', 2, 1, 180),
      ('Lat Pulldown', 2, 3, 90),
      ('Dumbbell Row', 2, 2, 90),
      ('Pull-Up', 2, 4, 120),
      ('Bent Over Row', 2, 1, 90),
      ('Seated Cable Row', 2, 5, 90),
      ('T-Bar Row', 2, 1, 120),
      ('Single Arm Lat Pulldown', 2, 5, 60),
      ('Chin-Up', 2, 4, 120),
      ('Hyperextension', 2, 6, 60),
      ('Back Squat', 3, 1, 180),
      ('Leg Press', 3, 3, 120),
      ('Walking Lunge', 3, 2, 90),
      ('Romanian Deadlift', 3, 1, 120),
      ('Leg Extension', 3, 3, 60),
      ('Goblet Squat', 3, 2, 90),
      ('Bulgarian Split Squat', 3, 2, 90),
      ('Leg Curl Machine', 3, 3, 60),
      ('Hack Squat', 3, 3, 120),
      ('Stiff Legged Deadlift', 3, 1, 120),
      ('Calf Raise', 3, 3, 45),
      ('Overhead Press', 4, 1, 120),
      ('Lateral Raise', 4, 2, 60),
      ('Face Pull', 4, 5, 60),
      ('Arnold Press', 4, 2, 90),
      ('Upright Row', 4, 1, 60),
      ('Front Raise', 4, 2, 60),
      ('Reverse Fly', 4, 2, 60),
      ('Dumbbell Shrugs', 4, 2, 60),
      ('Military Press', 4, 1, 120),
      ('Cable Lateral Raise', 4, 5, 60),
      ('Bicep Curl', 5, 2, 60),
      ('Tricep Pushdown', 5, 5, 60),
      ('Dips', 5, 4, 90),
      ('Hammer Curl', 5, 2, 60),
      ('Skull Crusher', 5, 1, 90),
      ('Preacher Curl', 5, 3, 60),
      ('Concentration Curl', 5, 2, 60),
      ('Close Grip Bench Press', 5, 1, 90),
      ('EZ Bar Curl', 5, 1, 60),
      ('Overhead Dumbbell Extension', 5, 2, 60),
      ('Plank', 6, 4, 60),
      ('Cable Crunch', 6, 5, 60),
      ('Russian Twist', 6, 6, 45),
      ('Leg Raise', 6, 4, 60),
      ('Hanging Knee Raise', 6, 4, 60),
      ('Woodchopper', 6, 5, 60),
      ('Ab Wheel Rollout', 6, 6, 60),
      ('Dead Bug', 6, 4, 45),
      ('Mountain Climbers', 6, 4, 30),
      ('Side Plank', 6, 4, 45)
  )
  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT b.name, b.id_muscle_group, b.id_equipment, b.rest_seconds
  FROM base_exercises b
  WHERE NOT EXISTS (
    SELECT 1
    FROM exercise e
    WHERE lower(e.name) = lower(b.name)
  );

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Lat Pulldown Cable', 2, 5, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Lat Pulldown Cable'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Seated Row Machine', 2, 3, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Seated Row Machine'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Reverse Fly Machine', 4, 3, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Reverse Fly Machine'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Pullover Machine', 2, 3, 75
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Pullover Machine'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Preacher Curl Dumbbell', 5, 2, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Preacher Curl Dumbbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Incline Bench Press', 1, 1, 120
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Incline Bench Press'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Chest Dips', 1, 4, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Chest Dips'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Lateral Raise Cable', 4, 5, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Lateral Raise Cable'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Triceps Extension Cable', 5, 5, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Triceps Extension Cable'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Lat Pulldown Machine', 2, 3, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Lat Pulldown Machine'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Seated Row Cable', 2, 5, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Seated Row Cable'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Back Extension', 2, 6, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Back Extension'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Bayesian Cable Curl', 5, 5, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Bayesian Cable Curl'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Reverse Curl Barbell', 5, 1, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Reverse Curl Barbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Bench Press Dumbbell', 1, 2, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Bench Press Dumbbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Chest Fly Machine', 1, 3, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Chest Fly Machine'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Shoulder Press Machine', 4, 3, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Shoulder Press Machine'));

  WITH canonical AS (
    SELECT lower(name) AS normalized_name, MIN(id) AS keep_id
    FROM exercise
    GROUP BY lower(name)
  ),
  duplicates AS (
    SELECT e.id AS duplicate_id, c.keep_id
    FROM exercise e
    JOIN canonical c ON lower(e.name) = c.normalized_name
    WHERE e.id <> c.keep_id
  )
  UPDATE workout_template_exercise
  SET id_exercise = (
    SELECT d.keep_id
    FROM duplicates d
    WHERE d.duplicate_id = workout_template_exercise.id_exercise
  )
  WHERE id_exercise IN (SELECT duplicate_id FROM duplicates);

  WITH canonical AS (
    SELECT lower(name) AS normalized_name, MIN(id) AS keep_id
    FROM exercise
    GROUP BY lower(name)
  ),
  duplicates AS (
    SELECT e.id AS duplicate_id, c.keep_id
    FROM exercise e
    JOIN canonical c ON lower(e.name) = c.normalized_name
    WHERE e.id <> c.keep_id
  )
  UPDATE workout_exercise
  SET exercise_id = (
    SELECT d.keep_id
    FROM duplicates d
    WHERE d.duplicate_id = workout_exercise.exercise_id
  )
  WHERE exercise_id IN (SELECT duplicate_id FROM duplicates);

  DELETE FROM exercise
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM exercise
    GROUP BY lower(name)
  );

  DELETE FROM workout_template_exercise
  WHERE id IN (
    SELECT dup.id
    FROM workout_template_exercise dup
    JOIN workout_template_exercise keep
      ON dup.id_workout_template = keep.id_workout_template
     AND dup.id_exercise = keep.id_exercise
     AND dup.id > keep.id
  );

  INSERT INTO workout_template (name)
  SELECT 'PULL A'
  WHERE NOT EXISTS (SELECT 1 FROM workout_template WHERE lower(name) = lower('PULL A'));

  INSERT INTO workout_template (name)
  SELECT 'PUSH A'
  WHERE NOT EXISTS (SELECT 1 FROM workout_template WHERE lower(name) = lower('PUSH A'));

  INSERT INTO workout_template (name)
  SELECT 'PULL B'
  WHERE NOT EXISTS (SELECT 1 FROM workout_template WHERE lower(name) = lower('PULL B'));

  INSERT INTO workout_template (name)
  SELECT 'PUSH B'
  WHERE NOT EXISTS (SELECT 1 FROM workout_template WHERE lower(name) = lower('PUSH B'));

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 1
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL A') AND lower(e.name) = lower('Pull-Up')
    AND NOT EXISTS (
      SELECT 1 FROM workout_template_exercise wte
      WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id
    );

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 2
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL A') AND lower(e.name) = lower('Lat Pulldown Cable')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 3
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL A') AND lower(e.name) = lower('Seated Row Machine')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 4
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL A') AND lower(e.name) = lower('Reverse Fly Machine')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 5
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL A') AND lower(e.name) = lower('Pullover Machine')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 6
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL A') AND lower(e.name) = lower('Preacher Curl Dumbbell')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 8, 1
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH A') AND lower(e.name) = lower('Incline Bench Press')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 2
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH A') AND lower(e.name) = lower('Overhead Press')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 3
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH A') AND lower(e.name) = lower('Chest Dips')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 4
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH A') AND lower(e.name) = lower('Cable Crossover')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 5
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH A') AND lower(e.name) = lower('Lateral Raise Cable')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 6
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH A') AND lower(e.name) = lower('Triceps Extension Cable')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 1
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL B') AND lower(e.name) = lower('Lat Pulldown Machine')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 2
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL B') AND lower(e.name) = lower('Seated Row Cable')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 3
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL B') AND lower(e.name) = lower('Back Extension')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 4
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL B') AND lower(e.name) = lower('Bayesian Cable Curl')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 5
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PULL B') AND lower(e.name) = lower('Reverse Curl Barbell')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 1
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH B') AND lower(e.name) = lower('Bench Press Dumbbell')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 12, 2
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH B') AND lower(e.name) = lower('Chest Fly Machine')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 3, 10, 3
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH B') AND lower(e.name) = lower('Shoulder Press Machine')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  INSERT INTO workout_template_exercise (id_workout_template, id_exercise, set_number, rep_number, order_index)
  SELECT wt.id, e.id, 2, 12, 4
  FROM workout_template wt, exercise e
  WHERE lower(wt.name) = lower('PUSH B') AND lower(e.name) = lower('Triceps Extension Cable')
    AND NOT EXISTS (SELECT 1 FROM workout_template_exercise wte WHERE wte.id_workout_template = wt.id AND wte.id_exercise = e.id);

  `);

    const workoutColumns = await db.query(`PRAGMA table_info("workout");`);
    const hasWorkoutNameColumn = (workoutColumns.values || []).some(
      (column: any) => String(column.name) === 'name'
    );

    if (!hasWorkoutNameColumn) {
      await db.execute(`ALTER TABLE workout ADD COLUMN name TEXT;`);
    }

    await db.execute(`
      UPDATE workout
      SET name = (
        SELECT wt.name
        FROM workout_template wt
        WHERE wt.id = workout.id_workout_template
      )
      WHERE name IS NULL
        AND id_workout_template IS NOT NULL;
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS sleep_session (
        date TEXT PRIMARY KEY,
        bedtime TEXT NOT NULL,
        waketime TEXT NOT NULL,
        time_asleep_hours REAL NOT NULL,
        time_in_bed_hours REAL NOT NULL,
        efficiency REAL NOT NULL,
        score INTEGER NOT NULL,
        sleep_hr REAL,
        respiratory_rate REAL,
        stage_deep_min INTEGER DEFAULT 0,
        stage_light_min INTEGER DEFAULT 0,
        stage_rem_min INTEGER DEFAULT 0,
        stage_awake_min INTEGER DEFAULT 0,
        stage_asleep_min INTEGER DEFAULT 0,
        hr_timeline_json TEXT,
        stage_timeline_json TEXT,
        source TEXT DEFAULT 'health-connect',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const habitColumns = await db.query(`PRAGMA table_info("habit");`);
    const habitColNames = new Set(
      (habitColumns.values || []).map((col: any) => String(col.name))
    );
    if (!habitColNames.has('time')) {
      await db.execute(`ALTER TABLE habit ADD COLUMN time TEXT;`);
    }
    if (!habitColNames.has('days_of_week')) {
      await db.execute(`ALTER TABLE habit ADD COLUMN days_of_week TEXT;`);
    }
    if (!habitColNames.has('goal_id')) {
      await db.execute(`ALTER TABLE habit ADD COLUMN goal_id INTEGER;`);
    }

    const calColumns = await db.query(`PRAGMA table_info("calendar_event");`);
    const calColNames = new Set((calColumns.values || []).map((c: any) => String(c.name)));
    if (!calColNames.has('time_start')) {
      await db.execute(`ALTER TABLE calendar_event ADD COLUMN time_start TEXT;`);
    }
    if (!calColNames.has('time_end')) {
      await db.execute(`ALTER TABLE calendar_event ADD COLUMN time_end TEXT;`);
    }
    if (!calColNames.has('workout_template_id')) {
      await db.execute(`ALTER TABLE calendar_event ADD COLUMN workout_template_id INTEGER;`);
    }
    if (!calColNames.has('recurrence')) {
      await db.execute(`ALTER TABLE calendar_event ADD COLUMN recurrence TEXT DEFAULT 'none';`);
    }
    if (!calColNames.has('end_date')) {
      await db.execute(`ALTER TABLE calendar_event ADD COLUMN end_date TEXT;`);
    }

    const subColumns = await db.query(`PRAGMA table_info("finance_subscription");`);
    const subColNames = new Set((subColumns.values || []).map((c: any) => String(c.name)));
    if (!subColNames.has('account_id')) {
      await db.execute(`ALTER TABLE finance_subscription ADD COLUMN account_id INTEGER;`);
    }

    const invColumns = await db.query(`PRAGMA table_info("finance_investment");`);
    const invColNames = new Set((invColumns.values || []).map((c: any) => String(c.name)));
    if (!invColNames.has('account_id')) {
      await db.execute(`ALTER TABLE finance_investment ADD COLUMN account_id INTEGER;`);
    }

    // One-time dedup: remove duplicate health_metric rows accumulated by the
    // = NULL bug in replaceHealthMetric — keeps the highest-id row per (date, type, source).
    await db.execute(`
      DELETE FROM health_metric
      WHERE id NOT IN (
        SELECT MAX(id) FROM health_metric GROUP BY date, type, source
      );
    `);

    return db;
  } catch (error) {
    console.error('initDB failed:', error);
    db = null;
    return null;
  }
}
// get muscle groups and equpment

export async function getMuscleGroups() {
  if (!db) return [];
  const result = await db.query('SELECT * FROM muscle_group;');
  return result.values || [];
}

export async function getEquipment() {
  if (!db) return [];
  const result = await db.query('SELECT * FROM equipment;');
  return result.values || [];
}



// template functions


export async function createTemplate(name: string) {
  if (!db) return;

  try {
    const result = await db.run(`
      INSERT INTO workout_template (name) VALUES (?);
    `, [name]);

    return result.changes?.lastId;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}

export async function addExerciseToTemplate(
  templateId: number,
  exerciseId: number,
  setNumber: number,
  repNumber: number,
  orderIndex: number
) {
  if (!db) return;

  try {
    const result = await db.run(
      `INSERT INTO workout_template_exercise
       (id_workout_template, id_exercise, set_number, rep_number, order_index)
       VALUES (?, ?, ?, ?, ?);`,
      [templateId, exerciseId, setNumber, repNumber, orderIndex]
    );

    return result;
  } catch (error) {
    console.error('Error adding exercise to template:', error);
    throw error;
  }
}
export async function getTemplates() {
  if (!db) return [];
  const result = await db.query('SELECT * FROM workout_template;');
  return result.values || [];

}
export async function getTemplateExercises(templateId: number) {
  if (!db) return [];

  const result = await db.query(`
    SELECT 
      wte.id,
      e.name,
      wte.id_exercise,
      wte.set_number,
      wte.rep_number,
      wte.order_index
    FROM workout_template_exercise wte
    JOIN exercise e ON e.id = wte.id_exercise
    WHERE wte.id_workout_template = ?
    ORDER BY wte.order_index ASC;
  `, [templateId]);

  return result.values || [];
}
// exercise functions
export async function addExercise(name: string, muscleGroupId: number, equipmentId: number, restSeconds: number) {
  if (!db) return;

  try {
    const result = await db.run(
      `INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
      VALUES (?, ?, ?, ?);`,
      [name, muscleGroupId, equipmentId, restSeconds]
    );

    return result;
  } catch (error) {
    console.error('Error adding exercise:', error);
    throw error;
  }
}

//rename
export async function renameExercise(id: number, newName: string) {
  if (!db) return;

  try {
    const result = await db.run(
      `UPDATE exercise SET name = ? WHERE id = ?`,
      [newName, id]
    );

    return result;
  } catch (error) {
    console.error('Error renaming exercise:', error);
    throw error;
  }
}

export async function updateExerciseRestSeconds(id: number, restSeconds: number) {
  if (!db) return;

  try {
    const result = await db.run(
      `UPDATE exercise SET rest_seconds = ? WHERE id = ?`,
      [restSeconds, id]
    );

    return result;
  } catch (error) {
    console.error('Error updating exercise rest seconds:', error);
    throw error;
  }
}

export async function getExercises() {
  if (!db) return [];

    const result = await db.query(`
    SELECT 
      e.id,
      e.name,
      mg.name AS muscle_group,
      eq.name AS equipment,
      e.rest_seconds
    FROM exercise e
    LEFT JOIN muscle_group mg ON e.id_muscle_group = mg.id
    LEFT JOIN equipment eq ON e.id_equipment = eq.id
  `);
  return result.values || [];
}


export async function getExerciseById(id: number) {
  if (!db) return null;

  const result = await db.query(`
    SELECT
      e.id,
      e.name,
      mg.name AS muscle_group,
      eq.name AS equipment,
      e.rest_seconds
    FROM exercise e
    LEFT JOIN muscle_group mg ON e.id_muscle_group = mg.id
    LEFT JOIN equipment eq ON e.id_equipment = eq.id
    WHERE e.id = ?
  `, [id]);
  return result.values?.[0] || null;
}


export async function deleteTemplate(id: number) {
  if (!db) return;

  try {
    const result = await db.run(
      `DELETE FROM workout_template WHERE id = ? ;`,
      [id]
    );

    return result;
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}
// workout functions

export async function startWorkoutFromTemplate(templateId: number) {
  if (!db) return;

  try {
    const template = await getTemplateById(templateId);
    const result = await db.run(
      `INSERT INTO workout (id_workout_template, name) VALUES (?, ?)`,
      [templateId, template?.name || null]
    );
    const workoutId = result.changes?.lastId;

    if (!workoutId) {
      console.error('Failed to get workout ID after insert');
      return;
    }

    const templateExercises = await getTemplateExercises(templateId);

    for (const ex of templateExercises) {
      if (!db) continue;
      const resultWE = await db.run(
        `INSERT INTO workout_exercise (workout_id, exercise_id, order_index) VALUES (?, ?, ?)`,
        [workoutId, ex.id_exercise, ex.order_index]
      );
      const workoutExerciseId = resultWE.changes?.lastId;

      const previousSets = await getLatestCompletedSetsForExercise(ex.id_exercise);

      for (let i = 0; i < ex.set_number; i++) {
        let reps = ex.rep_number;
        let weight = 0;

        if (previousSets.length > 0) {
          const prevSet = previousSets[i] || previousSets[previousSets.length - 1];
          reps = prevSet.reps;
          weight = prevSet.weight;
        }

        await db.run(
          'INSERT INTO workout_exercise_sets (workout_exercise_id,set_number,reps,weight) values(?, ?, ?, ?)',
          [workoutExerciseId, i + 1, reps, weight]
        );
      }
    }
    return workoutId;
  } catch (error) {
    console.error('Error starting workout from template:', error);
    throw error;
  }
}

export async function getWorkoutExercises(workoutId: number) {
  if (!db) return [];

  const result = await db.query(`
    SELECT
      we.id,
      we.exercise_id,
      e.name,
      e.rest_seconds,
      eq.name AS equipment
    FROM workout_exercise we
    JOIN exercise e ON e.id = we.exercise_id
    LEFT JOIN equipment eq ON eq.id = e.id_equipment
    WHERE we.workout_id = ?
    ORDER BY we.order_index
  `, [workoutId]);

  return result.values || [];
}

export async function getLatestBodyWeight(): Promise<number | null> {
  if (!db) return null;
  const result = await db.query(
    'SELECT weight_kg FROM body_log ORDER BY date DESC LIMIT 1'
  );
  return result.values?.[0]?.weight_kg ?? null;
}

export async function getLatestCompletedSetsForExercise(exerciseId: number, excludeWorkoutId?: number) {
  if (!db) return [];

  const latestWorkoutResult = await db.query(
    `SELECT w.id
     FROM workout w
     JOIN workout_exercise we ON we.workout_id = w.id
     WHERE we.exercise_id = ?
       AND w.time_end IS NOT NULL
       AND (? IS NULL OR w.id <> ?)
     ORDER BY w.time_end DESC
     LIMIT 1;`,
    [exerciseId, excludeWorkoutId ?? null, excludeWorkoutId ?? null]
  );

  const latestWorkoutId = latestWorkoutResult.values?.[0]?.id;
  if (!latestWorkoutId) return [];

  const result = await db.query(
    `SELECT wes.set_number, wes.reps, wes.weight
     FROM workout_exercise_sets wes
     JOIN workout_exercise we ON we.id = wes.workout_exercise_id
     WHERE we.workout_id = ?
       AND we.exercise_id = ?
     ORDER BY wes.set_number ASC;`,
    [latestWorkoutId, exerciseId]
  );

  return result.values || [];
}

export async function getLatestCompletedSetDefaultsForExercise(exerciseId: number, excludeWorkoutId?: number) {
  const latestSets = await getLatestCompletedSetsForExercise(exerciseId, excludeWorkoutId);

  if (!latestSets.length) {
    return { reps: 10, weight: 0 };
  }

  const lastSet = latestSets[latestSets.length - 1];

  return {
    reps: Number(lastSet?.reps) > 0 ? Number(lastSet.reps) : 10,
    weight: Number(lastSet?.weight) > 0 ? Number(lastSet.weight) : 0,
  };
}

export async function getWorkoutSets(workoutExerciseId: number) {
  if (!db) return [];

  const result = await db.query(`
    select id, set_number, reps,weight,completed from workout_exercise_sets
    where workout_exercise_id = ?
    order by set_number
  `, [workoutExerciseId]);

  return result.values || [];
}

// saving workout

export async function updateWorkoutSet(id: number, reps: number, weight: number, completed: boolean) {
  if (!db) return;

  const result = await db.run(
    'UPDATE workout_exercise_sets SET reps = ?, weight = ?, completed = ? WHERE id = ?',
    [reps, weight, completed ? 1 : 0, id]
  );  
  return result;
  
}

export async function deleteWorkoutSet(setId: number) {
  if (!db) return;

  const result = await db.run(
    'DELETE FROM workout_exercise_sets WHERE id = ?',
    [setId]
  );

  return result;
}

export async function getWorkoutById(id: number) {
  if (!db) return null;

  const result = await db.query(
    'SELECT * FROM workout WHERE id = ?;'
    , [id]
  );

  return result.values?.[0] || null;
}

// Ends the workout and returns any PRs that were set or improved during it.
export async function endWorkout(id: number): Promise<AchievedPR[]> {
  if (!db) return [];
  const time_end = new Date().toISOString();
  await db.run(
    'UPDATE workout SET time_end = ? WHERE id = ?',
    [time_end, id]
  )
  await saveWorkoutTotalKg(id);
  return await updateExercisePRs(id);
}

export async function cancelWorkout(id: number) {
  if (!db) return;
  return await db.run(
    'DELETE FROM workout WHERE id = ?',
    [id]
  );
}

export async function deleteWorkoutExercise(workoutExerciseId: number) {
  if (!db) return;
  return await db.run(
    'DELETE FROM workout_exercise WHERE id = ?',
    [workoutExerciseId]
  );
}

export async function updateWorkoutExerciseOrder(workoutExerciseId: number, orderIndex: number) {
  if (!db) return;

  return await db.run(
    'UPDATE workout_exercise SET order_index = ? WHERE id = ?',
    [orderIndex, workoutExerciseId]
  );
}

export async function getWorkouts() {
  if (!db) return [];

  const result = await db.query(`
    SELECT
      w.id,
      w.id_workout_template,
      COALESCE(w.name, wt.name) AS name,
      w.time_start,
      w.time_end,
      w.total_kg
    FROM workout w
    LEFT JOIN workout_template wt
      ON wt.id = w.id_workout_template
    WHERE w.time_end IS NOT NULL
    ORDER BY w.time_start DESC
  `);

  return result.values || [];
}

export async function getWorkoutHistoryExercises(workoutId: number) {
  if (!db) return [];

  const result = await db.query(`
      SELECT
        we.id,
        we.exercise_id,
        e.name,
        SUM(CASE WHEN wes.completed = 1 THEN 1 ELSE 0 END) as set_count,
        MAX(wes.reps) as reps
      FROM workout_exercise we
      JOIN exercise e ON e.id = we.exercise_id
      LEFT JOIN workout_exercise_sets wes
        ON wes.workout_exercise_id = we.id
      WHERE we.workout_id = ?
      GROUP BY we.id
  `, [workoutId]);

  return result.values || [];
}

export async function saveWorkoutTotalKg(workoutId: number,) {
  if (!db) return;
  const totalKgResult = await db.query(`
    SELECT sum(reps * weight) as total_kg
    FROM workout_exercise_sets wes
    JOIN workout_exercise we ON we.id = wes.workout_exercise_id
    WHERE we.workout_id = ? AND wes.completed = 1;
  `, [workoutId]);
  const totalKg = totalKgResult.values?.[0]?.total_kg || 0;

  const result = await db.run(
    'UPDATE workout SET total_kg = ? WHERE id = ?',
    [totalKg, workoutId]
  );
  return result;
}

export async function getActiveWorkout() {
  if (!db) return null;
  const result = await db.query('SELECT * FROM workout WHERE time_end IS NULL LIMIT 1');
  return result.values?.[0] || null;
}

export async function getLatestWorkout() {
  if (!db) return null;
  const result = await db.query(
    'SELECT * FROM workout WHERE time_end IS NOT NULL ORDER BY time_end DESC LIMIT 1'
  );
  return result.values?.[0] || null;
}

export async function getTodayCompletedWorkouts() {
  if (!db) return [] as { id: number; name: string | null; time_start: string; time_end: string; total_kg: number | null }[];
  // time_end is stored as UTC ISO; compare both sides in the device timezone
  // so a workout finished late in the evening still counts as "today".
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const result = await db.query(
    `SELECT id, name, time_start, time_end, total_kg FROM workout
     WHERE time_end IS NOT NULL AND date(time_end, 'localtime') = ?;`,
    [today]
  );
  return (result.values ?? []) as { id: number; name: string | null; time_start: string; time_end: string; total_kg: number | null }[];
}

// Add a new exercise to an active workout
export async function addExerciseToWorkout(
  workoutId: number,
  exerciseId: number,
  orderIndex: number,
  defaultSetNumber: number = 3,
  defaultRepNumber: number = 10,
  defaultWeight: number = 0
) {
  if (!db) return;

  try {
    // Insert the exercise into workout_exercise
    const resultWE = await db.run(
      `INSERT INTO workout_exercise (workout_id, exercise_id, order_index) VALUES (?, ?, ?)`,
      [workoutId, exerciseId, orderIndex]
    );
    const workoutExerciseId = resultWE.changes?.lastId;

    const previousSets = await getLatestCompletedSetsForExercise(exerciseId, workoutId);

    if (previousSets.length > 0) {
      for (let i = 0; i < previousSets.length; i++) {
        await db.run(
          'INSERT INTO workout_exercise_sets (workout_exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?)',
          [workoutExerciseId, i + 1, previousSets[i].reps, previousSets[i].weight]
        );
      }
    } else {
      // Insert the initial set(s) into workout_exercise_sets using defaults
      for (let i = 0; i < defaultSetNumber; i++) {
        await db.run(
          'INSERT INTO workout_exercise_sets (workout_exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?)',
          [workoutExerciseId, i + 1, defaultRepNumber, defaultWeight]
        );
      }
    }

    return workoutExerciseId;
  } catch (error) {
    console.error('Error adding exercise to workout:', error);
    throw error;
  }
}

// Add a new set to an existing workout exercise
export async function addSetToWorkoutExercise(
  workoutExerciseId: number,
  setNumber: number,
  repNumber: number,
  weight: number = 0
) {
  if (!db) return;

  try {
    const result = await db.run(
      'INSERT INTO workout_exercise_sets (workout_exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?)',
      [workoutExerciseId, setNumber, repNumber, weight]
    );
    return result.changes?.lastId;
  } catch (error) {
    console.error('Error adding set to workout exercise:', error);
    throw error;
  }
}

// Get the next order index for a workout
export async function getNextWorkoutOrderIndex(workoutId: number) {
  if (!db) return 0;

  const result = await db.query(
    'SELECT MAX(order_index) as max_order FROM workout_exercise WHERE workout_id = ?',
    [workoutId]
  );
  const maxOrder = result.values?.[0]?.max_order ?? 0;
  return maxOrder + 1;
}

// Get the next set number for a workout exercise
export async function getNextSetNumber(workoutExerciseId: number) {
  if (!db) return 1;

  const result = await db.query(
    'SELECT MAX(set_number) as max_set FROM workout_exercise_sets WHERE workout_exercise_id = ?',
    [workoutExerciseId]
  );
  const maxSet = result.values?.[0]?.max_set ?? 0;
  return maxSet + 1;
}

export async function getWorkoutsByName(id:number) {
  if (!db) return [];

  const result = await db.query(`
    SELECT 
      w.id,
      COALESCE(w.name, wt.name) AS name,
      w.time_start,
      w.time_end,
      w.total_kg
    FROM workout w
    LEFT JOIN workout_template wt 
      ON wt.id = w.id_workout_template
    WHERE wt.id = ?
    ORDER BY w.time_start DESC
  `, [id]);
  return result.values || [];
}

// edit template
export async function renameTemplate(id: number, newName: string) {
  if (!db) return;
  const result = await db.run(
    `UPDATE workout_template SET name = ? WHERE id = ?`,
    [newName, id]
  );
  return result;
}

export async function editTemplateExercises(
  rowId: number,
  setNumber: number,
  repNumber: number,
  orderIndex: number
) {
  if (!db) return;

  const result = await db.run(
    `UPDATE workout_template_exercise 
     SET set_number = ?, rep_number = ?, order_index = ?
     WHERE id = ?`,
    [setNumber, repNumber, orderIndex, rowId]
  );

  return result;
}

export async function deleteTemplateExercise(rowId: number) {
  if (!db) return;

  const result = await db.run(
    `DELETE FROM workout_template_exercise WHERE id = ?`,
    [rowId]
  );

  return result;
}


export async function getTemplateById(templateId: number) {
  if (!db) return;
  const result = await db.query('SELECT * FROM workout_template WHERE id = ?', [templateId]);
  return result.values?.[0] || null;
}

export async function getTemplateExercisesByTemplateId(templateId: number) {
  if (!db) return;
  const result = await db.query(`
    SELECT
      wte.id,
      e.name,
      wte.id_exercise,
      wte.set_number,
      wte.rep_number,
      wte.order_index
    FROM workout_template_exercise wte
    JOIN exercise e ON e.id = wte.id_exercise
    WHERE wte.id_workout_template = ?
  `, [templateId]);
  return result.values || [];
}

// health + dashboard functions
async function addHealthMetric(
  date: string,
  type: string,
  value: number,
  unit?: string,
  source?: string
) {
  if (!db) return;

  try {
    const result = await db.run(
      `INSERT INTO health_metric (date, type, value, unit, source)
       VALUES (?, ?, ?, ?, ?);`,
      [date, type, value, unit ?? null, source ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding health metric:', error);
    throw error;
  }
}

export async function replaceHealthMetric(
  date: string,
  type: string,
  value: number,
  unit?: string,
  source?: string
) {
  if (!db) return;

  try {
    await db.run(
      `DELETE FROM health_metric
       WHERE date = ? AND type = ? AND (source = ? OR (source IS NULL AND ? IS NULL));`,
      [date, type, source ?? null, source ?? null]
    );

    return await addHealthMetric(date, type, value, unit, source);
  } catch (error) {
    console.error('Error replacing health metric:', error);
    throw error;
  }
}

export async function getLatestHealthMetric(type: string) {
  if (!db) return null;
  const result = await db.query(
    `SELECT * FROM health_metric
     WHERE type = ?
     ORDER BY date DESC, id DESC
     LIMIT 1;`,
    [type]
  );
  return result.values?.[0] || null;
}

export async function upsertReadinessScore(date: string, score: number, inputs: Record<string, unknown> = {}) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO readiness_score (date, score, inputs_json)
       VALUES (?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET score = excluded.score, inputs_json = excluded.inputs_json;`,
      [date, score, JSON.stringify(inputs)]
    );
    return result;
  } catch (error) {
    console.error('Error upserting readiness score:', error);
    throw error;
  }
}

export async function getReadinessScore(date: string) {
  if (!db) return null;
  const result = await db.query(
    `SELECT * FROM readiness_score WHERE date = ? LIMIT 1;`,
    [date]
  );
  return result.values?.[0] || null;
}

export async function getLatestReadinessScore() {
  if (!db) return null;
  const result = await db.query(
    `SELECT * FROM readiness_score ORDER BY date DESC LIMIT 1;`
  );
  return result.values?.[0] || null;
}

// ============ SLEEP SESSIONS ============

export interface SleepSessionRecord {
  date: string;
  bedtime: string;
  waketime: string;
  time_asleep_hours: number;
  time_in_bed_hours: number;
  efficiency: number;        // 0–1
  score: number | null;      // 0–100, null when insufficient sleep data
  sleep_hr: number | null;
  respiratory_rate: number | null;
  stage_deep_min: number;
  stage_light_min: number;
  stage_rem_min: number;
  stage_awake_min: number;
  stage_asleep_min: number;
  hr_timeline_json: string | null;   // JSON: [{t,v,o}]
  stage_timeline_json: string | null; // JSON: [{s,start,end,dur}]
  source: string;
}

export async function upsertSleepSession(record: Omit<SleepSessionRecord, 'source'> & { source?: string }) {
  if (!db) return;
  try {
    await db.run(
      `INSERT INTO sleep_session
         (date, bedtime, waketime, time_asleep_hours, time_in_bed_hours, efficiency, score,
          sleep_hr, respiratory_rate, stage_deep_min, stage_light_min, stage_rem_min,
          stage_awake_min, stage_asleep_min, hr_timeline_json, stage_timeline_json, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         bedtime = excluded.bedtime, waketime = excluded.waketime,
         time_asleep_hours = excluded.time_asleep_hours, time_in_bed_hours = excluded.time_in_bed_hours,
         efficiency = excluded.efficiency, score = excluded.score,
         sleep_hr = excluded.sleep_hr, respiratory_rate = excluded.respiratory_rate,
         stage_deep_min = excluded.stage_deep_min, stage_light_min = excluded.stage_light_min,
         stage_rem_min = excluded.stage_rem_min, stage_awake_min = excluded.stage_awake_min,
         stage_asleep_min = excluded.stage_asleep_min,
         hr_timeline_json = excluded.hr_timeline_json,
         stage_timeline_json = excluded.stage_timeline_json,
         source = excluded.source;`,
      [
        record.date, record.bedtime, record.waketime,
        record.time_asleep_hours, record.time_in_bed_hours,
        record.efficiency, record.score ?? null,
        record.sleep_hr ?? null, record.respiratory_rate ?? null,
        record.stage_deep_min ?? 0, record.stage_light_min ?? 0,
        record.stage_rem_min ?? 0, record.stage_awake_min ?? 0,
        record.stage_asleep_min ?? 0,
        record.hr_timeline_json ?? null, record.stage_timeline_json ?? null,
        record.source ?? 'health-connect',
      ]
    );
  } catch (error) {
    console.error('Error upserting sleep session:', error);
    throw error;
  }
}

export async function getSleepSession(date: string): Promise<SleepSessionRecord | null> {
  if (!db) return null;
  const result = await db.query(`SELECT * FROM sleep_session WHERE date = ? LIMIT 1;`, [date]);
  return (result.values?.[0] as SleepSessionRecord) ?? null;
}

export async function getRecentSleepSessions(limit = 14): Promise<SleepSessionRecord[]> {
  if (!db) return [];
  const result = await db.query(`SELECT * FROM sleep_session ORDER BY date DESC LIMIT ?;`, [limit]);
  return (result.values ?? []) as SleepSessionRecord[];
}

// Sleep sessions strictly before `date` (most recent first). Used to seed rolling
// baselines at sync time so the first nights inside the sync window are scored
// against prior persisted history instead of getting null/half-credit baselines.
export async function getSleepSessionsBefore(date: string, limit: number): Promise<SleepSessionRecord[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM sleep_session WHERE date < ? ORDER BY date DESC LIMIT ?;`,
    [date, limit]
  );
  return (result.values ?? []) as SleepSessionRecord[];
}

// Numeric values for a metric type strictly before `date` (most recent first).
export async function getHealthMetricValuesBefore(type: string, date: string, limit: number): Promise<number[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT value FROM health_metric WHERE type = ? AND date < ? ORDER BY date DESC LIMIT ?;`,
    [type, date, limit]
  );
  return ((result.values ?? []) as { value: number }[])
    .map((r) => Number(r.value))
    .filter((v) => Number.isFinite(v));
}

export async function getRecentHealthMetrics(type: string, limit: number = 30) {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM health_metric
     WHERE type = ?
     ORDER BY date DESC, id DESC
     LIMIT ?;`,
    [type, limit]
  );
  return result.values || [];
}

export async function addHabit(
  name: string,
  frequency: string,
  target: number,
  time?: string,
  daysOfWeek?: string,
  goalId?: number
) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO habit (name, frequency, target, time, days_of_week, goal_id) VALUES (?, ?, ?, ?, ?, ?);`,
      [name, frequency, target, time ?? null, daysOfWeek ?? null, goalId ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding habit:', error);
    throw error;
  }
}

export async function updateHabit(
  id: number,
  name: string,
  time?: string,
  daysOfWeek?: string,
  goalId?: number
) {
  if (!db) return;
  try {
    const result = await db.run(
      `UPDATE habit SET name = ?, time = ?, days_of_week = ?, goal_id = ? WHERE id = ?;`,
      [name, time ?? null, daysOfWeek ?? null, goalId ?? null, id]
    );
    return result;
  } catch (error) {
    console.error('Error updating habit:', error);
    throw error;
  }
}

export async function getRecentHabitLogs(habitId: number, days: number) {
  if (!db) return [] as { date: string; completed: number }[];
  const result = await db.query(
    `SELECT date, completed FROM habit_log
     WHERE habit_id = ? AND date >= date('now', ?)
     ORDER BY date DESC;`,
    [habitId, `-${days} days`]
  );
  return (result.values ?? []) as { date: string; completed: number }[];
}

// Habits scheduled on specific weekdays (days_of_week = comma-separated 0-6,
// Sunday = 0) are only returned for matching dates; NULL/empty = every day.
export async function getHabitsWithStatus(date: string) {
  if (!db) return [];
  const result = await db.query(
    `SELECT h.*, COALESCE(hl.completed, 0) AS completed
     FROM habit h
     LEFT JOIN habit_log hl
       ON hl.habit_id = h.id AND hl.date = ?
     WHERE h.days_of_week IS NULL
        OR h.days_of_week = ''
        OR instr(',' || h.days_of_week || ',', ',' || strftime('%w', ?) || ',') > 0
     ORDER BY h.created_at DESC;`,
    [date, date]
  );
  return result.values || [];
}

export async function getAllHabits() {
  if (!db) return [];
  const result = await db.query(`SELECT * FROM habit ORDER BY created_at DESC;`);
  return result.values || [];
}

export async function toggleHabitCompletion(habitId: number, date: string, completed: boolean) {
  if (!db) return;
  try {
    const prev = await db.query(
      `SELECT completed FROM habit_log WHERE habit_id = ? AND date = ?;`,
      [habitId, date]
    );
    const prevDone = Number(prev.values?.[0]?.completed ?? 0) === 1;

    const result = await db.run(
      `INSERT INTO habit_log (habit_id, date, completed)
       VALUES (?, ?, ?)
       ON CONFLICT(habit_id, date) DO UPDATE SET completed = excluded.completed;`,
      [habitId, date, completed ? 1 : 0]
    );

    // Habit-goal link: a real state change moves the linked goal's progress.
    if (prevDone !== completed) {
      const habitRow = await db.query(`SELECT goal_id FROM habit WHERE id = ?;`, [habitId]);
      const goalId = habitRow.values?.[0]?.goal_id;
      if (goalId !== null && goalId !== undefined) {
        await incrementGoalProgressBy(Number(goalId), completed ? 1 : -1);
      }
    }
    return result;
  } catch (error) {
    console.error('Error updating habit log:', error);
    throw error;
  }
}

export async function addGoal(name: string, targetValue: number, dueDate?: string) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO goal (name, target_value, due_date) VALUES (?, ?, ?);`,
      [name, targetValue, dueDate ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding goal:', error);
    throw error;
  }
}

export async function getGoals() {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM goal ORDER BY COALESCE(due_date, '') DESC, created_at DESC;`
  );
  return result.values || [];
}

export async function updateGoalProgress(goalId: number, currentValue: number, status?: string) {
  if (!db) return;
  try {
    const result = await db.run(
      `UPDATE goal SET current_value = ?, status = COALESCE(?, status) WHERE id = ?;`,
      [currentValue, status ?? null, goalId]
    );
    return result;
  } catch (error) {
    console.error('Error updating goal progress:', error);
    throw error;
  }
}

// Used by habit-goal linking: each completed habit log nudges the linked goal.
export async function incrementGoalProgressBy(goalId: number, delta: number) {
  if (!db) return;
  try {
    const result = await db.run(
      `UPDATE goal SET current_value = MAX(0, COALESCE(current_value, 0) + ?) WHERE id = ?;`,
      [delta, goalId]
    );
    return result;
  } catch (error) {
    console.error('Error incrementing goal progress:', error);
    throw error;
  }
}

export async function deleteGoal(id: number) {
  if (!db) return;
  try {
    await db.execute('BEGIN;');
    await db.run(`UPDATE habit SET goal_id = NULL WHERE goal_id = ?;`, [id]);
    await db.run(`DELETE FROM goal WHERE id = ?;`, [id]);
    await db.execute('COMMIT;');
  } catch (e) {
    await db.execute('ROLLBACK;').catch(() => undefined);
    throw e;
  }
}

export async function getGoalDueDatesForMonth(yearMonth: string) {
  if (!db) return [] as string[];
  const result = await db.query(
    `SELECT DISTINCT due_date AS date FROM goal
     WHERE due_date LIKE ? AND status = 'active';`,
    [`${yearMonth}-%`]
  );
  return ((result.values ?? []) as { date: string }[]).map((r) => r.date);
}

export async function addCalendarEvent(
  title: string,
  date: string,
  type: string,
  notes?: string,
  timeStart?: string,
  timeEnd?: string,
  workoutTemplateId?: number,
  recurrence?: string,
  endDate?: string
) {
  if (!db) return;
  try {
    // Allowlist event types: each has a defined battery drain rate in calculateBattery.
    // An unknown type would silently fall through to the default 4/hr drain.
    const safeType = ['general', 'workout', 'recovery', 'school', 'sleep', 'reminder'].includes(type)
      ? type
      : 'general';
    const result = await db.run(
      `INSERT INTO calendar_event (title, date, type, notes, time_start, time_end, workout_template_id, recurrence, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [title, date, safeType, notes ?? null, timeStart ?? null, timeEnd ?? null, workoutTemplateId ?? null, ['none','daily','weekly'].includes(recurrence ?? '') ? recurrence : 'none', endDate ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding calendar event:', error);
    throw error;
  }
}

export async function getCalendarEventsForDate(date: string) {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM calendar_event
     WHERE (end_date IS NULL OR end_date >= ?)
       AND (date = ?
        OR (recurrence = 'daily' AND date < ?)
        OR (recurrence = 'weekly' AND date < ? AND strftime('%w', date) = strftime('%w', ?)))
     ORDER BY time_start ASC, id DESC;`,
    [date, date, date, date, date]
  );
  return result.values || [];
}

export async function deleteCalendarEvent(id: number) {
  if (!db) return;
  await db.run(`DELETE FROM calendar_event WHERE id = ?;`, [id]);
}

export async function stopCalendarEventAt(id: number, lastDate: string) {
  if (!db) return;
  await db.run(`UPDATE calendar_event SET end_date = ? WHERE id = ?;`, [lastDate, id]);
}

export async function deleteHabit(id: number) {
  if (!db) return;
  await db.run(`DELETE FROM habit WHERE id = ?;`, [id]);
}

export async function getCalendarEventDatesForMonth(yearMonth: string) {
  if (!db) return [] as string[];
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthEnd = `${yearMonth}-${String(daysInMonth).padStart(2, '0')}`;

  // Non-recurring events within the month
  const exactResult = await db.query(
    `SELECT DISTINCT date FROM calendar_event WHERE date LIKE ? AND (recurrence IS NULL OR recurrence = 'none');`,
    [`${yearMonth}-%`]
  );
  const dates = new Set<string>(
    ((exactResult.values ?? []) as { date: string }[]).map((r) => r.date)
  );

  const monthStart = `${yearMonth}-01`;

  // Recurring events that started on or before month end and haven't ended before month start
  const recurResult = await db.query(
    `SELECT date, recurrence, end_date FROM calendar_event WHERE recurrence != 'none' AND recurrence IS NOT NULL AND date <= ? AND (end_date IS NULL OR end_date >= ?);`,
    [monthEnd, monthStart]
  );
  for (const row of (recurResult.values ?? []) as { date: string; recurrence: string; end_date: string | null }[]) {
    const startDow = new Date(row.date + 'T12:00:00').getDay();
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearMonth}-${String(d).padStart(2, '0')}`;
      if (dateStr < row.date) continue; // before this event's start
      if (row.end_date && dateStr > row.end_date) continue; // after end date
      if (row.recurrence === 'daily') {
        dates.add(dateStr);
      } else if (row.recurrence === 'weekly') {
        const dow = new Date(dateStr + 'T12:00:00').getDay();
        if (dow === startDow) dates.add(dateStr);
      }
    }
  }
  return [...dates];
}

export async function queryReadinessHistory(days = 14): Promise<{ date: string; score: number }[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT date, score FROM readiness_score
     WHERE date >= date('now', ?)
     ORDER BY date ASC;`,
    [`-${days} days`]
  );
  return ((result.values ?? []) as { date: string; score: number }[]);
}

export async function getWeeklyDigest(): Promise<{
  avgSleep: number | null;
  avgSteps: number | null;
  avgReadiness: number | null;
  workoutCount: number;
  readinessTrend: number | null;
}> {
  if (!db) return { avgSleep: null, avgSteps: null, avgReadiness: null, workoutCount: 0, readinessTrend: null };

  const [sleepR, stepsR, readinessR, prevReadinessR, workoutsR] = await Promise.all([
    db.query(`SELECT AVG(value) AS v FROM health_metric WHERE type = 'sleep_duration' AND date >= date('now','-7 days');`),
    db.query(`SELECT AVG(value) AS v FROM health_metric WHERE type = 'steps' AND date >= date('now','-7 days');`),
    db.query(`SELECT AVG(score) AS v FROM readiness_score WHERE date >= date('now','-7 days');`),
    db.query(`SELECT AVG(score) AS v FROM readiness_score WHERE date >= date('now','-14 days') AND date < date('now','-7 days');`),
    db.query(`SELECT COUNT(*) AS v FROM workout WHERE time_end IS NOT NULL AND date(time_start) >= date('now','-7 days');`),
  ]);

  const avg = (r: any) => { const v = r.values?.[0]?.v; return v !== null && v !== undefined ? Number(v) : null; };
  const thisReadiness = avg(readinessR);
  const prevReadiness = avg(prevReadinessR);

  return {
    avgSleep: avg(sleepR),
    avgSteps: avg(stepsR),
    avgReadiness: thisReadiness,
    workoutCount: Number(workoutsR.values?.[0]?.v ?? 0),
    readinessTrend: thisReadiness !== null && prevReadiness !== null ? Math.round(thisReadiness - prevReadiness) : null,
  };
}

export async function getHabitCompletedDatesForMonth(yearMonth: string) {
  if (!db) return [] as string[];
  const result = await db.query(
    `SELECT DISTINCT date FROM habit_log WHERE date LIKE ? AND completed = 1;`,
    [`${yearMonth}-%`]
  );
  return ((result.values ?? []) as { date: string }[]).map((r) => r.date);
}

// Single query powering streaks, week strip, and consistency heatmap.
export async function getHabitLogsForRange(startDate: string, endDate: string) {
  if (!db) return [] as { habit_id: number; date: string; completed: number }[];
  const result = await db.query(
    `SELECT habit_id, date, completed FROM habit_log
     WHERE date >= ? AND date <= ?
     ORDER BY date ASC;`,
    [startDate, endDate]
  );
  return (result.values ?? []) as { habit_id: number; date: string; completed: number }[];
}

// finance functions
export async function addFinanceAccount(name: string, type: string, institution: string | null, balance: number) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_account (name, type, institution, balance)
       VALUES (?, ?, ?, ?);`,
      [name, type, institution, balance]
    );
    return result;
  } catch (error) {
    console.error('Error adding finance account:', error);
    throw error;
  }
}

export async function getFinanceAccounts() {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM finance_account ORDER BY updated_at DESC;`
  );
  return result.values || [];
}

export async function addFinanceInvestment(
  name: string,
  type: string,
  quantity: number,
  value: number,
  accountId?: number | null
) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_investment (name, type, quantity, value, account_id)
       VALUES (?, ?, ?, ?, ?);`,
      [name, type, quantity, value, accountId ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding investment:', error);
    throw error;
  }
}

export async function getFinanceInvestments() {
  if (!db) return [];
  const result = await db.query(
    `SELECT i.*, a.name AS account_name
     FROM finance_investment i
     LEFT JOIN finance_account a ON a.id = i.account_id
     ORDER BY i.updated_at DESC;`
  );
  return result.values || [];
}

export async function addFinanceSubscription(
  name: string,
  amount: number,
  cadence: string,
  nextDueDate?: string,
  accountId?: number | null
) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_subscription (name, amount, cadence, next_due_date, account_id)
       VALUES (?, ?, ?, ?, ?);`,
      [name, amount, cadence, nextDueDate ?? null, accountId ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding subscription:', error);
    throw error;
  }
}

export async function getFinanceSubscriptions() {
  if (!db) return [];
  const result = await db.query(
    `SELECT s.*, a.name AS account_name
     FROM finance_subscription s
     LEFT JOIN finance_account a ON a.id = s.account_id
     ORDER BY s.status DESC, s.next_due_date ASC;`
  );
  return result.values || [];
}

export async function addFinanceTransaction(
  date: string,
  name: string,
  category: string,
  amount: number,
  type: 'expense' | 'income',
  notes?: string
) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_transaction (date, name, category, amount, type, notes)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [date, name, category, amount, type, notes ?? null]
    );
    return result;
  } catch (error) {
    console.error('Error adding finance transaction:', error);
    throw error;
  }
}

export async function getFinanceTransactionsForMonth(monthKey: string) {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM finance_transaction
     WHERE strftime('%Y-%m', date) = ?
     ORDER BY date DESC, id DESC;`,
    [monthKey]
  );
  return result.values || [];
}

export async function deleteFinanceTransaction(id: number) {
  if (!db) return;
  try {
    await db.run(`DELETE FROM finance_transaction WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('Error deleting finance transaction:', error);
    throw error;
  }
}

export async function upsertFinanceBudget(category: string, monthlyLimit: number) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_budget (category, monthly_limit)
       VALUES (?, ?)
       ON CONFLICT(category) DO UPDATE SET monthly_limit = excluded.monthly_limit;`,
      [category, monthlyLimit]
    );
    return result;
  } catch (error) {
    console.error('Error upserting finance budget:', error);
    throw error;
  }
}

export async function getFinanceBudgets() {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM finance_budget ORDER BY monthly_limit DESC, category ASC;`
  );
  return result.values || [];
}

export async function deleteFinanceBudget(id: number) {
  if (!db) return;
  try {
    await db.run(`DELETE FROM finance_budget WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('Error deleting finance budget:', error);
    throw error;
  }
}

export async function exportDatabaseToSQL() {
  if (!db) return null;

  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const lines: string[] = [
    '-- Fitness App SQL data-only backup',
    '-- Generated by exportDatabaseToSQL() (no schema)',
    'PRAGMA foreign_keys = OFF;',
    'BEGIN TRANSACTION;',
    ''
  ];

  for (const table of EXPORT_DELETE_TABLES) {
    lines.push(`DELETE FROM "${table}";`);
  }

  lines.push('');

  for (const table of EXPORT_INSERT_TABLES) {

    const columnResult = await db.query(`PRAGMA table_info("${table}");`);
    const columns = (columnResult.values || []).map((column: any) => String(column.name));
    if (columns.length === 0) {
      lines.push('');
      continue;
    }

    const rowsResult = await db.query(`SELECT * FROM "${table}";`);
    const rows = rowsResult.values || [];
    const quotedColumns = columns.map((column) => `"${column}"`).join(', ');

    for (const row of rows) {
      const values = columns
        .map((column) => toSqlLiteral((row as Record<string, unknown>)[column]))
        .join(', ');
      lines.push(`INSERT INTO "${table}" (${quotedColumns}) VALUES (${values});`);
    }

    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('PRAGMA foreign_keys = ON;');

  return {
    fileName: `fitness-app-backup-${now}.sql`,
    sql: lines.join('\n')
  };
}

export async function importDatabaseFromSQL(sqlContent: string) {
  if (!db) {
    return { success: false, message: 'Database is not initialized.' };
  }

  const normalizedContent = sqlContent?.trim();
  if (!normalizedContent) {
    return { success: false, message: 'The SQL file is empty.' };
  }

  const statements = parseSqlStatements(normalizedContent);
  if (statements.length === 0) {
    return { success: false, message: 'No valid SQL statements found in file.' };
  }

  // Mirror the export lists exactly so import order can never drift from what gets
  // exported. Previously these omitted exercise_pr, sleep_session and body_log, so
  // their DELETE/INSERT statements were parsed but never executed on restore —
  // silently dropping PR, sleep-history and body-weight data.
  const deleteOrder = EXPORT_DELETE_TABLES;
  const insertOrder = EXPORT_INSERT_TABLES;

  const deleteStatementsByTable = new Map<string, string>();
  const insertStatementsByTable = new Map<string, string[]>();
  const passthroughStatements: string[] = [];

  const deleteStatementPattern = /^DELETE\s+FROM\s+"?([A-Za-z_]+)"?$/i;
  const insertStatementPattern = /^INSERT\s+INTO\s+"?([A-Za-z_]+)"?\s*\(/i;

  for (const statement of statements) {
    const normalizedStatement = statement.trim().replace(/;$/, '');

    if (/^PRAGMA\s+foreign_keys\s*=\s*(ON|OFF)$/i.test(normalizedStatement)) {
      continue;
    }

    const deleteMatch = normalizedStatement.match(deleteStatementPattern);
    if (deleteMatch) {
      deleteStatementsByTable.set(deleteMatch[1].toLowerCase(), `${normalizedStatement};`);
      continue;
    }

    const insertMatch = normalizedStatement.match(insertStatementPattern);
    if (insertMatch) {
      const tableName = insertMatch[1].toLowerCase();
      const existingStatements = insertStatementsByTable.get(tableName) || [];
      existingStatements.push(`${normalizedStatement};`);
      insertStatementsByTable.set(tableName, existingStatements);
      continue;
    }

    passthroughStatements.push(`${normalizedStatement};`);
  }

  const isStructuredBackup = deleteStatementsByTable.size > 0 || insertStatementsByTable.size > 0;

  try {
    await db.execute('PRAGMA foreign_keys = OFF;');
    await db.execute('BEGIN TRANSACTION;');

    if (isStructuredBackup) {
      // Known tables first in dependency order, then any unknown tables so a
      // backup from a newer schema never loses statements silently.
      const orderedDeletes = [
        ...deleteOrder,
        ...[...deleteStatementsByTable.keys()].filter((t) => !deleteOrder.includes(t)),
      ];
      for (const table of orderedDeletes) {
        const deleteStatement = deleteStatementsByTable.get(table);
        if (deleteStatement) {
          await db.execute(deleteStatement);
        }
      }

      const orderedInserts = [
        ...insertOrder,
        ...[...insertStatementsByTable.keys()].filter((t) => !insertOrder.includes(t)),
      ];
      for (const table of orderedInserts) {
        const tableStatements = insertStatementsByTable.get(table);
        if (!tableStatements) continue;

        for (const statement of tableStatements) {
          await db.execute(statement);
        }
      }

      for (const statement of passthroughStatements) {
        await db.execute(statement);
      }
    } else {
      for (const statement of statements) {
        await db.execute(`${statement};`);
      }
    }

    await db.execute('COMMIT;');
    await db.execute('PRAGMA foreign_keys = ON;');
    return { success: true, message: 'Data imported successfully.' };
  } catch (error) {
    await db.execute('ROLLBACK;').catch(() => undefined);
    await db.execute('PRAGMA foreign_keys = ON;').catch(() => undefined);
    console.error('Error importing SQL:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to import SQL data: ${errorMessage}` };
  }
}

// ── Body log ──────────────────────────────────────────────────────────────────

export interface BodyLogEntry {
  id: number
  date: string
  weight_kg: number
  notes: string | null
  photo_path: string | null
}

export async function insertBodyLog(entry: {
  date: string
  weight_kg: number
  notes?: string
  photo_path?: string
}): Promise<void> {
  if (!db) return
  await db.run(
    `INSERT INTO body_log (date, weight_kg, notes, photo_path) VALUES (?, ?, ?, ?)`,
    [entry.date, entry.weight_kg, entry.notes ?? null, entry.photo_path ?? null]
  )
}

export async function getBodyLogs(): Promise<BodyLogEntry[]> {
  if (!db) return []
  const result = await db.query(`SELECT * FROM body_log ORDER BY date DESC, id DESC`)
  return result.values ?? []
}

export async function deleteBodyLog(id: number): Promise<void> {
  if (!db) return
  await db.run(`DELETE FROM body_log WHERE id = ?`, [id])
}

// ============ PR & 1RM TRACKING ============

// Calculate 1RM using Epley formula: 1RM = weight × (1 + reps/30)
function calculateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round((weight * (1 + reps / 30)) * 10) / 10;
}

export interface AchievedPR {
  exercise_id: number;
  exercise_name: string;
  pr_weight: number;
  pr_reps: number;
  one_rep_max: number;
  is_new: boolean;
}

// Update or create PR for an exercise after workout completion.
// Returns the PRs that were newly set or improved in this workout.
export async function updateExercisePRs(workoutId: number): Promise<AchievedPR[]> {
  if (!db) return [];

  const achieved: AchievedPR[] = [];

  try {
    // Get all exercises from this workout with their completed sets
    const result = await db.query(`
      SELECT 
        we.exercise_id,
        e.name as exercise_name,
        MAX(wes.weight) as max_weight,
        (SELECT wes2.reps FROM workout_exercise_sets wes2 
         WHERE wes2.workout_exercise_id = we.id 
         AND wes2.weight = MAX(wes.weight) 
         AND wes2.completed = 1 
         LIMIT 1) as reps_at_max_weight
      FROM workout_exercise we
      JOIN exercise e ON e.id = we.exercise_id
      JOIN workout_exercise_sets wes ON wes.workout_exercise_id = we.id
      WHERE we.workout_id = ? AND wes.completed = 1
      GROUP BY we.exercise_id
    `, [workoutId]);

    if (!result.values) return achieved;

    for (const row of result.values) {
      const exerciseId = row.exercise_id;
      const weight = Number(row.max_weight);
      const reps = Number(row.reps_at_max_weight) || 1;
      const oneRepMax = calculateOneRepMax(weight, reps);

      // Check if PR exists
      const existingPR = await db.query(
        'SELECT * FROM exercise_pr WHERE exercise_id = ?',
        [exerciseId]
      );

      if (existingPR.values && existingPR.values.length > 0) {
        const existing = existingPR.values[0];
        // Update if new weight is heavier OR same weight but more reps
        if (weight > existing.pr_weight || 
            (weight === existing.pr_weight && reps > existing.pr_reps)) {
          await db.run(
            `UPDATE exercise_pr SET pr_weight = ?, pr_reps = ?, one_rep_max = ?,
             date_achieved = CURRENT_TIMESTAMP, workout_id = ? WHERE exercise_id = ?`,
            [weight, reps, oneRepMax, workoutId, exerciseId]
          );
          achieved.push({
            exercise_id: exerciseId,
            exercise_name: row.exercise_name,
            pr_weight: weight,
            pr_reps: reps,
            one_rep_max: oneRepMax,
            is_new: false,
          });
        }
      } else {
        // Insert new PR
        await db.run(
          `INSERT INTO exercise_pr (exercise_id, pr_weight, pr_reps, one_rep_max, workout_id)
           VALUES (?, ?, ?, ?, ?)`,
          [exerciseId, weight, reps, oneRepMax, workoutId]
        );
        achieved.push({
          exercise_id: exerciseId,
          exercise_name: row.exercise_name,
          pr_weight: weight,
          pr_reps: reps,
          one_rep_max: oneRepMax,
          is_new: true,
        });
      }
    }
  } catch (error) {
    console.error('Error updating PRs:', error);
  }

  return achieved;
}

// Get current PR for an exercise
export async function getExercisePR(exerciseId: number) {
  if (!db) return null;

  const result = await db.query(
    'SELECT * FROM exercise_pr WHERE exercise_id = ?',
    [exerciseId]
  );

  return result.values?.[0] || null;
}

// Get historical data for an exercise for graphing
export async function getExerciseHistory(exerciseId: number, limitDays: number = 90) {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - limitDays);
  const dateLimit = daysAgo.toISOString().replace('T', ' ').slice(0, 19);

  const result = await db.query(`
    SELECT
      date(wes.created_at, 'localtime') as date,
      MAX(wes.weight) as weight,
      MAX(wes.reps) as reps,
      SUM(wes.weight * wes.reps) as volume
    FROM workout_exercise_sets wes
    JOIN workout_exercise we ON we.id = wes.workout_exercise_id
    WHERE we.exercise_id = ?
      AND wes.completed = 1
      AND wes.created_at >= ?
    GROUP BY date(wes.created_at, 'localtime')
    ORDER BY date ASC
  `, [exerciseId, dateLimit]);

  return result.values || [];
}

// Get all PRs for display
export async function getAllExercisePRs() {
  if (!db) return [];

  const result = await db.query(`
    SELECT 
      ep.*,
      e.name as exercise_name
    FROM exercise_pr ep
    JOIN exercise e ON e.id = ep.exercise_id
    ORDER BY ep.date_achieved DESC
  `);

  return result.values || [];
}

// PRs achieved within the last N days (for the gym home "Recent PRs" card)
export async function getRecentPRs(days = 30) {
  if (!db) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const result = await db.query(`
    SELECT
      ep.*,
      e.name as exercise_name
    FROM exercise_pr ep
    JOIN exercise e ON e.id = ep.exercise_id
    WHERE DATE(ep.date_achieved) >= DATE(?)
    ORDER BY ep.date_achieved DESC
  `, [cutoff.toISOString()]);

  return result.values || [];
}

// Per-workout session summaries for one exercise (recent sessions list)
export async function getExerciseSessions(exerciseId: number, limit = 8) {
  if (!db) return [];

  const result = await db.query(`
    SELECT
      w.id as workout_id,
      w.time_start as date,
      COUNT(*) as set_count,
      MAX(wes.weight) as top_weight,
      MAX(wes.reps) as top_reps,
      SUM(wes.weight * wes.reps) as volume
    FROM workout_exercise_sets wes
    JOIN workout_exercise we ON we.id = wes.workout_exercise_id
    JOIN workout w ON w.id = we.workout_id
    WHERE we.exercise_id = ? AND wes.completed = 1 AND w.time_end IS NOT NULL
    GROUP BY w.id
    ORDER BY w.time_start DESC
    LIMIT ?
  `, [exerciseId, limit]);

  return result.values || [];
}

// Get exercise stats including PR and recent history
export async function getExerciseStats(exerciseId: number) {
  if (!db) return null;

  const pr = await getExercisePR(exerciseId);
  const history = await getExerciseHistory(exerciseId);
  
  const exerciseResult = await db.query(
    'SELECT name FROM exercise WHERE id = ?',
    [exerciseId]
  );

  const exerciseName = exerciseResult.values?.[0]?.name || '';

  return {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    pr,
    history
  };
}

// ── Circadian log ────────────────────────────────────────────────────────────

export interface CircadianLogEntry {
  id?: number;
  date: string;
  day_type: string;        // 'work' | 'free'
  energy_wake: number | null;
  energy_noon: number | null;
  energy_evening: number | null;
  meal_first: string | null;  // HH:MM
  meal_last: string | null;   // HH:MM
  morning_light: number;      // 0 | 1
  notes: string | null;
}

export async function upsertCircadianLog(entry: Omit<CircadianLogEntry, 'id'>) {
  if (!db) return;
  try {
    await db.run(
      `INSERT INTO circadian_log
         (date, day_type, energy_wake, energy_noon, energy_evening,
          meal_first, meal_last, morning_light, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         day_type       = excluded.day_type,
         energy_wake    = excluded.energy_wake,
         energy_noon    = excluded.energy_noon,
         energy_evening = excluded.energy_evening,
         meal_first     = excluded.meal_first,
         meal_last      = excluded.meal_last,
         morning_light  = excluded.morning_light,
         notes          = excluded.notes;`,
      [
        entry.date, entry.day_type,
        entry.energy_wake ?? null, entry.energy_noon ?? null, entry.energy_evening ?? null,
        entry.meal_first ?? null, entry.meal_last ?? null,
        entry.morning_light ? 1 : 0, entry.notes ?? null,
      ]
    );
  } catch (error) {
    console.error('Error upserting circadian log:', error);
    throw error;
  }
}

export async function getCircadianLog(date: string): Promise<CircadianLogEntry | null> {
  if (!db) return null;
  const result = await db.query(
    `SELECT * FROM circadian_log WHERE date = ?;`, [date]
  );
  return ((result.values ?? []) as CircadianLogEntry[])[0] ?? null;
}

export async function getRecentCircadianLogs(days = 30): Promise<CircadianLogEntry[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM circadian_log WHERE date >= date('now', ?) ORDER BY date DESC;`,
    [`-${days} days`]
  );
  return (result.values ?? []) as CircadianLogEntry[];
}
