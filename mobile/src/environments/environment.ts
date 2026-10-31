// Keep this URL in step with backend PORT. This workspace uses 3010 because 3000 is already taken locally.
export const environment = {
  production: false,
  apiUrl: 'http://162.35.185.15:3010/api',
};

export function apiOrigin(): string {
  return environment.apiUrl.replace(/\/api$/, '');
}
