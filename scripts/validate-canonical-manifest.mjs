#!/usr/bin/env node
/**
 * Iteration 12–13: verify canonical_event_families.manifest.json — paths, schema event_name,
 * manifest envelope ⊆ schema required, named exports in src/lib emitters, and (strict schemas)
 * allowlist `*_PROPERTY_KEYS` ↔ JSON Schema `properties` key sets.
 * Run: npm run validate:canonical-manifest
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifestPath = join(root, 'Azure Analysis', 'canonical_event_families.manifest.json');

/** @param {string} name */
function exportConstPattern(name) {
  return new RegExp(`export const ${name}\\s*=`);
}

/** @param {string} name */
function exportFunctionPattern(name) {
  return new RegExp(`export (async )?function ${name}\\b`);
}

/**
 * @param {unknown} schema
 * @returns {string | null}
 */
function schemaEventNameConst(schema) {
  if (!schema || typeof schema !== 'object') return null;
  const props = schema.properties;
  if (!props || typeof props !== 'object' || !props.event_name) return null;
  const en = props.event_name;
  if (typeof en !== 'object' || en === null) return null;
  if (typeof en.const === 'string') return en.const;
  if (Array.isArray(en.enum) && en.enum.length === 1 && typeof en.enum[0] === 'string') {
    return en.enum[0];
  }
  return null;
}

/**
 * Parse `export const Name = [ 'a', 'b', ... ];` (flat string literals only).
 * @param {string} libSrc
 * @param {string} exportName
 * @returns {{ keys: string[] } | { error: string }}
 */
function parseAllowlistStringArray(libSrc, exportName) {
  if (!/^[A-Za-z0-9_]+$/.test(exportName)) {
    return { error: `invalid allowlist export name: ${exportName}` };
  }
  const marker = `export const ${exportName} = [`;
  const idx = libSrc.indexOf(marker);
  if (idx === -1) {
    return { error: `could not find ${marker}` };
  }
  const afterOpen = idx + marker.length;
  let depth = 1;
  let i = afterOpen;
  for (; i < libSrc.length; i++) {
    const c = libSrc[i];
    if (c === '[') depth += 1;
    else if (c === ']') {
      depth -= 1;
      if (depth === 0) {
        const inner = libSrc.slice(afterOpen, i);
        const keys = [];
        const strRe = /'([^'\\]*)'|"([^"\\]*)"/g;
        let m;
        while ((m = strRe.exec(inner)) !== null) {
          keys.push(m[1] !== undefined && m[1] !== '' ? m[1] : m[2]);
        }
        return { keys };
      }
    }
  }
  return { error: `unclosed array for ${exportName}` };
}

/**
 * @param {string[]} allow
 * @param {string[]} schemaKeys
 */
function diffSets(allow, schemaKeys) {
  const A = new Set(allow);
  const S = new Set(schemaKeys);
  const onlyAllow = [...A].filter((k) => !S.has(k)).sort();
  const onlySchema = [...S].filter((k) => !A.has(k)).sort();
  return { onlyAllow, onlySchema };
}

