// Lee el set de module ids del catálogo vigente desde
// learnflow:catalog:fluentflow:v1 (lo estampa publishLearnFlowIntegration en
// cada publish). Sirve para filtrar content_ids huérfanos —módulos renombrados
// o eliminados en reorganizaciones del catálogo— que siguen viviendo en
// Supabase: upsert_progress_merge es monotónico, así que una fila completada
// nunca se borra sola desde el cliente.
//
// Sin este filtro el ciclo se auto-perpetúa: DeskFlow baja las filas huérfanas
// de Supabase al documento compartido -> projectionBootstrap las importa al
// store de Zustand -> syncEngine las vuelve a subir a Supabase.
//
// Devuelve null (no un set vacío) cuando la clave todavía no existe, para que
// quien llame haga fail-open y no descarte progreso legítimo en el primer
// arranque, antes de que App.tsx publique el catálogo.
const CATALOG_KEY = 'learnflow:catalog:fluentflow:v1';

export function readKnownModuleIds(): Set<string> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ids?: unknown };
    if (!Array.isArray(parsed?.ids) || parsed.ids.length === 0) return null;
    const ids = parsed.ids.filter((id): id is string => typeof id === 'string' && id.length > 0);
    return ids.length > 0 ? new Set(ids) : null;
  } catch {
    return null;
  }
}

/** Filtra ids fuera del catálogo vigente. Fail-open si el catálogo no cargó aún. */
export function filterToKnownModules<T>(entries: Array<[string, T]>): Array<[string, T]> {
  const knownIds = readKnownModuleIds();
  if (!knownIds) return entries;
  return entries.filter(([moduleId]) => knownIds.has(moduleId));
}
