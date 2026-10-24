/**
 * GADAP Hub - Cliente de Comunicação Interna (Frontend -> Backend)
 * 
 * Utiliza o binding "BACKEND_URL" injetado pelo Vercel Services em tempo de execução.
 * Em desenvolvimento local, faz fallback para http://localhost:8000.
 */

export function getBackendUrl(path: string): URL {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl);
}

export async function callBackendApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getBackendUrl(path);

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Falha na chamada interna ao backend [${response.status} ${response.statusText}]: ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}
