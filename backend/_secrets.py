# _secrets.py
import os, time
from typing import Optional
from shared import clients  # your existing helper

_DEFAULT_TTL = 15 * 60  # 15 minutes; adjust per secret type
_cache: dict[str, tuple[str, int]] = {}


def _now() -> int:
    return int(time.time())


def get_secret(
    name: str, env_name: Optional[str] = None, ttl: int = _DEFAULT_TTL
) -> str:
    # 1) App Settings / .env (or Key Vault References) win
    if env_name and (v := os.getenv(env_name)):
        return v
    if v := os.getenv(name):
        return v

    # 2) Short TTL cache
    hit = _cache.get(name)
    if hit and hit[1] > _now():
        return hit[0]

    # 3) Fallback to Key Vault via your existing client (ideally MI/AAD under the hood)
    v = clients.get_azure_key_vault_secret(name)
    if ttl > 0:
        _cache[name] = (v, _now() + ttl)
    return v
