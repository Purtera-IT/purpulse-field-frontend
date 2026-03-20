# TechPulse Azure Database Master Documentation

This document is the deep-reference map for TechPulse in Azure: structure, data points, metrics, embeddings, models, and exact mapping surfaces.

## 1) Architecture Contract (Source-of-Truth)

- Flow: `raw/core -> features -> metrics -> embeddings -> models -> serving/API`
- Rule: business metrics are independent from embeddings unless metric is explicitly similarity/embedding class.
- Rule: preserve universal (`U_*`) vs domain (`D_*`) separation end-to-end.
- Rule: preserve PIT safety (`as_of_date`, `label_cut_ts`, event-time windows).
- Rule: event-sourced step-level telemetry is append-first at the raw/core edges.

## 2) Blueprint Object Inventory (Azure Storage Blueprint)

- `bronze_raw`: 12 objects
- `gold_feature`: 6 objects
- `gold_label`: 1 objects
- `serving`: 5 objects
- `silver_bridge`: 1 objects
- `silver_dim`: 6 objects
- `silver_fact`: 14 objects
- `training_set`: 4 objects

## 3) Implemented Runtime Schemas (DEV/STAGING)

- `core`: 17 tables
- `feature`: 8 tables
- `serving`: 16 tables

### `core` tables
- `core.dim_job`
- `core.dim_site`
- `core.dim_technician`
- `core.dim_technician_credential`
- `core.dim_technician_tool_inventory`
- `core.fact_arrival_event`
- `core.fact_artifact_event`
- `core.fact_closeout_event`
- `core.fact_dispatch_event`
- `core.fact_domain_tool_log`
- `core.fact_escalation_event`
- `core.fact_feedback_event`
- `core.fact_job_context_field`
- `core.fact_qc_event`
- `core.fact_runbook_step_event`
- `core.fact_tool_check_event`
- `core.fact_travel_event`

### `feature` tables
- `feature.fact_job_outcome`
- `feature.fact_technician_domain_state_daily`
- `feature.fact_technician_skill_state_daily`
- `feature.feature_build_audit`
- `feature.feature_build_watermark`
- `feature.feature_recipe_catalog`
- `feature.gold_job_context_snapshot`
- `feature.gold_tech_profile_prior`

### `serving` tables
- `serving.embedding_model_registry`
- `serving.fact_job_tech_fit_score`
- `serving.job_embedding_slice_cache`
- `serving.job_tech_interaction_embedding_cache`
- `serving.model_output_registry`
- `serving.serving_model_explanation_cache`
- `serving.tech_calibrated_candidate_cache`
- `serving.tech_embedding_slice_cache`
- `serving.tech_ranking_score_snapshot`
- `serving.tech_rerank_candidate_cache`
- `serving.tech_retrieval_candidate_cache`
- `serving.tech_risk_score_snapshot`
- `serving.tech_skill_score_snapshot`
- `serving.techpulse_metric_definition`
- `serving.techpulse_metric_snapshot_long`
- `serving.techpulse_power_card_metric_catalog`

## 4) Data Point Catalog Coverage

- Total feature/data-point recipes loaded: **3187**

### Recipe distribution by catalog/state

- `domain_operational_metric` + `domain_state`: 1568
- `yaml_scope_field` + `job_context`: 933
- `universal_operational_metric` + `universal_state`: 640
- `current_profile_field` + `universal_state`: 43
- `current_profile_field` + `none`: 3

### Full data point catalog file

- `docs\Models\04_TechPulse\TechPulse_Azure_DataPoint_Catalog.csv`

Columns included:
- `metric_or_field_id`, `display_name`, `catalog_group`, `state_group`, `primary_embedding_target`
- `recommended_raw_table`, `recommended_feature_table`, `recommended_serving_table`
- `feature_type`, `observation_window`, `candidate_supervised_heads`, `model_component`, `serving_role`, `ui_role`, `definition`

## 5) Power Card Metrics Catalog

