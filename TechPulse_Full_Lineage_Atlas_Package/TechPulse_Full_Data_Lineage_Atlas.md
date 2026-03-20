# TechPulse Full Data Lineage Atlas

This atlas is the complete map for field app + data + ML teams.

It answers:

1. every storage object by zone/stage
2. every feature/data point and where it lives
3. every raw datapoint token and what it feeds
4. which models each datapoint maps to and why

---

## A) End-to-end flow contract

- `bronze_raw -> silver_dim/silver_fact -> gold_feature/gold_label -> training_set -> serving`
- Runtime implementation in app DB uses `core -> feature -> serving` with the same logical contract.
- Business metrics remain independent from embeddings except explicit similarity outputs.
- Universal and domain signals remain separate (`U_*`, `D_*`).

---

## B) Object counts by stage (from storage blueprint)

- `bronze_raw`: 12 objects
- `gold_feature`: 6 objects
- `gold_label`: 1 objects
- `serving`: 5 objects
- `silver_bridge`: 1 objects
- `silver_dim`: 6 objects
- `silver_fact`: 14 objects
- `training_set`: 4 objects

### Stage + schema breakdown

- `bronze_raw` / `bronze`: 12
- `gold_feature` / `gold`: 6
- `gold_label` / `gold`: 1
- `serving` / `serve`: 5
- `silver_bridge` / `silver`: 1
- `silver_dim` / `silver`: 6
- `silver_fact` / `silver`: 14
- `training_set` / `train`: 4

---

## C) Full raw datapoint inventory and mapping

- Unique raw datapoint tokens parsed from recipes: **260**
- Full dictionary file: `docs\Models\04_TechPulse\TechPulse_Raw_DataPoint_Dictionary_Exploded.csv`

Dictionary columns:
- `raw_datapoint`
- `recommended_raw_objects` (target landing objects)
- `derived_feature_ids` (which features this point contributes to)
- `mapped_models` (models downstream of those features)

---

## D) Full feature/data-point lineage

- Total feature/data-point rows: **3187**
- Full file: `docs\Models\04_TechPulse\TechPulse_Full_Feature_DataPoint_Lineage.csv`

Columns include:
- recipe id + display name
- catalog/state group (`universal`, `domain`, `yaml_scope`, `profile`)
- recommended raw/feature/serving tables
- required raw datapoints
- candidate supervised heads + model component
- mapped model names
- inferred signal shape (structured vs semi-structured/text)

---

## E) Full object lineage map

- Full object map file: `docs\Models\04_TechPulse\TechPulse_Full_Object_Lineage_Map.csv`
- Includes object grain, PKs, retention, refresh mode, feeds, and usage.

---

## F) Model alignment references

- Model catalog: `docs/Models/04_TechPulse/TechPulse_Azure_Model_Catalog.csv`
- Dataset/store -> model map: `docs/Models/04_TechPulse/TechPulse_Azure_Dataset_To_Model_Map.csv`
- Data point -> model map: `docs/Models/04_TechPulse/TechPulse_Azure_DataPoint_Model_Mapping.csv`

---

## G) How to use this with field app engineering

1. Start from `TechPulse_Raw_DataPoint_Dictionary_Exploded.csv`
   - for each field-app payload attribute, find `raw_datapoint` match and required object target.
2. Use `TechPulse_Full_Feature_DataPoint_Lineage.csv`
   - confirm what feature tables and serving tables that payload attribute drives.
3. Use model mapping files
   - verify exactly which models are impacted by missing/captured fields.
4. Prioritize event families with highest model fan-out first (dispatch/travel/arrival/runbook/qc/artifact/escalation/feedback/context).
