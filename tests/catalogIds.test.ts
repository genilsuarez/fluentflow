// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { filterToKnownModules, readKnownModuleIds } from '../src/utils/catalogIds';

// catalogIds.ts es el filtro que impide reinstalar en Supabase módulos que ya no
// existen en el catálogo. Importa porque el ciclo se auto-perpetuaba: DeskFlow
// baja las filas huérfanas al documento compartido -> projectionBootstrap las
// importa al store -> syncEngine las vuelve a subir. Y activity_events es
// append-only (migración 003), así que lo que se sube desde acá solo se quita
// con una migración server-side.
//
// Contexto: docs/progress-counting-system.md

const CATALOG_KEY = 'learnflow:catalog:fluentflow:v1';

function seedCatalog(value: unknown): void {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(value));
}

describe('catalogIds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('readKnownModuleIds', () => {
    it('devuelve el set de ids del catálogo publicado', () => {
      seedCatalog({ totalContent: 2, ids: ['reading-a1', 'quiz-b2'] });
      const ids = readKnownModuleIds();
      expect(ids).toBeInstanceOf(Set);
      expect(ids?.has('reading-a1')).toBe(true);
      expect(ids?.size).toBe(2);
    });

    // null, no un set vacío: quien llama debe distinguir "catálogo desconocido"
    // de "catálogo sin módulos". Con un set vacío se descartaría todo.
    it('devuelve null cuando la clave no existe', () => {
      expect(readKnownModuleIds()).toBeNull();
    });

    it('devuelve null cuando la clave es del esquema viejo, sin ids', () => {
      seedCatalog({ totalContent: 330 });
      expect(readKnownModuleIds()).toBeNull();
    });

    it('devuelve null con ids vacío o JSON corrupto', () => {
      seedCatalog({ totalContent: 0, ids: [] });
      expect(readKnownModuleIds()).toBeNull();
      localStorage.setItem(CATALOG_KEY, 'no-es-json');
      expect(readKnownModuleIds()).toBeNull();
    });
  });

  describe('filterToKnownModules', () => {
    it('descarta los ids fuera del catálogo vigente', () => {
      seedCatalog({ totalContent: 2, ids: ['m1', 'm2'] });
      const filtered = filterToKnownModules([
        ['m1', { completed: true }],
        ['modulo-eliminado', { completed: true }],
        ['m2', { completed: true }],
      ]);
      expect(filtered.map(([id]) => id)).toEqual(['m1', 'm2']);
    });

    // Fail-open: en el primer arranque, antes de que App.tsx publique el
    // catálogo, filtrar borraría progreso legítimo del usuario.
    it('no filtra nada cuando el catálogo aún no cargó', () => {
      const entries: Array<[string, { completed: boolean }]> = [
        ['m1', { completed: true }],
        ['desconocido', { completed: true }],
      ];
      expect(filterToKnownModules(entries)).toHaveLength(2);
    });

    it('preserva el valor asociado, no solo la clave', () => {
      seedCatalog({ totalContent: 1, ids: ['m1'] });
      const [[id, value]] = filterToKnownModules([['m1', { bestScore: 88 }]]);
      expect(id).toBe('m1');
      expect(value).toEqual({ bestScore: 88 });
    });
  });
});
