/**
 * Project loader with per-process memo cache. Newsroom Open is single-tenant
 * — slug comes from PROJECT_SLUG env (default "newsroom"). For Layer 2 SaaS
 * this expands to per-domain lookup.
 */
import { cache } from "react";

import { getProjectBySlug } from "./db/queries";
import type { Project } from "./db/schema";

const SLUG = process.env.PROJECT_SLUG || "newsroom";

export const getCurrentProject = cache(async (): Promise<Project> => {
  const project = await getProjectBySlug(SLUG);
  if (!project) {
    throw new Error(`Project not found in DB: slug=${SLUG}. Did the installer run seed.py?`);
  }
  return project;
});

export const SUPPORTED_LOCALES = ["ru", "en", "es"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(s: string): s is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(s);
}
