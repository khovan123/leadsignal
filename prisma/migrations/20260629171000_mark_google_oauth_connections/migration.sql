CREATE OR REPLACE FUNCTION "markGoogleOAuthConnection"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.provider = 'GEMINI' THEN
    UPDATE "LlmConnection"
    SET "baseUrl" = 'vertex-oauth://google', "updatedAt" = NOW()
    WHERE id = NEW."connectionId";
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ProviderOAuthCredential_mark_google" ON "ProviderOAuthCredential";
CREATE TRIGGER "ProviderOAuthCredential_mark_google"
AFTER INSERT OR UPDATE ON "ProviderOAuthCredential"
FOR EACH ROW
EXECUTE FUNCTION "markGoogleOAuthConnection"();

UPDATE "LlmConnection" connection
SET "baseUrl" = 'vertex-oauth://google', "updatedAt" = NOW()
FROM "ProviderOAuthCredential" credential
WHERE credential."connectionId" = connection.id
  AND credential.provider = 'GEMINI';
