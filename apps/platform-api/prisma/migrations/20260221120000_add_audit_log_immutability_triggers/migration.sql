-- BR-PLT-016, NFR49: Enforce PlatformAuditLog immutability at the database level.
-- Application code already omits update/delete methods, but this trigger provides
-- defence-in-depth by physically blocking UPDATE and DELETE at the PostgreSQL layer.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_log is append-only: UPDATE and DELETE are forbidden (BR-PLT-016, NFR49)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_audit_log_update
  BEFORE UPDATE ON platform_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER trg_prevent_audit_log_delete
  BEFORE DELETE ON platform_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