- Total card metrics loaded: **88**

### Derivation class distribution (from power card source)

- `aggregate`: 15
- `multilabel model`: 10
- `risk model`: 8
- `aggregate/model`: 4
- `heuristic`: 4
- `SQL aggregate`: 3
- `domain skill score`: 3
- `embedding similarity`: 3
- `explanation`: 3
- `pair ranking + risk`: 3
- `step model`: 3
- `OOD model`: 2
- `calibration`: 2
- `trend model`: 2
- `Bayesian aggregate`: 1
- `OOD / rule`: 1
- `adapter score`: 1
- `aggregate/regression`: 1
- `calibration model`: 1
- `commercial aggregate`: 1
- `commercial risk`: 1
- `doc risk model`: 1
- `embedding + outcomes`: 1
- `embedding + rules`: 1
- `embedding / classifier`: 1
- `heuristic + calibrator`: 1
- `heuristic + classifier`: 1
- `heuristic threshold`: 1
- `pair ranking`: 1
- `quality model`: 1
- `regression -> risk`: 1
- `rule`: 1
- `rule + ML count`: 1
- `rules`: 1
- `similarity`: 1
- `similarity model`: 1
- `thresholded domain scores`: 1

## 6) Model Catalog (Blueprint)

- Total model blueprints loaded: **28**
- Full model catalog file: `docs\Models\04_TechPulse\TechPulse_Azure_Model_Catalog.csv`

## 7) Data Point -> Model Mapping

Mapping logic uses feature recipe fields (`candidate_supervised_heads`, `model_component`, definitions) and model blueprint/input map keywords.

- Full mapping file: `docs\Models\04_TechPulse\TechPulse_Azure_DataPoint_Model_Mapping.csv`
- Key columns:
  - `metric_or_field_id`
  - `primary_embedding_target`
  - `recommended_*_table` (raw/feature/serving)
  - `candidate_supervised_heads`, `model_component`
  - `mapped_models`

## 8) How Data Flows to Models (Operational Map)

- **Eligibility/Gating**: `core.dim_technician*`, `core.dim_job`, `core.fact_job_context_field` -> eligibility outputs in serving fit/explanations.
- **Trust Composer**: `feature.fact_technician_skill_state_daily` + `feature.fact_technician_domain_state_daily` + outcomes/calibration -> trust decomposition.
- **Risk/Quality Heads**: dispatch/travel/arrival/runbook/qc/artifact/escalation/feedback facts -> risk scores in serving fit table.
- **Embeddings**: U/D/J features -> embedding caches (`serving.tech_embedding_slice_cache`, `serving.job_embedding_slice_cache`, interaction cache).
- **Ranking stack**: retrieval -> rerank -> calibration caches + snapshot scores (`serving.tech_ranking_score_snapshot`).

## 9) What To Track During First 2 Weeks of Field Execution

Minimum telemetry set to ensure model/feature warm-up:
- Offer/accept/decline/cancel events (`core.fact_dispatch_event`)
- Travel/arrival timing (`core.fact_travel_event`, `core.fact_arrival_event`)
- Step execution and blockers (`core.fact_runbook_step_event`)
- QC outcomes + rework (`core.fact_qc_event`)
- Artifact/documentation quality (`core.fact_artifact_event`, `core.fact_closeout_event`)
- Escalation/communications (`core.fact_escalation_event`)
- Feedback/CSAT (`core.fact_feedback_event`)
- Domain tool telemetry (`core.fact_domain_tool_log`, `core.fact_tool_check_event`)
- Job context snapshots (`core.fact_job_context_field`)

## 10) Alignment to Your Rules

- Fields can be sparse initially: **supported** (schema + mapping-first design).
- Data points are pre-organized to target tables and model components: **yes** (recipe + model map files).
- Models can train after telemetry accumulation (e.g., ~2 weeks): **yes**, baseline runtime exists; advanced heads improve as richer telemetry accumulates.
