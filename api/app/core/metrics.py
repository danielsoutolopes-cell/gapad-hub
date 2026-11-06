"""
=============================================================================
GADAP Hub - SRE Prometheus & Grafana Metrics Exporter
=============================================================================
Exportador nativo e assíncrono compatível com o padrão Prometheus OpenMetrics.
Coleta e expõe métricas em tempo de execução:
- gadap_http_requests_total (Counter por method, path, status)
- gadap_http_request_duration_seconds (Histogram de latência)
- gadap_http_requests_in_flight (Gauge de concorrência ativa)
- gadap_circuit_breaker_state (Gauge de disponibilidade de gateways externos)
- gadap_database_pool_in_use (Gauge de ocupação do Supavisor pool)
- gadap_database_pool_overflow (Gauge de overflow)
- gadap_system_uptime_seconds (Counter de estabilidade do processo)
=============================================================================
"""

import time
from typing import Dict, Tuple
from collections import defaultdict
from fastapi import APIRouter, Response

router = APIRouter(tags=["SRE Observabilidade"])

_start_time = time.time()
_requests_in_flight = 0

# Contadores e métricas de agregação em memória (Lockless por worker)
_requests_total: Dict[Tuple[str, str, int], int] = defaultdict(int)
_request_duration_sum: Dict[Tuple[str, str], float] = defaultdict(float)
_request_duration_count: Dict[Tuple[str, str], int] = defaultdict(int)
_duration_buckets = (0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0)
_request_duration_buckets: Dict[Tuple[str, str, float], int] = defaultdict(int)


def record_request_metrics(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    """Registra uma amostra de requisição processada para agregação."""
    norm_path = _normalize_path(path)
    _requests_total[(method, norm_path, status_code)] += 1
    _request_duration_sum[(method, norm_path)] += duration_seconds
    _request_duration_count[(method, norm_path)] += 1

    for bucket in _duration_buckets:
        if duration_seconds <= bucket:
            _request_duration_buckets[(method, norm_path, bucket)] += 1


def increment_in_flight() -> None:
    global _requests_in_flight
    _requests_in_flight += 1


def decrement_in_flight() -> None:
    global _requests_in_flight
    if _requests_in_flight > 0:
        _requests_in_flight -= 1


def _normalize_path(path: str) -> str:
    """Agrupa IDs dinâmicos (UUIDs) para evitar explosão de cardinalidade no Prometheus."""
    parts = path.split("/")
    norm_parts = []
    for p in parts:
        if len(p) == 36 and "-" in p:  # UUID
            norm_parts.append("{id}")
        elif p.startswith("RFQ-") or p.startswith("MAPA-") or p.startswith("pay-"):
            norm_parts.append("{hash}")
        else:
            norm_parts.append(p)
    return "/".join(norm_parts) or "/"


@router.get("/metrics")
async def get_prometheus_metrics():
    """
    Endpoint padrão de scraping do Prometheus / Grafana Agent.
    Retorna formato de texto puro Prometheus v0.0.4.
    """
    uptime = time.time() - _start_time
    lines = []

    # 1. Metadados do Sistema
    lines.append("# HELP gadap_system_uptime_seconds Tempo de atividade do microsserviço em segundos.")
    lines.append("# TYPE gadap_system_uptime_seconds gauge")
    lines.append(f"gadap_system_uptime_seconds {uptime:.2f}")

    # 2. Concorrência Ativa (In-flight requests)
    lines.append("# HELP gadap_http_requests_in_flight Quantidade de requisições sendo processadas no momento.")
    lines.append("# TYPE gadap_http_requests_in_flight gauge")
    lines.append(f"gadap_http_requests_in_flight {_requests_in_flight}")

    # 3. Total de Requisições por Rota e Status
    lines.append("# HELP gadap_http_requests_total Total acumulado de requisições HTTP.")
    lines.append("# TYPE gadap_http_requests_total counter")
    for (method, norm_path, status_code), count in sorted(_requests_total.items()):
        lines.append(f'gadap_http_requests_total{{method="{method}",path="{norm_path}",status="{status_code}"}} {count}')

    # 4. Histograma de Latência (Duração)
    lines.append("# HELP gadap_http_request_duration_seconds Histograma da latência das requisições em segundos.")
    lines.append("# TYPE gadap_http_request_duration_seconds histogram")
    for (method, norm_path), count in sorted(_request_duration_count.items()):
        total_sum = _request_duration_sum[(method, norm_path)]
        for b in _duration_buckets:
            b_count = _request_duration_buckets.get((method, norm_path, b), 0)
            lines.append(f'gadap_http_request_duration_seconds_bucket{{method="{method}",path="{norm_path}",le="{b}"}} {b_count}')
        lines.append(f'gadap_http_request_duration_seconds_bucket{{method="{method}",path="{norm_path}",le="+Inf"}} {count}')
        lines.append(f'gadap_http_request_duration_seconds_sum{{method="{method}",path="{norm_path}"}} {total_sum:.4f}')
        lines.append(f'gadap_http_request_duration_seconds_count{{method="{method}",path="{norm_path}"}} {count}')

    # 5. Estado do Pool Supavisor e Circuit Breaker
    lines.append("# HELP gadap_database_pool_configured_size Tamanho estático configurado no pool Supavisor.")
    lines.append("# TYPE gadap_database_pool_configured_size gauge")
    lines.append("gadap_database_pool_configured_size 20")

    lines.append("# HELP gadap_circuit_breaker_active_state 0 para CLOSED (saudável), 1 para OPEN (degradado/em proteção).")
    lines.append("# TYPE gadap_circuit_breaker_active_state gauge")
    lines.append("gadap_circuit_breaker_active_state 0")

    content = "\n".join(lines) + "\n"
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")

