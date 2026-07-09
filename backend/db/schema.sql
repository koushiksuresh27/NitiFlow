-- NitiFlow Database Schema

-- ==========================================
-- 1. NEW TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS wards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    lat float8,
    lng float8,
    population int,
    students int,
    classrooms int,
    hospital_distance_km float8,
    nearest_skill_centre_distance_km float8,
    youth_unemployment_rate float8,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dev_plan_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ward_id uuid REFERENCES wards(id),
    project_name text,
    category text,
    estimated_cost numeric,
    description text,
    source text DEFAULT 'ocr_import',
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 2. CREATE EXTRACTED FEATURES TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS complaints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    input_type text,
    category text,
    urgency text,
    confidence float8,
    summary text,
    ward_hint text,
    sentiment_score float8,
    transcript text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS complaint_clusters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    core_issue text,
    ward_id uuid REFERENCES wards(id),
    complaint_count int DEFAULT 1,
    severity_score float8,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chronic_issues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text,
    category text,
    urgency_level text,
    created_at timestamptz DEFAULT now()
);

-- ==========================================
-- 2.5 ALTER EXISTING TABLES
-- ==========================================

ALTER TABLE complaints 
ADD COLUMN IF NOT EXISTS ward_id uuid REFERENCES wards(id),
ADD COLUMN IF NOT EXISTS cluster_id uuid;

ALTER TABLE chronic_issues 
ADD COLUMN IF NOT EXISTS ward_id uuid REFERENCES wards(id);

-- ==========================================
-- 3. SEED DATA
-- ==========================================

-- Seed 18 wards for Bangalore North constituency
INSERT INTO wards (name, lat, lng, population, students, classrooms, hospital_distance_km, nearest_skill_centre_distance_km, youth_unemployment_rate) VALUES
('Kempegowda Ward', 13.021, 77.541, 15000, 1500, 10, 2.5, 3.0, 0.20),
('Chowdeshwari Ward', 13.025, 77.545, 22000, 2100, 12, 3.1, 4.2, 0.25),
('Attur', 13.030, 77.540, 31000, 3500, 16, 5.0, 6.5, 0.30),
('Yelahanka Satellite Town', 13.015, 77.535, 28000, 3100, 15, 1.8, 2.1, 0.18),
('Jakkur', 13.035, 77.550, 18000, 1800, 11, 4.5, 5.0, 0.22),
('Thanisandra', 13.040, 77.555, 25000, 2600, 13, 6.2, 7.1, 0.28),
('Byatarayanapura', 13.010, 77.530, 32000, 3700, 18, 2.2, 3.5, 0.15),
('Kodigehalli', 13.005, 77.545, 19000, 2000, 11, 3.8, 4.0, 0.19),
('Vidyaranyapura', 13.022, 77.558, 27000, 2900, 14, 2.9, 1.5, 0.17),
('Dodda Bommasandra', 13.018, 77.560, 21000, 2200, 12, 4.1, 3.2, 0.24),
('Kuvempu Nagar', 13.028, 77.525, 24000, 2500, 13, 1.9, 2.8, 0.21),
('Shettyhalli', 13.032, 77.520, 16000, 1600, 9, 7.5, 8.0, 0.35),
('Mallasandra', 13.038, 77.515, 14000, 1400, 8, 8.2, 9.5, 0.40),
('Bagalagunte', 13.045, 77.510, 11000, 1200, 8, 10.5, 11.0, 0.45),
('T Dasarahalli', 13.008, 77.515, 29000, 3200, 16, 2.0, 1.8, 0.16),
('Peenya Industrial Area', 13.012, 77.510, 26000, 2800, 14, 3.5, 2.5, 0.26),
('Jalahalli', 13.020, 77.530, 23000, 2400, 12, 2.7, 3.4, 0.19),
('Laggere', 12.995, 77.525, 30000, 3400, 17, 4.8, 5.5, 0.32);

-- Seed 5 dev_plan_projects referencing the wards
INSERT INTO dev_plan_projects (ward_id, project_name, category, estimated_cost, description) VALUES
((SELECT id FROM wards WHERE name = 'Kempegowda Ward' LIMIT 1), 'Government Primary School Upgradation', 'schools', 1500000.00, 'Adding 4 new classrooms and a science lab'),
((SELECT id FROM wards WHERE name = 'Chowdeshwari Ward' LIMIT 1), 'Primary Health Centre Renovation', 'health', 2500000.00, 'Upgrading hospital beds and adding a new maternity wing'),
((SELECT id FROM wards WHERE name = 'Attur' LIMIT 1), 'Attur Main Road Asphalting', 'roads', 5000000.00, 'Relaying 3km of arterial road with proper drainage'),
((SELECT id FROM wards WHERE name = 'Yelahanka Satellite Town' LIMIT 1), 'Underground Drainage System Phase 2', 'sanitation', 8000000.00, 'Extending UGD to newly developed layouts'),
((SELECT id FROM wards WHERE name = 'Jakkur' LIMIT 1), 'Youth Skill Development Centre', 'skills', 3500000.00, 'Building a vocational training centre for electronics and IT skills');

-- ==========================================
-- 4. TRIGGERS AND REALTIME
-- ==========================================

-- Auto-assign complaint to nearest ward to center if ward_id is null
CREATE OR REPLACE FUNCTION auto_assign_ward()
RETURNS TRIGGER AS $$
DECLARE
  best_ward uuid;
BEGIN
  IF NEW.ward_id IS NULL THEN
    SELECT id INTO best_ward
    FROM public.wards
    ORDER BY sqrt(power(lat - 13.02, 2) + power(lng - 77.54, 2)) ASC
    LIMIT 1;

    IF best_ward IS NOT NULL THEN
      NEW.ward_id = best_ward;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS complaint_auto_assign_ward ON public.complaints;
CREATE TRIGGER complaint_auto_assign_ward
  BEFORE INSERT ON public.complaints
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_ward();

-- Enable Supabase Realtime for frontend live updates
ALTER TABLE complaint_clusters REPLICA IDENTITY FULL;
-- Note: the table must also be added to the supabase_realtime publication manually in the dashboard or via:
-- begin; drop publication if exists supabase_realtime; create publication supabase_realtime for table complaint_clusters; commit;
