BEGIN;

CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    student_email_domains TEXT[] NOT NULL CHECK (cardinality(student_email_domains) > 0),
    staff_email_domains TEXT[] NOT NULL DEFAULT '{}',
    matric_regex TEXT NOT NULL,
    min_pass_grade TEXT NOT NULL,
    default_prereq_min_grade TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (id, name, student_email_domains, staff_email_domains, matric_regex, min_pass_grade, default_prereq_min_grade)
VALUES ('UTM', 'Universiti Teknologi Malaysia', ARRAY['graduate.utm.my'], '{}', '^[A-Z][0-9]{2}[A-Z]{2}[0-9]{4}$', 'D+', 'C');

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE VIEW tenants_public AS SELECT id, name FROM tenants;
REVOKE ALL ON tenants_public FROM anon;
GRANT SELECT ON tenants_public TO authenticated;

DO $$
DECLARE orphan TEXT;
BEGIN
    SELECT tenant_id INTO orphan FROM degree_templates WHERE tenant_id NOT IN (SELECT id FROM tenants) LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'degree_templates orphan tenant_id: %', orphan; END IF;
    SELECT tenant_id INTO orphan FROM advisors WHERE tenant_id NOT IN (SELECT id FROM tenants) LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'advisors orphan tenant_id: %', orphan; END IF;
    SELECT tenant_id INTO orphan FROM students WHERE tenant_id NOT IN (SELECT id FROM tenants) LIMIT 1;
    IF FOUND THEN RAISE EXCEPTION 'students orphan tenant_id: %', orphan; END IF;
END $$;

ALTER TABLE degree_templates ADD CONSTRAINT fk_degree_templates_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE advisors         ADD CONSTRAINT fk_advisors_tenant         FOREIGN KEY (tenant_id) REFERENCES tenants(id);
ALTER TABLE students         ADD CONSTRAINT fk_students_tenant         FOREIGN KEY (tenant_id) REFERENCES tenants(id);

COMMIT;
