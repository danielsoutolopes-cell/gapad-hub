/**
 * GADAP Hub - Cliente de Comunicação Interna (Web -> API)
 * 
 * Utiliza o binding "API_URL" injetado pelo Vercel Services em tempo de execução.
 * Em desenvolvimento local, faz fallback para http://localhost:8000.
 */

export function getApiUrl(path: string): URL {
  const baseUrl = process.env.API_URL || process.env.BACKEND_URL || 'http://localhost:8000';
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl);
}

export async function callApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getApiUrl(path);

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
      `Falha na chamada interna ao serviço API [${response.status} ${response.statusText}]: ${errorBody}`
    );
  }

  return response.json() as Promise<T>;
}
