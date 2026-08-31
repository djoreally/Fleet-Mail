GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON FUNCTION app.current_auth_subject() TO authenticated;
GRANT EXECUTE ON FUNCTION app.is_org_member(text) TO authenticated;
GRANT EXECUTE ON FUNCTION app.is_org_admin(text) TO authenticated;
