# ai

## Overview
AI copilot integration service facilitating document generation and narrative synthesis.

## Interface
- `[models.py] class AIProviderConfig`
- `[models.py] class GenerateNarrativeRequest`
- `[models.py] class GenerateNarrativeResponse`
- `[models.py] class GenerateRiddleRequest`
- `[models.py] class GenerateRiddleResponse`
- `[models.py] class SafetyAuditRequest`
- `[models.py] class SafetyAuditAlert`
- `[models.py] class SafetyAuditResponse`
- `[service.py] class AIService`
- `[service.py]   AIService.__init__()`
- `[service.py]   AIService.generate_narrative()`
- `[service.py]   AIService.generate_riddle()`
- `[service.py]   AIService.audit_safety()`

## Invariants
- [service.py] Enforces: ValueError("GEMINI_API_KEY is not configured.")

## Side Effects
- Network / HTTP / S3 external requests

## Verification
- Run: `pytest tests/ -v`
