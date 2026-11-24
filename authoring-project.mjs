import { readStandaloneTile } from "./artifacts.mjs";

export const tileSize = 32;
export const pencilRoute = "web-pencil";
const pixelCount = tileSize * tileSize;
const header = ["RPGTLKIT TILE", "2", "0", "1", "0"];
const validColor = color => Number.isInteger(color) && color >= 0 && color <= 0xffffff;
const hasText = value => typeof value === "string" && value.trim().length > 0;
const tags = value => Array.isArray(value) && value.every(hasText);
const version = value => Number.isSafeInteger(value) && value > 0;

function requireRecord(condition, message) {
  if (!condition) throw new Error(message);
}

function indexRecords(records, label, key = record => record.id) {
  requireRecord(Array.isArray(records), `Missing ${label} records.`);
  const index = new Map();
  for (const record of records) {
    requireRecord(record && hasText(record.id), `Invalid ${label} ID.`);
    const id = key(record);
    requireRecord(!index.has(id), `Duplicate ${label} identity: ${record.id}.`);
    index.set(id, record);
  }
  return index;
}

export function encodeTile(pixels) {
  requireRecord(pixels.length === pixelCount && Array.from(pixels).every(validColor),
    "Expected 1,024 opaque COLORREF pixels.");
  return [...header, ...pixels, ""].join("\r\n");
}

export function decodeTile(source) {
  requireRecord(typeof source === "string" && source.length <= 11000, "Missing or oversized embedded GPH.");
  const tile = readStandaloneTile(new TextEncoder().encode(source));
  requireRecord(tile.detail === 1 && !tile.compressed && tile.pixels.every(validColor),
    "Expected a raw, opaque, 32 × 32 true-color GPH.");
  return tile;
}

const requirementKey = ({ id, revision }) => JSON.stringify([id, revision]);

export function readProject(project) {
  requireRecord(project?.version === 1 && hasText(project.id) && hasText(project.title),
    "Expected a version 1 tile authoring project with an ID and title.");
  const goals = indexRecords(project.projectRequirements, "project requirement");
  const needs = indexRecords(project.assetRequirements, "asset requirement", requirementKey);
  const workItems = indexRecords(project.workItems, "work item");
  for (const goal of goals.values()) {
    requireRecord(hasText(goal.title), "A project requirement is missing its title.");
  }
  for (const need of needs.values()) {
    requireRecord(version(need.revision) && goals.has(need.projectRequirementId) &&
      hasText(need.title) && hasText(need.constraints) && hasText(need.acceptance),
    `Invalid asset requirement: ${need.id}.`);
  }
  for (const work of workItems.values()) {
    requireRecord(work.requirement && needs.has(requirementKey(work.requirement)) &&
      hasText(work.title) && hasText(work.brief) && hasText(work.acceptance) &&
      ["ready", "missing", "unverified"].includes(work.readiness),
    `Invalid work item: ${work.id}.`);
    const routes = indexRecords(work.routes, "production route");
    for (const route of routes.values()) {
      requireRecord(hasText(route.label) && tags(route.skills) && tags(route.tools),
        `Invalid route: ${route.id}.`);
    }
  }
  if (project.contributor != null) validateContributor(project.contributor);
  for (const variant of indexRecords(project.variants, "variant").values()) {
    const work = workItems.get(variant.workItemId);
    requireRecord(work && variant.requirement && requirementKey(work.requirement) === requirementKey(variant.requirement)
      && variant.routeId === pencilRoute && work.routes.some(route => route.id === variant.routeId)
      && hasText(variant.title), `Invalid assignment for variant ${variant.id}.`);
    const revisions = indexRecords(variant.revisions, "variant revision");
    requireRecord(revisions.size > 0, `Variant ${variant.id} has no revisions.`);
    const earlier = new Set();
    for (const revision of revisions.values()) {
      validateContributor(revision.contributor);
      requireRecord(revision.status === "proposed" && revision.source === "embedded-gph" &&
        revision.output === "embedded-gph", `Invalid submission for variant ${variant.id}.`);
      requireRecord(revision.basedOn === null ? earlier.size === 0 : earlier.has(revision.basedOn),
        `Invalid revision history for variant ${variant.id}.`);
      decodeTile(revision.gph);
      earlier.add(revision.id);
    }
  }
  return project;
}

function validateContributor(contributor) {
  requireRecord(hasText(contributor?.id) && hasText(contributor.name) &&
    tags(contributor.skills) && tags(contributor.tools),
  "Enter a contributor ID and name. Skills and tools may be left blank.");
}

export function workFit(work, contributor) {
  const supported = work.routes.filter(route => route.id === pencilRoute);
  if (!supported.length) return "No supported web pencil route";
  if (!contributor) return "Contributor fit unknown";
  const missing = supported.flatMap(route => [
    ...route.skills.filter(tag => !contributor.skills.includes(tag)).map(tag => `skill: ${tag}`),
    ...route.tools.filter(tag => !contributor.tools.includes(tag)).map(tag => `tool: ${tag}`),
  ]);
  return missing.length ? `Undeclared ${missing.join(", ")}` : "Suitable";
}

export function submitTile(project, { work, variant, basedOn, title, pixels, contributor, createId }) {
  validateContributor(contributor);
  requireRecord(hasText(title), "Enter a variant name.");
  const revision = {
    id: createId(), basedOn: basedOn ?? null, status: "proposed", contributor, tool: "Web tile pencil",
    toolVersion: 1, license: "unknown", createdAt: new Date().toISOString(),
    source: "embedded-gph", output: "embedded-gph", gph: encodeTile(pixels),
  };
  const candidate = variant
    ? { ...variant, revisions: [...variant.revisions, revision] }
    : {
        id: createId(), title, workItemId: work.id, requirement: { ...work.requirement },
        routeId: pencilRoute, revisions: [revision],
      };
  const variants = variant
    ? project.variants.map(entry => entry.id === variant.id ? candidate : entry)
    : [...project.variants, candidate];
  return { project: { ...project, contributor, variants }, candidate };
}
