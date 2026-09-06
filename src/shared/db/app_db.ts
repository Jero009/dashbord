import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { SQLiteDBConnection, SQLiteConnection as SQLiteConnType } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { localDateISO } from '@/shared/utils/timeFormat';
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
  'body_log',
  'finance_subscription',
  'finance_investment',
  'finance_transaction',
  'finance_budget',
  'finance_account',
  'net_worth_snapshot',
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
  'body_log',
  'finance_account',
  'finance_investment',
  'finance_subscription',
  'finance_budget',
  'finance_transaction',
  'net_worth_snapshot',
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
    // The native CapacitorSQLite plugin keeps its connection pool alive across
    // WebView reloads / app resumes, but the JS `db` ref is reset to null on
    // each fresh script load. Calling createConnection again then throws
    // "Connection workout_db already exists" and init fails. Reuse the existing
    // native connection when present instead of recreating it.
    const isConn = (await sqlite.isConnection('workout_db', false)).result;
    if (isConn) {
      db = await sqlite.retrieveConnection('workout_db', false);
    } else {
      // @ts-expect-error - SQLite connection type mismatch
      db = await sqlite.createConnection('workout_db', false, 'no-encryption', 1);
    }

    if (!(await db.isDBOpen()).result) {
      await db.open();
    }

    await db.execute(`PRAGMA foreign_keys = ON;`);

    await db.execute(`
  CREATE TABLE IF NOT EXISTS workout_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    archived INTEGER DEFAULT 0,
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
    cost_basis REAL DEFAULT 0,
    symbol TEXT,
    last_price REAL,
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
    direction TEXT DEFAULT 'expense',
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
    photo_path TEXT,
    waist_cm REAL,
    chest_cm REAL,
    hips_cm REAL,
    arm_cm REAL,
    thigh_cm REAL,
    body_fat_pct REAL
  );
  
  INSERT OR IGNORE INTO muscle_group (name) VALUES
    ('chest'),
    ('back'),
    ('legs'),
    ('shoulders'),
    ('arms'),
    ('core'),
    ('triceps');

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

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Barbell Curl', 5, 1, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Barbell Curl'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Preacher Curl Barbell', 5, 1, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Preacher Curl Barbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Skull Crusher Dumbbell', (SELECT id FROM muscle_group WHERE name = 'triceps'), 2, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Skull Crusher Dumbbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Close Grip Dumbbell Press', (SELECT id FROM muscle_group WHERE name = 'triceps'), 2, 90
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Close Grip Dumbbell Press'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Overhead Barbell Extension', (SELECT id FROM muscle_group WHERE name = 'triceps'), 1, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Overhead Barbell Extension'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Reverse Curl Dumbbell', 5, 2, 60
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Reverse Curl Dumbbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Wrist Curl Barbell', 5, 1, 45
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Wrist Curl Barbell'));

  INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
  SELECT 'Wrist Curl Dumbbell', 5, 2, 45
  WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower('Wrist Curl Dumbbell'));

  UPDATE exercise
  SET id_muscle_group = (SELECT id FROM muscle_group WHERE name = 'triceps')
  WHERE id_muscle_group = (SELECT id FROM muscle_group WHERE name = 'arms')
    AND lower(name) IN (
      'tricep pushdown',
      'dips',
      'skull crusher',
      'close grip bench press',
      'overhead dumbbell extension',
      'triceps extension cable'
    );

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

    // Session RPE (1–10) for sRPE training-load tracking. Nullable — older
    // workouts and skipped prompts leave it NULL and fall back to volume load.
    const hasSessionRpeColumn = (workoutColumns.values || []).some(
      (column: any) => String(column.name) === 'session_rpe'
    );
    if (!hasSessionRpeColumn) {
      await db.execute(`ALTER TABLE workout ADD COLUMN session_rpe REAL;`);
    }

    // Archive flag for templates (so old defaults can be hidden from the gym
    // homepage / recommendations without deleting them).
    const tplColumns = await db.query(`PRAGMA table_info("workout_template");`);
    const hasArchivedColumn = (tplColumns.values || []).some(
      (column: any) => String(column.name) === 'archived'
    );
    if (!hasArchivedColumn) {
      await db.execute(`ALTER TABLE workout_template ADD COLUMN archived INTEGER DEFAULT 0;`);
    }

    // Enforce case-insensitive unique template names. SQLite only applies UNIQUE
    // at table creation, so rebuild the table if the constraint is missing,
    // renaming existing duplicates to 'Name (2)' before copying.
    {
      const tplIndexes = await db.query(`PRAGMA index_list('workout_template');`);
      const hasUniqueName = (tplIndexes.values || []).some((idx: any) => {
        if (!idx.unique) return false;
        // idx.origin 'u' = UNIQUE constraint, 'c' = CREATE INDEX
        return true;
      });
      if (!hasUniqueName) {
        // Rename duplicate names (case-insensitive) keeping the oldest row's name.
        await db.execute(`
          UPDATE workout_template
          SET name = name || ' (' || id || ')'
          WHERE id NOT IN (
            SELECT MIN(id) FROM workout_template GROUP BY lower(name)
          );
        `);
        await db.execute(`
          CREATE TABLE workout_template_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE COLLATE NOCASE,
            archived INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await db.execute(`
          INSERT INTO workout_template_new (id, name, archived, created_at)
          SELECT id, name, archived, created_at FROM workout_template;
        `);
        await db.execute(`DROP TABLE workout_template;`);
        await db.execute(`ALTER TABLE workout_template_new RENAME TO workout_template;`);
      }
    }

    // Seed the 4-day PPL split (Push/Pull A heavy, Push/Pull B hypertrophy/volume).
    await seedPplSplitTemplates();

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
        score INTEGER,
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

    const subColumns = await db.query(`PRAGMA table_info("finance_subscription");`);
    const subColNames = new Set((subColumns.values || []).map((c: any) => String(c.name)));
    if (!subColNames.has('account_id')) {
      await db.execute(`ALTER TABLE finance_subscription ADD COLUMN account_id INTEGER;`);
    }
    if (!subColNames.has('direction')) {
      await db.execute(`ALTER TABLE finance_subscription ADD COLUMN direction TEXT DEFAULT 'expense';`);
    }
    if (!subColNames.has('status')) {
      await db.execute(`ALTER TABLE finance_subscription ADD COLUMN status TEXT DEFAULT 'active';`);
    }

    const invColumns = await db.query(`PRAGMA table_info("finance_investment");`);
    const invColNames = new Set((invColumns.values || []).map((c: any) => String(c.name)));
    if (!invColNames.has('account_id')) {
      await db.execute(`ALTER TABLE finance_investment ADD COLUMN account_id INTEGER;`);
    }
    if (!invColNames.has('cost_basis')) {
      await db.execute(`ALTER TABLE finance_investment ADD COLUMN cost_basis REAL DEFAULT 0;`);
    }
    if (!invColNames.has('symbol')) {
      await db.execute(`ALTER TABLE finance_investment ADD COLUMN symbol TEXT;`);
    }
    if (!invColNames.has('last_price')) {
      await db.execute(`ALTER TABLE finance_investment ADD COLUMN last_price REAL;`);
    }

    const bodyColumns = await db.query(`PRAGMA table_info("body_log");`);
    const bodyColNames = new Set((bodyColumns.values || []).map((c: any) => String(c.name)));
    for (const col of ['waist_cm', 'chest_cm', 'hips_cm', 'arm_cm', 'thigh_cm', 'body_fat_pct']) {
      if (!bodyColNames.has(col)) {
        await db.execute(`ALTER TABLE body_log ADD COLUMN ${col} REAL;`);
      }
    }

    const sleepColumns = await db.query(`PRAGMA table_info("sleep_session");`);
    const sleepColNames = new Set((sleepColumns.values || []).map((c: any) => String(c.name)));
    for (const [col, def] of [
      ['stage_deep_min',      'INTEGER DEFAULT 0'],
      ['stage_light_min',     'INTEGER DEFAULT 0'],
      ['stage_rem_min',       'INTEGER DEFAULT 0'],
      ['stage_awake_min',     'INTEGER DEFAULT 0'],
      ['stage_asleep_min',    'INTEGER DEFAULT 0'],
      ['hr_timeline_json',    'TEXT'],
      ['stage_timeline_json', 'TEXT'],
      ['source',              "TEXT DEFAULT 'health-connect'"],
    ] as [string, string][]) {
      if (!sleepColNames.has(col)) {
        await db.execute(`ALTER TABLE sleep_session ADD COLUMN ${col} ${def};`);
      }
    }

    const setColumns = await db.query(`PRAGMA table_info("workout_exercise_sets");`);
    const setColNames = new Set((setColumns.values || []).map((c: any) => String(c.name)));
    if (!setColNames.has('rpe')) {
      await db.execute(`ALTER TABLE workout_exercise_sets ADD COLUMN rpe INTEGER;`);
    }

    const tplExColumns = await db.query(`PRAGMA table_info("workout_template_exercise");`);
    const tplExColNames = new Set((tplExColumns.values || []).map((c: any) => String(c.name)));
    if (!tplExColNames.has('rpe')) {
      await db.execute(`ALTER TABLE workout_template_exercise ADD COLUMN rpe INTEGER;`);
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


// Exercises referenced by the PPL split that aren't in the base seed.
const PPL_NEW_EXERCISES: { name: string; mg: number; eq: number; rest: number }[] = [
  { name: 'Incline Dumbbell Curl', mg: 5, eq: 2, rest: 75 }, // arms / dumbbell
  { name: 'Chest Supported Row', mg: 2, eq: 3, rest: 90 },   // back / machine
  { name: 'Straight Arm Pulldown', mg: 2, eq: 5, rest: 75 }, // back / cables
];

// 4-day Push/Pull split seeded as default templates. set/rep use the midpoint of
// the prescribed range (the schema stores a single set + rep number per exercise).
const PPL_TEMPLATES: { name: string; exercises: { name: string; sets: number; reps: number }[] }[] = [
  { name: 'PUSH A (HEAVY)', exercises: [
    { name: 'Bench Press', sets: 4, reps: 5 },
    { name: 'Overhead Press', sets: 4, reps: 5 },
    { name: 'Incline Dumbbell Press', sets: 3, reps: 9 },
    { name: 'Chest Dips', sets: 3, reps: 7 },
    { name: 'Cable Lateral Raise', sets: 3, reps: 13 },
    { name: 'Overhead Dumbbell Extension', sets: 3, reps: 11 },
  ] },
  { name: 'PULL A (HEAVY)', exercises: [
    { name: 'Bent Over Row', sets: 4, reps: 7 },
    { name: 'Pull-Up', sets: 3, reps: 8 },
    { name: 'Seated Cable Row', sets: 3, reps: 11 },
    { name: 'Face Pull', sets: 3, reps: 17 },
    { name: 'Reverse Fly Machine', sets: 3, reps: 13 },
    { name: 'Incline Dumbbell Curl', sets: 3, reps: 10 },
  ] },
  { name: 'PUSH B (HYPERTROPHY)', exercises: [
    { name: 'Incline Barbell Bench Press', sets: 4, reps: 9 },
    { name: 'Bench Press Dumbbell', sets: 3, reps: 11 },
    { name: 'Overhead Press', sets: 3, reps: 9 },
    { name: 'Cable Crossover', sets: 3, reps: 13 },
    { name: 'Lateral Raise', sets: 4, reps: 15 },
    { name: 'Tricep Pushdown', sets: 2, reps: 13 },
  ] },
  { name: 'PULL B (VOLUME)', exercises: [
    { name: 'Lat Pulldown', sets: 4, reps: 11 },
    { name: 'Chest Supported Row', sets: 3, reps: 11 },
    { name: 'Straight Arm Pulldown', sets: 3, reps: 13 },
    { name: 'Lateral Raise', sets: 3, reps: 17 },
    { name: 'Reverse Fly', sets: 3, reps: 17 },
    { name: 'EZ Bar Curl', sets: 3, reps: 10 },
  ] },
];

// Idempotent: only inserts exercises/templates/rows that don't already exist
// (matched case-insensitively by name), so it's safe to run on every init.
async function seedPplSplitTemplates() {
  if (!db) return;

  for (const ex of PPL_NEW_EXERCISES) {
    await db.run(
      `INSERT INTO exercise (name, id_muscle_group, id_equipment, rest_seconds)
       SELECT ?, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM exercise WHERE lower(name) = lower(?));`,
      [ex.name, ex.mg, ex.eq, ex.rest, ex.name]
    );
  }

  for (const tpl of PPL_TEMPLATES) {
    await db.run(
      `INSERT INTO workout_template (name)
       SELECT ?
       WHERE NOT EXISTS (SELECT 1 FROM workout_template WHERE lower(name) = lower(?));`,
      [tpl.name, tpl.name]
    );
    const r = await db.query(
      `SELECT id FROM workout_template WHERE lower(name) = lower(?) LIMIT 1;`,
      [tpl.name]
    );
    const tplId = r.values?.[0]?.id as number | undefined;
    if (!tplId) continue;

    let order = 1;
    for (const ex of tpl.exercises) {
      await db.run(
        `INSERT INTO workout_template_exercise
           (id_workout_template, id_exercise, set_number, rep_number, order_index)
         SELECT ?, e.id, ?, ?, ?
         FROM exercise e
         WHERE lower(e.name) = lower(?)
           AND NOT EXISTS (
             SELECT 1 FROM workout_template_exercise wte
             WHERE wte.id_workout_template = ? AND wte.id_exercise = e.id
           );`,
        [tplId, ex.sets, ex.reps, order, ex.name, tplId]
      );
      order++;
    }
  }
}

export async function createTemplate(name: string) {
  if (!db) return;

  try {
    const dup = await db.query(
      `SELECT id FROM workout_template WHERE lower(name) = lower(?) LIMIT 1;`,
      [name]
    );
    if (dup.values && dup.values.length > 0) {
      throw new Error('A template with this name already exists');
    }

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
  orderIndex: number,
  rpe?: number | null
) {
  if (!db) return;

  try {
    const result = await db.run(
      `INSERT INTO workout_template_exercise
       (id_workout_template, id_exercise, set_number, rep_number, order_index, rpe)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [templateId, exerciseId, setNumber, repNumber, orderIndex, rpe ?? null]
    );

    return result;
  } catch (error) {
    console.error('Error adding exercise to template:', error);
    throw error;
  }
}
// By default excludes archived templates (so they don't show on the gym homepage
// or get recommended). Pass includeArchived=true for the management screen.
export async function getTemplates(includeArchived = false) {
  if (!db) return [];
  const result = await db.query(
    includeArchived
      ? 'SELECT * FROM workout_template ORDER BY archived ASC, id ASC;'
      : 'SELECT * FROM workout_template WHERE COALESCE(archived, 0) = 0 ORDER BY id ASC;'
  );
  return result.values || [];
}

export async function setTemplateArchived(id: number, archived: boolean) {
  if (!db) return;
  await db.run(`UPDATE workout_template SET archived = ? WHERE id = ?;`, [archived ? 1 : 0, id]);
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
      wte.order_index,
      wte.rpe
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
  const conn = db;

  try {
    const template = await getTemplateById(templateId);
    const result = await conn.run(
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
      const resultWE = await conn.run(
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

        await conn.run(
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
    `SELECT wes.set_number, wes.reps, wes.weight, wes.rpe
     FROM workout_exercise_sets wes
     JOIN workout_exercise we ON we.id = wes.workout_exercise_id
     WHERE we.workout_id = ?
       AND we.exercise_id = ?
       AND wes.completed = 1
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
    SELECT id, set_number, reps, weight, completed, rpe FROM workout_exercise_sets
    WHERE workout_exercise_id = ?
    ORDER BY set_number
  `, [workoutExerciseId]);

  return result.values || [];
}

// saving workout

export async function updateWorkoutSet(id: number, reps: number, weight: number, completed: boolean, rpe?: number | null) {
  if (!db) return;

  const result = await db.run(
    'UPDATE workout_exercise_sets SET reps = ?, weight = ?, completed = ?, rpe = ? WHERE id = ?',
    [reps, weight, completed ? 1 : 0, rpe ?? null, id]
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
        MAX(wes.reps) as reps,
        ROUND(AVG(CASE WHEN wes.completed = 1 AND wes.rpe IS NOT NULL THEN wes.rpe END), 1) as avg_rpe
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
  const today = localDateISO(now);
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
  const conn = db;

  try {
    // Insert the exercise into workout_exercise
    const resultWE = await conn.run(
      `INSERT INTO workout_exercise (workout_id, exercise_id, order_index) VALUES (?, ?, ?)`,
      [workoutId, exerciseId, orderIndex]
    );
    const workoutExerciseId = resultWE.changes?.lastId;

    const previousSets = await getLatestCompletedSetsForExercise(exerciseId, workoutId);

    if (previousSets.length > 0) {
      for (let i = 0; i < previousSets.length; i++) {
        await conn.run(
          'INSERT INTO workout_exercise_sets (workout_exercise_id, set_number, reps, weight) VALUES (?, ?, ?, ?)',
          [workoutExerciseId, i + 1, previousSets[i].reps, previousSets[i].weight]
        );
      }
    } else {
      // Insert the initial set(s) into workout_exercise_sets using defaults
      for (let i = 0; i < defaultSetNumber; i++) {
        await conn.run(
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
  weight: number = 0,
  rpe?: number | null
) {
  if (!db) return;

  try {
    const result = await db.run(
      'INSERT INTO workout_exercise_sets (workout_exercise_id, set_number, reps, weight, rpe) VALUES (?, ?, ?, ?, ?)',
      [workoutExerciseId, setNumber, repNumber, weight, rpe ?? null]
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
  orderIndex: number,
  rpe?: number | null
) {
  if (!db) return;

  const result = await db.run(
    `UPDATE workout_template_exercise
     SET set_number = ?, rep_number = ?, order_index = ?, rpe = ?
     WHERE id = ?`,
    [setNumber, repNumber, orderIndex, rpe ?? null, rowId]
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
  if (!db) return null;
  const result = await db.query('SELECT * FROM workout_template WHERE id = ?', [templateId]);
  return result.values?.[0] || null;
}

export async function getTemplateExercisesByTemplateId(templateId: number) {
  if (!db) return [];
  const result = await db.query(`
    SELECT
      wte.id,
      e.name,
      wte.id_exercise,
      wte.set_number,
      wte.rep_number,
      wte.order_index,
      wte.rpe
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

export interface ReviewDigest {
  period: 'week' | 'month';
  workoutCount: number;
  totalVolume: number;
  avgSleepScore: number | null;
  avgReadiness: number | null;
  readinessTrend: number | null;
  netWorthDelta: number | null;
  spent: number;
  budget: number | null;           // monthly budget total, prorated to the period
}

// Cross-domain summary for the Review page (and HomePage "This Week" card).
export async function getReviewDigest(period: 'week' | 'month' = 'week'): Promise<ReviewDigest> {
  const days = period === 'month' ? 30 : 7;
  const empty: ReviewDigest = {
    period, workoutCount: 0, totalVolume: 0, avgSleepScore: null, avgReadiness: null,
    readinessTrend: null, netWorthDelta: null, spent: 0, budget: null,
  };
  if (!db) return empty;

  const since = `-${days} days`;
  const prevSince = `-${days * 2} days`;

  const [
    workoutsR, volumeR, sleepR, readinessR, prevReadinessR,
    spentR, budgetR, netNowR, netThenR,
  ] = await Promise.all([
    db.query(`SELECT COUNT(*) AS v FROM workout WHERE time_end IS NOT NULL AND date(time_start, 'localtime') >= date('now', ?, 'localtime');`, [since]),
    db.query(`SELECT SUM(weight * reps) AS v FROM workout_exercise_sets WHERE completed = 1 AND date(created_at, 'localtime') >= date('now', ?, 'localtime');`, [since]),
    db.query(`SELECT AVG(score) AS v FROM sleep_session WHERE score IS NOT NULL AND date >= date('now', ?);`, [since]),
    db.query(`SELECT AVG(score) AS v FROM readiness_score WHERE date >= date('now', ?);`, [since]),
    db.query(`SELECT AVG(score) AS v FROM readiness_score WHERE date >= date('now', ?) AND date < date('now', ?);`, [prevSince, since]),
    db.query(`SELECT SUM(amount) AS v FROM finance_transaction WHERE type = 'expense' AND date >= date('now', ?);`, [since]),
    db.query(`SELECT SUM(monthly_limit) AS v FROM finance_budget;`),
    db.query(`SELECT (total_assets - total_liabilities) AS v FROM net_worth_snapshot ORDER BY date DESC LIMIT 1;`),
    db.query(`SELECT (total_assets - total_liabilities) AS v FROM net_worth_snapshot WHERE date <= date('now', ?) ORDER BY date DESC LIMIT 1;`, [since]),
  ]);

  const num = (r: any, key = 'v') => {
    const v = r.values?.[0]?.[key];
    return v !== null && v !== undefined ? Number(v) : null;
  };

  const thisReadiness = num(readinessR);
  const prevReadiness = num(prevReadinessR);
  const netNow = num(netNowR);
  const netThen = num(netThenR);
  const monthlyBudget = num(budgetR);

  return {
    period,
    workoutCount: Number(workoutsR.values?.[0]?.v ?? 0),
    totalVolume: Math.round(num(volumeR) ?? 0),
    avgSleepScore: sleepR.values?.[0]?.v != null ? Math.round(num(sleepR)!) : null,
    avgReadiness: thisReadiness !== null ? Math.round(thisReadiness) : null,
    readinessTrend: thisReadiness !== null && prevReadiness !== null ? Math.round(thisReadiness - prevReadiness) : null,
    netWorthDelta: netNow !== null && netThen !== null ? Math.round((netNow - netThen) * 100) / 100 : null,
    spent: Math.round((num(spentR) ?? 0) * 100) / 100,
    budget: monthlyBudget !== null ? Math.round((monthlyBudget * days / 30) * 100) / 100 : null,
  };
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

export async function updateFinanceAccount(
  id: number,
  name: string,
  type: string,
  institution: string | null,
  balance: number
) {
  if (!db) return;
  try {
    await db.run(
      `UPDATE finance_account
       SET name = ?, type = ?, institution = ?, balance = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [name, type, institution, balance, id]
    );
  } catch (error) {
    console.error('Error updating finance account:', error);
    throw error;
  }
}

// Deleting an account leaves its linked investments/subscriptions intact; their
// account_id is cleared so the LEFT JOINs simply show "no account".
export async function deleteFinanceAccount(id: number) {
  if (!db) return;
  try {
    await db.run(`UPDATE finance_investment SET account_id = NULL WHERE account_id = ?;`, [id]);
    await db.run(`UPDATE finance_subscription SET account_id = NULL WHERE account_id = ?;`, [id]);
    await db.run(`DELETE FROM finance_account WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('Error deleting finance account:', error);
    throw error;
  }
}

export async function addFinanceInvestment(
  name: string,
  type: string,
  quantity: number,
  value: number,
  accountId?: number | null,
  costBasis = 0,
  symbol: string | null = null
) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_investment (name, type, quantity, value, cost_basis, account_id, symbol)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [name, type, quantity, value, costBasis, accountId ?? null, symbol]
    );
    return result;
  } catch (error) {
    console.error('Error adding investment:', error);
    throw error;
  }
}

export async function updateFinanceInvestment(
  id: number,
  name: string,
  type: string,
  quantity: number,
  value: number,
  accountId?: number | null,
  costBasis = 0,
  symbol: string | null = null
) {
  if (!db) return;
  try {
    await db.run(
      `UPDATE finance_investment
       SET name = ?, type = ?, quantity = ?, value = ?, cost_basis = ?, account_id = ?, symbol = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [name, type, quantity, value, costBasis, accountId ?? null, symbol, id]
    );
  } catch (error) {
    console.error('Error updating investment:', error);
    throw error;
  }
}

// Lightweight updater used by the live-price refresh: recompute the holding's
// market value (quantity × live price) without touching its other fields.
export async function updateInvestmentPrice(id: number, value: number, lastPrice: number) {
  if (!db) return;
  try {
    await db.run(
      `UPDATE finance_investment
       SET value = ?, last_price = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?;`,
      [value, lastPrice, id]
    );
  } catch (error) {
    console.error('Error updating investment price:', error);
    throw error;
  }
}

export async function deleteFinanceInvestment(id: number) {
  if (!db) return;
  try {
    await db.run(`DELETE FROM finance_investment WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('Error deleting investment:', error);
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
  accountId?: number | null,
  direction: 'expense' | 'income' = 'expense'
) {
  if (!db) return;
  try {
    const result = await db.run(
      `INSERT INTO finance_subscription (name, amount, cadence, next_due_date, account_id, direction)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [name, amount, cadence, nextDueDate ?? null, accountId ?? null, direction]
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
     ORDER BY (s.status = 'active') DESC, s.next_due_date ASC;`
  );
  return result.values || [];
}

export async function updateFinanceSubscription(
  id: number,
  name: string,
  amount: number,
  cadence: string,
  nextDueDate?: string | null,
  accountId?: number | null,
  direction: 'expense' | 'income' = 'expense'
) {
  if (!db) return;
  try {
    await db.run(
      `UPDATE finance_subscription
       SET name = ?, amount = ?, cadence = ?, next_due_date = ?, account_id = ?, direction = ?
       WHERE id = ?;`,
      [name, amount, cadence, nextDueDate ?? null, accountId ?? null, direction, id]
    );
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
}

// Toggle a recurring item between 'active' and 'paused' (kept for history but
// excluded from monthly totals / reminders).
export async function setFinanceSubscriptionStatus(id: number, status: 'active' | 'paused') {
  if (!db) return;
  try {
    await db.run(`UPDATE finance_subscription SET status = ? WHERE id = ?;`, [status, id]);
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
}

export async function deleteFinanceSubscription(id: number) {
  if (!db) return;
  try {
    await db.run(`DELETE FROM finance_subscription WHERE id = ?;`, [id]);
  } catch (error) {
    console.error('Error deleting subscription:', error);
    throw error;
  }
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

export async function updateFinanceTransaction(
  id: number,
  date: string,
  name: string,
  category: string,
  amount: number,
  type: 'expense' | 'income',
  notes?: string
) {
  if (!db) return;
  try {
    await db.run(
      `UPDATE finance_transaction
       SET date = ?, name = ?, category = ?, amount = ?, type = ?, notes = ?
       WHERE id = ?;`,
      [date, name, category, amount, type, notes ?? null, id]
    );
  } catch (error) {
    console.error('Error updating finance transaction:', error);
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

// Most recent transactions across all months (for the overview feed).
export async function getRecentFinanceTransactions(limit = 5) {
  if (!db) return [];
  const result = await db.query(
    `SELECT * FROM finance_transaction ORDER BY date DESC, id DESC LIMIT ?;`,
    [limit]
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

export interface MonthlySpending {
  month: string;   // YYYY-MM
  expense: number;
  income: number;
}

// Income vs expense totals per month over the last N months (oldest first).
// Snapshot today's net worth (accounts + investments) so the review digest can
// compute a net-worth delta over time. Idempotent per day (PK = date), so it's
// safe to call on every finance-page load; positive net is stored as assets,
// negative as liabilities.
export async function recordNetWorthSnapshot() {
  if (!db) return;
  const d = new Date();
  const today = localDateISO(d);
  // Credit/loan accounts are liabilities (money owed); everything else plus the
  // value of investments is an asset. Net worth = assets − liabilities.
  const assetsRow = await db.query(
    `SELECT COALESCE(SUM(balance), 0) AS v FROM finance_account WHERE COALESCE(type, 'cash') NOT IN ('credit', 'loan');`
  );
  const liabRow = await db.query(
    `SELECT COALESCE(SUM(balance), 0) AS v FROM finance_account WHERE type IN ('credit', 'loan');`
  );
  const invRow = await db.query(`SELECT COALESCE(SUM(value), 0) AS v FROM finance_investment;`);
  const assets = (Number(assetsRow.values?.[0]?.v) || 0) + (Number(invRow.values?.[0]?.v) || 0);
  const liabilities = Number(liabRow.values?.[0]?.v) || 0;
  await db.run(
    `INSERT INTO net_worth_snapshot (date, total_assets, total_liabilities)
     VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET total_assets = excluded.total_assets, total_liabilities = excluded.total_liabilities;`,
    [today, assets, liabilities]
  );
}

export interface NetWorthPoint {
  date: string;       // YYYY-MM-DD
  assets: number;
  liabilities: number;
  net: number;
}

// Daily net-worth snapshots over the last N days (oldest first) for the trend chart.
export async function getNetWorthHistory(days = 90): Promise<NetWorthPoint[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT date, total_assets, total_liabilities
     FROM net_worth_snapshot
     WHERE date >= date('now', ?)
     ORDER BY date ASC;`,
    [`-${days} days`]
  );
  return ((result.values ?? []) as { date: string; total_assets: number; total_liabilities: number }[]).map(
    (r) => {
      const assets = Number(r.total_assets) || 0;
      const liabilities = Number(r.total_liabilities) || 0;
      return { date: r.date, assets, liabilities, net: assets - liabilities };
    }
  );
}

export async function queryMonthlySpending(months = 6): Promise<MonthlySpending[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT
       strftime('%Y-%m', date) AS month,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS expense,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS income
     FROM finance_transaction
     WHERE date >= date('now', 'start of month', ?)
     GROUP BY month
     ORDER BY month ASC;`,
    [`-${months - 1} months`]
  );
  return ((result.values ?? []) as { month: string; expense: number; income: number }[])
    .map((r) => ({ month: r.month, expense: Number(r.expense) || 0, income: Number(r.income) || 0 }));
}

export interface CategorySpending {
  category: string;
  amount: number;
}

// Expense totals grouped by category for a single month (largest first).
export async function queryCategorySpending(monthKey: string): Promise<CategorySpending[]> {
  if (!db) return [];
  const result = await db.query(
    `SELECT category, SUM(amount) AS amount
     FROM finance_transaction
     WHERE type = 'expense' AND strftime('%Y-%m', date) = ?
     GROUP BY category
     ORDER BY amount DESC;`,
    [monthKey]
  );
  return ((result.values ?? []) as { category: string; amount: number }[])
    .map((r) => ({ category: r.category || 'other', amount: Number(r.amount) || 0 }));
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
  waist_cm: number | null
  chest_cm: number | null
  hips_cm: number | null
  arm_cm: number | null
  thigh_cm: number | null
  body_fat_pct: number | null
}

export async function insertBodyLog(entry: {
  date: string
  weight_kg: number
  notes?: string
  photo_path?: string
  waist_cm?: number | null
  chest_cm?: number | null
  hips_cm?: number | null
  arm_cm?: number | null
  thigh_cm?: number | null
  body_fat_pct?: number | null
}): Promise<void> {
  if (!db) return
  await db.run(
    `INSERT INTO body_log
       (date, weight_kg, notes, photo_path, waist_cm, chest_cm, hips_cm, arm_cm, thigh_cm, body_fat_pct)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.date, entry.weight_kg, entry.notes ?? null, entry.photo_path ?? null,
      entry.waist_cm ?? null, entry.chest_cm ?? null, entry.hips_cm ?? null,
      entry.arm_cm ?? null, entry.thigh_cm ?? null, entry.body_fat_pct ?? null,
    ]
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
         ORDER BY wes2.reps DESC
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
      (SELECT wes2.reps
         FROM workout_exercise_sets wes2
         JOIN workout_exercise we2 ON we2.id = wes2.workout_exercise_id
        WHERE we2.exercise_id = we.exercise_id
          AND wes2.completed = 1
          AND date(wes2.created_at, 'localtime') = date(wes.created_at, 'localtime')
        ORDER BY wes2.weight DESC, wes2.reps DESC
        LIMIT 1) as reps,
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
      SUM(wes.weight * wes.reps) as volume,
      ROUND(AVG(CASE WHEN wes.rpe IS NOT NULL THEN wes.rpe END), 1) as avg_rpe
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

// ── Gym analytics aggregations ───────────────────────────────────────────────

export interface MuscleVolume {
  muscle_group: string;
  volume: number;
  sets: number;
}

// Total completed-set volume per muscle group within the last N days.
export async function queryVolumeByMuscleGroup(days = 30): Promise<MuscleVolume[]> {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  const dateLimit = daysAgo.toISOString().replace('T', ' ').slice(0, 19);

  const result = await db.query(`
    SELECT
      mg.name as muscle_group,
      SUM(wes.weight * wes.reps) as volume,
      COUNT(*) as sets
    FROM workout_exercise_sets wes
    JOIN workout_exercise we ON we.id = wes.workout_exercise_id
    JOIN exercise e ON e.id = we.exercise_id
    JOIN muscle_group mg ON mg.id = e.id_muscle_group
    WHERE wes.completed = 1 AND wes.created_at >= ?
    GROUP BY mg.id
    ORDER BY volume DESC
  `, [dateLimit]);

  return (result.values ?? []) as MuscleVolume[];
}

export interface WeeklyTonnage {
  week: string;
  volume: number;
}

// Total completed-set volume grouped by ISO week over the last N weeks.
export async function queryWeeklyTonnage(weeks = 8): Promise<WeeklyTonnage[]> {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - weeks * 7);
  const dateLimit = daysAgo.toISOString().replace('T', ' ').slice(0, 19);

  const result = await db.query(`
    SELECT
      strftime('%Y-%W', wes.created_at, 'localtime') as week,
      SUM(wes.weight * wes.reps) as volume
    FROM workout_exercise_sets wes
    WHERE wes.completed = 1 AND wes.created_at >= ?
    GROUP BY week
    ORDER BY week ASC
  `, [dateLimit]);

  return (result.values ?? []) as WeeklyTonnage[];
}

export interface WorkoutDayCount {
  date: string;
  count: number;
}

// Completed-workout count per calendar day over the last N weeks (heatmap).
export async function queryWorkoutFrequency(weeks = 10): Promise<WorkoutDayCount[]> {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - weeks * 7);
  const dateLimit = daysAgo.toISOString().replace('T', ' ').slice(0, 19);

  const result = await db.query(`
    SELECT
      date(w.time_start, 'localtime') as date,
      COUNT(*) as count
    FROM workout w
    WHERE w.time_end IS NOT NULL AND w.time_start >= ?
    GROUP BY date(w.time_start, 'localtime')
    ORDER BY date ASC
  `, [dateLimit]);

  return (result.values ?? []) as WorkoutDayCount[];
}

// Per-day completed-set volume over the last N days (for training-load / ACWR).
export async function queryDailyVolume(days = 28): Promise<{ date: string; value: number }[]> {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  const dateLimit = daysAgo.toISOString().replace('T', ' ').slice(0, 19);

  const result = await db.query(`
    SELECT
      date(wes.created_at, 'localtime') as date,
      SUM(wes.weight * wes.reps) as value
    FROM workout_exercise_sets wes
    WHERE wes.completed = 1 AND wes.created_at >= ?
    GROUP BY date(wes.created_at, 'localtime')
    ORDER BY date ASC
  `, [dateLimit]);

  return ((result.values ?? []) as { date: string; value: number }[])
    .map((r) => ({ date: r.date, value: Number(r.value) || 0 }));
}

/** Set (or clear, with null) the post-workout session RPE for sRPE load. */
export async function setWorkoutSessionRpe(workoutId: number, rpe: number | null) {
  if (!db) return;
  await db.run('UPDATE workout SET session_rpe = ? WHERE id = ?', [rpe, workoutId]);
}

export interface SessionLoadRow {
  workout_id: number;
  date: string;            // local YYYY-MM-DD
  time_end: string | null; // ISO end timestamp (for recovery-time countdown)
  duration_minutes: number | null;
  session_rpe: number | null;
  volume: number;          // Σ(weight × reps) over completed sets
}

/**
 * One row per workout in the window with its volume load, derived duration
 * (minutes, from time_start→time_end) and session RPE. Feeds TrainingLoadService.
 */
export async function getSessionLoads(days = 120): Promise<SessionLoadRow[]> {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  const dateLimit = daysAgo.toISOString().replace('T', ' ').slice(0, 19);

  const result = await db.query(`
    SELECT
      w.id AS workout_id,
      date(w.time_start, 'localtime') AS date,
      w.time_start AS time_start,
      w.time_end AS time_end,
      w.session_rpe AS session_rpe,
      COALESCE(SUM(CASE WHEN wes.completed = 1 THEN wes.weight * wes.reps ELSE 0 END), 0) AS volume
    FROM workout w
    LEFT JOIN workout_exercise we ON we.workout_id = w.id
    LEFT JOIN workout_exercise_sets wes ON wes.workout_exercise_id = we.id
    WHERE w.time_start >= ?
    GROUP BY w.id
    ORDER BY w.time_start ASC
  `, [dateLimit]);

  return ((result.values ?? []) as Array<Record<string, unknown>>).map((r) => {
    const start = r.time_start ? new Date(String(r.time_start)).getTime() : NaN;
    const end = r.time_end ? new Date(String(r.time_end)).getTime() : NaN;
    const duration =
      Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.round((end - start) / 60000)
        : null;
    const rpe = r.session_rpe == null ? null : Number(r.session_rpe);
    return {
      workout_id: Number(r.workout_id),
      date: String(r.date),
      time_end: r.time_end ? String(r.time_end) : null,
      duration_minutes: duration,
      session_rpe: rpe != null && Number.isFinite(rpe) ? rpe : null,
      volume: Number(r.volume) || 0,
    } satisfies SessionLoadRow;
  });
}

/**
 * Daily series for a health_metric type (one averaged value per date), ascending.
 * Used by the recovery baseline overlay (resting_heart_rate today, hrv-ready).
 */
export async function getHealthMetricDailySeries(
  type: string,
  days = 120
): Promise<{ date: string; value: number }[]> {
  if (!db) return [];

  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - days);
  const dateLimit = localDateISO(daysAgo);

  const result = await db.query(`
    SELECT date AS date, AVG(value) AS value
    FROM health_metric
    WHERE type = ? AND date >= ?
    GROUP BY date
    ORDER BY date ASC
  `, [type, dateLimit]);

  return ((result.values ?? []) as Array<Record<string, unknown>>)
    .map((r) => ({ date: String(r.date), value: Number(r.value) || 0 }));
}