function main() {
  if (!existsSync(manifestPath)) {
    console.error('Missing manifest:', manifestPath);
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const errors = [];

  const techRefs = manifest.techpulse_refs ?? {};
  for (const [k, rel] of Object.entries(techRefs)) {
    if (typeof rel !== 'string') {
      errors.push(`techpulse_refs.${k}: expected string path`);
      continue;
    }
    const p = join(root, rel);
    if (!existsSync(p)) errors.push(`Missing techpulse_refs.${k}: ${rel}`);
  }

  const pipeline = manifest.ingestion_pipeline;
  if (pipeline && typeof pipeline === 'object') {
    for (const [key, spec] of Object.entries(pipeline)) {
      if (!spec || typeof spec !== 'object') {
        errors.push(`ingestion_pipeline.${key}: invalid entry`);
        continue;
      }
      const fpath = spec.path;
      const exp = spec.export ?? spec.exports;
      if (typeof fpath !== 'string') {
        errors.push(`ingestion_pipeline.${key}: missing path`);
        continue;
      }
      const abs = join(root, fpath);
      if (!existsSync(abs)) errors.push(`ingestion_pipeline.${key}: missing file ${fpath}`);
      else {
        const src = readFileSync(abs, 'utf8');
        const names = Array.isArray(exp) ? exp : typeof exp === 'string' ? [exp] : [];
        for (const n of names) {
          if (
            !exportConstPattern(n).test(src) &&
            !exportFunctionPattern(n).test(src)
          ) {
            errors.push(`ingestion_pipeline.${key}: ${fpath} missing export ${n}`);
          }
        }
      }
    }
  }

  const contract = manifest.ingestion_contract;
  const envelopeRequired =
    contract && Array.isArray(contract.envelope_required) ? contract.envelope_required : [];

  const factRe = /^core\.fact_[a-z0-9_]+$/;

  for (const f of manifest.families ?? []) {
    const label = f.event_name ?? '(unknown family)';
    if (!f.json_schema) errors.push(`Family ${label}: missing json_schema`);
    if (!f.lib) errors.push(`Family ${label}: missing lib`);
    if (f.fact_table && !factRe.test(f.fact_table)) {
      errors.push(`Family ${label}: fact_table "${f.fact_table}" should match ${factRe}`);
    }

    const schemaPath = f.json_schema ? join(root, f.json_schema) : '';
    const libPath = f.lib ? join(root, f.lib) : '';

    if (f.json_schema && !existsSync(schemaPath)) {
      errors.push(`Missing schema: ${f.json_schema}`);
    }
    if (f.lib && !existsSync(libPath)) {
      errors.push(`Missing lib: ${f.lib}`);
    }

    if (!existsSync(schemaPath) || !existsSync(libPath)) continue;

    let schema;
    try {
      schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    } catch (e) {
      errors.push(`Invalid JSON schema: ${f.json_schema}`);
      continue;
    }

    const constName = schemaEventNameConst(schema);
    if (!constName) {
      errors.push(`Schema ${f.json_schema}: properties.event_name must have const (or single-value enum)`);
    } else if (constName !== f.event_name) {
      errors.push(
        `Schema ${f.json_schema}: event_name is "${constName}" but manifest says "${f.event_name}"`
      );
    }

    const req = Array.isArray(schema.required) ? schema.required : [];
    for (const key of envelopeRequired) {
      if (!req.includes(key)) {
        errors.push(
          `Family ${label}: schema required[] must include ingestion envelope key "${key}" (per manifest)`
        );
      }
    }

    if (
      contract &&
      typeof contract.source_system_const === 'string' &&
      schema.properties &&
      schema.properties.source_system &&
      typeof schema.properties.source_system.const === 'string' &&
      schema.properties.source_system.const !== contract.source_system_const
    ) {
      errors.push(
        `Family ${label}: source_system const "${schema.properties.source_system.const}" !== ingestion_contract.source_system_const`
      );
    }

    const libSrc = readFileSync(libPath, 'utf8');
    const { allowlist_export, assert_export, primary_emit_export, additional_emit_exports } = f;

    if (allowlist_export && !exportConstPattern(allowlist_export).test(libSrc)) {
      errors.push(`Family ${label}: lib ${f.lib} missing export const ${allowlist_export}`);
    }
    if (assert_export && !exportFunctionPattern(assert_export).test(libSrc)) {
      errors.push(`Family ${label}: lib ${f.lib} missing export function ${assert_export}`);
    }
    if (primary_emit_export && !exportFunctionPattern(primary_emit_export).test(libSrc)) {
      errors.push(`Family ${label}: lib ${f.lib} missing export function ${primary_emit_export}`);
    }
    if (Array.isArray(additional_emit_exports)) {
      for (const ex of additional_emit_exports) {
        if (typeof ex !== 'string') continue;
        if (!exportFunctionPattern(ex).test(libSrc)) {
          errors.push(`Family ${label}: lib ${f.lib} missing additional_emit_exports function ${ex}`);
        }
      }
    }

    // Allowlist keys must match JSON Schema `properties` (strict payloads, additionalProperties: false)
    if (allowlist_export && schema.properties && typeof schema.properties === 'object') {
      const parsed = parseAllowlistStringArray(libSrc, allowlist_export);
      if ('error' in parsed) {
        errors.push(`Family ${label}: ${parsed.error}`);
      } else {
        const allowKeys = parsed.keys;
        const uniq = new Set(allowKeys);
        if (uniq.size !== allowKeys.length) {
          errors.push(`Family ${label}: ${allowlist_export} contains duplicate keys`);
        }
        const schemaKeys = Object.keys(schema.properties);
        const strict =
          schema.additionalProperties === false &&
          schema.type === 'object';
        if (strict) {
          const { onlyAllow, onlySchema } = diffSets(allowKeys, schemaKeys);
          if (onlyAllow.length || onlySchema.length) {
            errors.push(
              `Family ${label}: ${allowlist_export} must match schema properties exactly. ` +
                `onlyInAllowlist: [${onlyAllow.join(', ')}]; onlyInSchema: [${onlySchema.join(', ')}]`
            );
          }
        }
      }
    }
  }

  if (errors.length) {
    console.error('validate-canonical-manifest failed:\n' + errors.join('\n'));
    process.exit(1);
  }

  const extra =
    manifest.ingestion_pipeline && Object.keys(manifest.ingestion_pipeline).length
      ? '; ingestion_pipeline exports checked'
      : '';
  console.log(
    `OK: ${manifest.families.length} canonical families — schemas, libs, event_name const, envelope keys, exports, allowlists vs schema properties${extra}.`
  );
}

main();
