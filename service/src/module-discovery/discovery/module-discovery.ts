import { Type } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { KNOWN_BUSINESS_MODULES } from './module-registry';

interface DiscoveryOptions {
  envModules?: string;
}

function moduleName(m: Type): string {
  return (m as any).name || 'Unknown';
}

/**
 * Unwrap forwardRef(() => Module) to get the real class.
 */
function unwrapForwardRef(imp: any): any {
  if (typeof imp === 'object' && imp !== null && typeof imp.forwardRef === 'function') {
    return imp.forwardRef();
  }
  return imp;
}

/**
 * Read the NestJS @Module({ imports }) metadata from a class.
 * Returns the array of imported module types with forwardRef unwrapped.
 */
function getModuleImports(m: Type): Type[] {
  const raw: any[] = Reflect.getMetadata('imports', m) || [];
  return raw.map(unwrapForwardRef);
}

/**
 * Given the full set of business modules, return only the business-level
 * dependencies for a given module (exclude global/infra modules not in the set).
 */
function getBusinessDependencies(m: Type, businessSet: Set<Type>): Type[] {
  return getModuleImports(m).filter((dep) => businessSet.has(dep));
}

/**
 * Kahn's algorithm topological sort.
 * On cycle detection, warns and appends remaining modules at the end.
 */
function topologicalSort(modules: Type[]): Type[] {
  const moduleSet = new Set(modules);
  const inDegree = new Map<Type, number>();
  const adjacency = new Map<Type, Type[]>();

  for (const m of modules) {
    inDegree.set(m, 0);
    adjacency.set(m, []);
  }

  for (const m of modules) {
    const deps = getBusinessDependencies(m, moduleSet);
    for (const dep of deps) {
      adjacency.get(dep)!.push(m);
      inDegree.set(m, (inDegree.get(m) || 0) + 1);
    }
  }

  const queue: Type[] = [];
  for (const [m, degree] of inDegree) {
    if (degree === 0) queue.push(m);
  }

  const result: Type[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);
    for (const dependent of adjacency.get(current) || []) {
      const newDegree = (inDegree.get(dependent) || 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (result.length < modules.length) {
    const remaining = modules.filter((m) => !result.includes(m));
    console.warn(
      `[ModuleDiscovery] Circular dependency detected among: ${remaining.map(moduleName).join(', ')}. ` +
        `Appending them after sorted modules — NestJS forwardRef will handle resolution.`,
    );
    result.push(...remaining);
  }

  return result;
}

/**
 * Resolve transitive dependencies. Given a set of requested names,
 * compute the closure including all modules those need.
 */
function resolveWithDependencies(requested: Set<string>, allModules: Type[]): Type[] {
  const nameToModule = new Map<string, Type>();
  for (const m of allModules) {
    nameToModule.set(moduleName(m).toLowerCase(), m);
  }

  const result: Type[] = [];
  const visited = new Set<string>();

  function visit(name: string) {
    const key = name.toLowerCase();
    if (visited.has(key)) return;
    const m = nameToModule.get(key);
    if (!m) {
      console.warn(`[ModuleDiscovery] Unknown module: "${name}" — skipping.`);
      return;
    }
    visited.add(key);
    const deps = getBusinessDependencies(m, new Set(allModules));
    for (const dep of deps) {
      visit(moduleName(dep));
    }
    result.push(m);
  }

  for (const name of requested) {
    visit(name);
  }

  return result;
}

/**
 * Parse ENABLED_MODULES env var and filter the candidate list.
 */
function filterByEnv(modules: Type[], envStr: string | undefined): Type[] {
  if (!envStr || envStr.trim() === '') {
    return modules; // backward-compatible: load everything
  }

  const tokens = envStr.split(',').map((s) => s.trim()).filter(Boolean);

  const exclusions: string[] = [];
  const inclusions: string[] = [];

  for (const token of tokens) {
    if (token.startsWith('-')) {
      exclusions.push(token.slice(1));
    } else {
      inclusions.push(token);
    }
  }

  const hasAll = inclusions.some((t) => t.toLowerCase() === 'all');

  if (hasAll && exclusions.length === 0) {
    return modules;
  }

  if (hasAll && exclusions.length > 0) {
    const excludeLower = new Set(exclusions.map((e) => e.toLowerCase()));
    console.log(
      `[ModuleDiscovery] Loading all modules except: ${exclusions.join(', ')}`,
    );
    return modules.filter(
      (m) => !excludeLower.has(moduleName(m).toLowerCase()),
    );
  }

  // Specific modules requested — resolve transitive dependencies
  console.log(
    `[ModuleDiscovery] Loading requested modules: ${inclusions.join(', ')}`,
  );
  const resolved = resolveWithDependencies(new Set(inclusions), modules);

  // Apply exclusions on top (after dependency resolution — exclusion does NOT cascade)
  if (exclusions.length > 0) {
    const excludeLower = new Set(exclusions.map((e) => e.toLowerCase()));
    return resolved.filter(
      (m) => !excludeLower.has(moduleName(m).toLowerCase()),
    );
  }

  return topologicalSort(resolved);
}

/**
 * Scan src/modules/ directory for plug-and-play modules.
 * Returns module types found on the filesystem.
 */
function discoverModulesFromFilesystem(): Type[] {
  const modulesDir = path.resolve(__dirname, '../../modules');

  if (!fs.existsSync(modulesDir)) {
    return [];
  }

  const discovered: Type[] = [];
  const entries = fs.readdirSync(modulesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const moduleName = entry.name;
    const moduleFileBase = path.join(modulesDir, moduleName, `${moduleName}.module`);

    let mod: any;
    try {
      mod = require(moduleFileBase);
    } catch {
      // Module file doesn't exist or failed to load — skip silently
      continue;
    }

    // Walk exports to find the class decorated with @Module()
    for (const key of Object.keys(mod)) {
      const exported = mod[key];
      if (
        typeof exported === 'function' &&
        Reflect.getMetadata('imports', exported) !== undefined
      ) {
        discovered.push(exported);
        break;
      }
    }
  }

  return discovered;
}

/**
 * Entry point called from app.module.ts.
 * Discovers business modules from registry + filesystem, filters by env var,
 * and returns them in dependency order.
 */
export function resolveBusinessModules(options: DiscoveryOptions = {}): Type[] {
  const allModules = [
    ...KNOWN_BUSINESS_MODULES,
    ...discoverModulesFromFilesystem(),
  ];

  // Deduplicate by constructor name
  const seen = new Set<string>();
  const deduped: Type[] = [];
  for (const m of allModules) {
    const key = moduleName(m);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(m);
    }
  }

  const filtered = filterByEnv(deduped, options.envModules);
  const sorted = topologicalSort(filtered);

  console.log(
    `[ModuleDiscovery] Resolved ${sorted.length} business module(s): ` +
      sorted.map(moduleName).join(', '),
  );

  return sorted;
}
