import {validatePlan} from './planner.mjs';
const formats = {project:null, studio:'rpgtk-studio-planning-draft', scenarios:'rpgtk-studio-scenarios-draft', capabilities:'rpgtk-capability-ledger', intake:'rpgtk-owner-intake'};
export async function readPlan(manifestURL, fetcher = fetch) {
  const manifestAddress = new URL(manifestURL, globalThis.location?.href);
  async function read(url) {
    const response = await fetcher(url, {cache:'no-store'});
    if (!response.ok) throw Error(`Could not read ${url.pathname}: HTTP ${response.status}`);
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > 2_000_000) throw Error('Planning record exceeds the 2 MB limit.');
    let data; try { data = JSON.parse(text); } catch { throw Error(`Invalid JSON in ${url.pathname}`); }
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2,'0')).join('');
    return {data,digest,url:url.href};
  }
  if (!['http:', 'https:'].includes(manifestAddress.protocol)) throw Error('Serve the repository over HTTP; the view reads linked records.');
  const loadedManifest = await read(manifestAddress), manifest = loadedManifest.data;
  if (manifest.format !== 'rpgtk-planning-project' || manifest.version !== 1) throw Error('Unsupported project manifest.');
  const result = {manifest, manifestURL:manifestAddress.href, fingerprints:{manifest:loadedManifest.digest}, recordURLs:{}};
  for (const key of Object.keys(formats)) {
    const reference = manifest.records?.[key];
    if (!reference || typeof reference.path !== 'string') throw Error(`Missing ${key} reference.`);
    const url = new URL(reference.path, manifestAddress);
    if (url.origin !== manifestAddress.origin) throw Error('Linked planning records must share the manifest origin.');
    const record = await read(url);
    if (!/^[a-f0-9]{64}$/.test(reference.sha256 || '') || reference.sha256 !== record.digest) throw Error(`Content fingerprint mismatch for ${key}; update the source revision and manifest explicitly.`);
    const rev = key === 'project' ? record.data.planningRevision : record.data.revision;
    if (record.data.id !== reference.id || rev !== reference.revision) throw Error(`Stale ${key} reference: expected ${reference.id}@${reference.revision}.`);
    result[key] = record.data; result.fingerprints[key] = record.digest; result.recordURLs[key] = record.url;
  }
  if (manifest.id !== result.project.id || manifest.revision !== result.project.planningRevision) throw Error('Manifest/project identity mismatch.');
  validatePlan(result);
  return result;
}
