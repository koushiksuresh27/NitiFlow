-- Seed Complaints, Clusters, and Chronic Issues for Demo

DO $$ 
DECLARE
    kempegowda_id uuid;
    chowdeshwari_id uuid;
    attur_id uuid;
    jakkur_id uuid;
    cluster_pothole_id uuid := gen_random_uuid();
    cluster_water_id uuid := gen_random_uuid();
    cluster_street_id uuid := gen_random_uuid();
BEGIN
    SELECT id INTO kempegowda_id FROM wards WHERE name = 'Kempegowda Ward' LIMIT 1;
    SELECT id INTO chowdeshwari_id FROM wards WHERE name = 'Chowdeshwari Ward' LIMIT 1;
    SELECT id INTO attur_id FROM wards WHERE name = 'Attur' LIMIT 1;
    SELECT id INTO jakkur_id FROM wards WHERE name = 'Jakkur' LIMIT 1;

    -- Chronic Issue 1: Potholes in Kempegowda
    INSERT INTO complaint_clusters (id, ward_id, fingerprint, category, complaint_count, is_chronic)
    VALUES (cluster_pothole_id, kempegowda_id, 'roads_pothole_main', 'roads', 12, true);

    -- Chronic Issue 2: Water Contamination in Chowdeshwari
    INSERT INTO complaint_clusters (id, ward_id, fingerprint, category, complaint_count, is_chronic)
    VALUES (cluster_water_id, chowdeshwari_id, 'water_supply_muddy', 'water_supply', 8, true);

    -- Normal Cluster 3: Streetlights out in Attur
    INSERT INTO complaint_clusters (id, ward_id, fingerprint, category, complaint_count, is_chronic)
    VALUES (cluster_street_id, attur_id, 'street_lights_out_main', 'street_lights', 5, false);

    -- Insert 25 Complaints mapped to these clusters
    FOR i IN 1..12 LOOP
        INSERT INTO complaints (ward_id, cluster_id, category, urgency, summary, input_type)
        VALUES (kempegowda_id, cluster_pothole_id, 'roads', 'high', 'Massive pothole causing accidents near the main junction', 'text');
    END LOOP;

    FOR i IN 1..8 LOOP
        INSERT INTO complaints (ward_id, cluster_id, category, urgency, summary, input_type)
        VALUES (chowdeshwari_id, cluster_water_id, 'water_supply', 'high', 'Yellow muddy water coming from taps for 3 days', 'voice');
    END LOOP;

    FOR i IN 1..5 LOOP
        INSERT INTO complaints (ward_id, cluster_id, category, urgency, summary, input_type)
        VALUES (attur_id, cluster_street_id, 'street_lights', 'medium', 'Streetlights are completely off in the 4th block', 'text');
    END LOOP;

END $$;
