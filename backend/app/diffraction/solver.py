"""
CSP Probabilistic Diffraction Solver for ScoutRaider.
Distributes encoding and visual modules across itinerary segments according to
preset weights, proportionality ceilings, non-consecutive rules, and geographical constraints.
Includes lightweight backtracking and guaranteed deterministic fallback.
"""

import math
import random
from typing import List, Dict, Any, Optional, Set, Tuple

from .models import ItinerarySegment, PresetConfig, StepAssignment, DiffractionResult
from ..modules.schema import ModuleMetadata, ModuleCategory, RenderType
from ..modules.adapter import DEFAULT_CATEGORY_CONSTRAINTS


class DiffractionSolver:
    """
    Constraint Satisfaction & Probabilistic Diffraction Solver.
    """

    MAX_BACKTRACK_ATTEMPTS = 60

    def __init__(self, modules: Dict[str, ModuleMetadata]):
        self.modules = {k.lower(): v for k, v in modules.items()}

    def solve(
        self,
        segments: List[ItinerarySegment],
        preset: PresetConfig,
        random_seed: Optional[int] = None
    ) -> DiffractionResult:
        if random_seed is not None:
            random.seed(random_seed)

        n = len(segments)
        if n == 0:
            return DiffractionResult(
                preset_used=preset.id,
                total_distance_m=0.0,
                segment_count=0,
                assignments=[],
                module_counts={},
                module_proportions={}
            )

        total_distance = sum(s.distance for s in segments)

        # 1. Determine active modules and their effective constraints
        enabled_modules: List[str] = []
        for mid, w in preset.weights.items():
            mid_clean = mid.lower()
            if w > 0 and mid_clean in self.modules:
                enabled_modules.append(mid_clean)

        # Ensure at least texte_clair exists as safe fallback
        if not enabled_modules:
            enabled_modules = ["texte_clair"] if "texte_clair" in self.modules else list(self.modules.keys())[:1]

        # Compute max allowed occurrences per module for this itinerary length
        max_allowed: Dict[str, int] = {}
        for mid in enabled_modules:
            meta = self.modules[mid]
            c = meta.constraints
            overrides = preset.overrides.get(mid, {})

            # Proportion ceiling
            prop = overrides.get("max_proportion", c.max_proportion)
            # Calculated limit: at least 1 if proportion > 0, otherwise strictly bounded
            limit_by_prop = max(1, math.floor(n * prop + 1e-6))

            # Occurrences ceiling
            limit_by_occ = overrides.get("max_occurrences", c.max_occurrences)
            if limit_by_occ is not None:
                effective_limit = min(limit_by_prop, limit_by_occ)
            else:
                effective_limit = limit_by_prop

            # If preset weight is 0 or module is explicitly disabled
            if preset.weights.get(mid, 0) <= 0:
                effective_limit = 0

            max_allowed[mid] = effective_limit

        # 2. Backtracking CSP loop
        assignments: List[Optional[str]] = [None] * n
        backtrack_count = 0
        tried_at_pos: List[Set[str]] = [set() for _ in range(n)]
        pos = 0
        fallback_count = 0
        fallbacks_used: List[bool] = [False] * n

        while pos < n:
            seg = segments[pos]
            is_last_third = (pos >= (2 * n) // 3)

            # Build candidate list for this position
            candidates: List[Tuple[str, float]] = []

            # Check consecutive category history
            recent_categories = []
            for p_idx in range(max(0, pos - 3), pos):
                assigned_mid = assignments[p_idx]
                if assigned_mid:
                    recent_categories.append(self.modules[assigned_mid].category.value)

            prev_module = assignments[pos - 1] if pos > 0 else None

            # Special trigger: High POI density forces or heavily favors texte_clair
            is_high_poi = (seg.poi_density > 3.0 or seg.poi_count >= 4)

            for mid in enabled_modules:
                if mid in tried_at_pos[pos]:
                    continue

                meta = self.modules[mid]
                c = meta.constraints
                overrides = preset.overrides.get(mid, {})

                # Count already assigned
                current_count = sum(1 for a in assignments[:pos] if a == mid)
                limit = max_allowed.get(mid, n)
                if current_count >= limit:
                    continue

                # Hard Rule 1: Non-consecutive check
                allow_consec = overrides.get("allow_consecutive", c.allow_consecutive)
                if not allow_consec and prev_module == mid:
                    continue

                # Hard Rule 2: Consecutive category ceiling (e.g. max 3 crypted_message)
                max_cat_consec = overrides.get("max_consecutive_same_category", c.max_consecutive_same_category)
                if len(recent_categories) >= max_cat_consec:
                    if all(cat == meta.category.value for cat in recent_categories[-max_cat_consec:]):
                        continue

                # Hard Rule 3: Forbidden zones
                forbidden = set(c.forbidden_zones)
                if is_last_third and "last_third_of_track" in forbidden:
                    continue
                if is_high_poi and "high_poi_density" in forbidden:
                    continue

                # Hard Rule 4: Distance bounds
                min_d = overrides.get("min_distance_m", c.min_distance_m)
                max_d = overrides.get("max_distance_m", c.max_distance_m)
                if seg.distance < min_d:
                    continue
                if max_d is not None and seg.distance > max_d:
                    continue

                # Hard Rule 5: Vigenère Cooldown
                if prev_module == "vigenere" and meta.category == ModuleCategory.CRYPTED_MESSAGE:
                    # Require a visual/map pause after Vigenère
                    continue

                # Calculate selection weight
                base_w = preset.weights.get(mid, meta.base_weight)
                if base_w <= 0:
                    continue

                # Dynamic quota decay: remaining capacity / limit
                rem_capacity = max(1, limit - current_count)
                weight = base_w * (rem_capacity / limit)

                # Priority overrides
                if is_high_poi and mid == "texte_clair":
                    weight *= 10.0
                if prev_module == "vigenere" and mid in ("carte_ign", "texte_clair"):
                    weight *= 5.0

                candidates.append((mid, max(0.1, weight)))

            # Decision logic: candidate available vs impasse
            if candidates:
                # Weighted probabilistic selection
                weights = [c[1] for c in candidates]
                chosen_mid = random.choices([c[0] for c in candidates], weights=weights, k=1)[0]

                assignments[pos] = chosen_mid
                tried_at_pos[pos].add(chosen_mid)
                pos += 1
            else:
                # Impasse encountered!
                if backtrack_count < self.MAX_BACKTRACK_ATTEMPTS and pos > 0:
                    # Backtrack to pos - 1
                    backtrack_count += 1
                    assignments[pos] = None
                    tried_at_pos[pos].clear()
                    pos -= 1
                else:
                    # Backtrack limit reached or pos 0: Execute Deterministic Safe Fallback
                    fallback_mid = self._resolve_deterministic_fallback(
                        prev_module=prev_module,
                        is_last_third=is_last_third,
                        is_high_poi=is_high_poi,
                        current_counts={m: sum(1 for a in assignments[:pos] if a == m) for m in self.modules},
                        max_allowed=max_allowed,
                        enabled_modules=enabled_modules
                    )
                    assignments[pos] = fallback_mid
                    fallbacks_used[pos] = True
                    fallback_count += 1
                    pos += 1

        # 3. Post-process into StepAssignments (with contiguous segment aggregation where identical)
        step_assignments: List[StepAssignment] = []
        step_num = 1
        curr_mid = assignments[0]
        curr_start = 0
        curr_count = 1
        curr_dist = segments[0].distance
        curr_azi = segments[0].azimut
        curr_poi = segments[0].poi_name
        curr_fallback = fallbacks_used[0]

        for i in range(1, n):
            m = assignments[i]
            # Group if identical module and allowed
            meta_m = self.modules.get(m)
            can_merge = bool(m == curr_mid and meta_m and meta_m.constraints.allow_consecutive)

            if can_merge:
                curr_count += 1
                curr_dist += segments[i].distance
                curr_fallback = curr_fallback or fallbacks_used[i]
            else:
                step_assignments.append(StepAssignment(
                    step_number=step_num,
                    module_id=curr_mid,
                    start_index=curr_start,
                    segment_count=curr_count,
                    distance_m=curr_dist,
                    azimut=curr_azi,
                    poi_info=curr_poi,
                    fallback_used=curr_fallback
                ))
                step_num += 1
                curr_mid = m
                curr_start = i
                curr_count = 1
                curr_dist = segments[i].distance
                curr_azi = segments[i].azimut
                curr_poi = segments[i].poi_name
                curr_fallback = fallbacks_used[i]

        step_assignments.append(StepAssignment(
            step_number=step_num,
            module_id=curr_mid,
            start_index=curr_start,
            segment_count=curr_count,
            distance_m=curr_dist,
            azimut=curr_azi,
            poi_info=curr_poi,
            fallback_used=curr_fallback
        ))

        # Compute summary counts & proportions per segment
        module_counts: Dict[str, int] = {}
        for a in assignments:
            module_counts[a] = module_counts.get(a, 0) + 1

        module_proportions = {mid: count / n for mid, count in module_counts.items()}

        warnings = []
        if fallback_count > 0:
            warnings.append(f"Deterministic fallback applied on {fallback_count} segment(s) to guarantee resolution.")

        return DiffractionResult(
            preset_used=preset.id,
            total_distance_m=total_distance,
            segment_count=n,
            assignments=step_assignments,
            module_counts=module_counts,
            module_proportions=module_proportions,
            fallback_count=fallback_count,
            warnings=warnings
        )

    def _resolve_deterministic_fallback(
        self,
        prev_module: Optional[str],
        is_last_third: bool,
        is_high_poi: bool,
        current_counts: Dict[str, int],
        max_allowed: Dict[str, int],
        enabled_modules: List[str]
    ) -> str:
        """
        Deterministic, robust fallback selection guaranteed to never cycle indefinitely,
        strictly avoid repeating the previous module, and respect max occurrence ceilings.
        """
        # 1. First attempt: Find an enabled module != prev_module that has not reached limit
        eligible_enabled = [
            m for m in enabled_modules
            if m != prev_module and current_counts.get(m, 0) < max_allowed.get(m, 9999)
        ]
        if eligible_enabled:
            # Prefer texte_clair or carte_ign
            if "texte_clair" in eligible_enabled:
                return "texte_clair"
            if "carte_ign" in eligible_enabled and not is_last_third:
                return "carte_ign"
            return eligible_enabled[0]

        # 2. Second attempt: Check neutral modules != prev_module that have NOT reached limit
        neutral_pool = ["carte_simple", "carte_ign", "texte_clair", "gilwell", "polybe", "templier", "drapeaux"]
        for cand in neutral_pool:
            if cand in self.modules and cand != prev_module:
                limit = max_allowed.get(cand, 9999)
                if current_counts.get(cand, 0) < limit:
                    if cand in ("carte_simple", "carte_ign") and is_last_third:
                        continue
                    return cand

        # 3. Third attempt: Any module in the entire registry != prev_module that has not reached limit
        for cand in self.modules.keys():
            if cand != prev_module:
                limit = max_allowed.get(cand, 9999)
                if current_counts.get(cand, 0) < limit:
                    return cand

        # 4. Absolute last resort: texte_clair
        return "texte_clair"
