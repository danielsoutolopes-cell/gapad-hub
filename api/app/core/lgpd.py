"""
=============================================================================
GADAP Hub - Módulo de Conformidade com a LGPD (Lei Federal nº 13.709/2018)
Arquivo: api/app/core/lgpd.py
=============================================================================
Fornece funções de mascaramento/anonimização (Art. 13), auditoria de acesso
a dados sensíveis e gestão de direitos dos titulares (Art. 18).
=============================================================================
"""

import re
from typing import Any, Dict, List, Optional


def mask_cpf(cpf: Optional[str]) -> str:
    """
    Mascaramento seguro de CPF (Art. 13 da LGPD).
    Exemplo: '123.456.789-01' -> '123.***.***-01'
    """
    if not cpf:
        return "***.***.***-**"
    digits = re.sub(r"\D", "", cpf)
    if len(digits) != 11:
        return "***.***.***-**"
    return f"{digits[:3]}.***.***-{digits[-2:]}"


def mask_email(email: Optional[str]) -> str:
    """
    Mascaramento seguro de e-mail de colaboradores/clientes (Art. 13 da LGPD).
    Exemplo: 'carlos.silva@construtora.com.br' -> 'c***a@construtora.com.br'
    """
    if not email or "@" not in email:
        return "***@***.***"
    user_part, domain_part = email.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "***"
    else:
        masked_user = user_part[0] + "***" + user_part[-1]
    return f"{masked_user}@{domain_part}"


def mask_phone(phone: Optional[str]) -> str:
    """
    Mascaramento seguro de telefone celular (Art. 13 da LGPD).
    Exemplo: '(11) 98765-4321' -> '(11) 9****-**21'
    """
    if not phone:
        return "(**) *****-****"
    digits = re.sub(r"\D", "", phone)
    if len(digits) >= 10:
        ddd = digits[:2]
        last2 = digits[-2:]
        return f"({ddd}) 9****-**{last2}"
    return "(**) *****-****"


def mask_cnpj(cnpj: Optional[str]) -> str:
    """
    Mascaramento de CNPJ (Art. 13 da LGPD / Sigilo Fiscal).
    Exemplo: '12.345.678/0001-90' -> '12.***.***/0001-90'
    """
    if not cnpj:
        return "**.***.***/****-**"
    digits = re.sub(r"\D", "", cnpj)
    if len(digits) != 14:
        return "**.***.***/****-**"
    return f"{digits[:2]}.***.***/{digits[8:12]}-{digits[-2:]}"


def sanitize_employee_for_lgpd(emp: Dict[str, Any], include_full_cpf: bool = False) -> Dict[str, Any]:
    """
    Higieniza e mascara dados pessoais de colaboradores conforme a LGPD
    antes de expor em endpoints públicos ou listagens de canteiro.
    """
    emp_copy = dict(emp)
    raw_cpf = emp_copy.get("cpf") or ""
    emp_copy["cpf_masked"] = mask_cpf(raw_cpf)
    if not include_full_cpf:
        emp_copy["cpf"] = mask_cpf(raw_cpf)
    if "phone" in emp_copy:
        emp_copy["phone_masked"] = mask_phone(emp_copy["phone"])
    return emp_copy
