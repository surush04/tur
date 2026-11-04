// Used only by the server image. The browser calls /api on the same host,
// and nginx forwards that to the API container. Phone builds keep environment.ts.
export const environment = {
  production: true,
  apiUrl: '/api',
};

export function apiOrigin(): string {
  return environment.apiUrl.replace(/\/api$/, '');
}
