export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// {userId}/{filename}.{jpg|jpeg|png}
export const PASS_FILE_PATH_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+\.(jpg|jpeg|png)$/i;

export function isValidPassFilePath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !value.includes('..') &&
    PASS_FILE_PATH_REGEX.test(value)
  );
}
