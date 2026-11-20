# diffraction

## Overview
Diffraction and obstacle computation algorithms for radio / line-of-sight analysis.

## Interface
- `[models.py] class ItinerarySegment`
- `[models.py] class PresetConfig`
- `[models.py] class StepAssignment`
- `[models.py] class DiffractionResult`
- `[solver.py] class DiffractionSolver`
- `[solver.py]   DiffractionSolver.__init__()`
- `[solver.py]   DiffractionSolver.solve()`

## Invariants
- None

## Side Effects
- None

## Verification
- Run: `pytest tests/ -v`
