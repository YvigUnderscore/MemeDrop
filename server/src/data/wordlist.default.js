// ============================================================
//  Liste de modération par défaut — POINT DE DÉPART.
//
//  Ce fichier existe pour BLOQUER des contenus interdits (racisme,
//  pornographie, harcèlement). Il est volontairement compact : la
//  modération réelle repose surtout sur :
//    - l'extension de cette liste par les admins (panel → paramètre
//      `bannedWords` de chaque channel, qui accepte mots et regex) ;
//    - la whitelist + les modérateurs humains ;
//    - le système de signalement.
//
//  Les termes ci-dessous sont normalisés par moderation.js (minuscules,
//  sans accents, leetspeak neutralisé). Inutile d'ajouter les variantes
//  d'espacement/répétition : elles sont gérées automatiquement.
// ============================================================

// Termes bannis de base. Étendez via le panel plutôt que d'éditer ce fichier.
// (Catégories : insultes racistes/discriminatoires notoires + sexuel explicite.)
export const BASE_BANNED = [
  // Discriminatoire (FR/EN) — bloqué par défaut :
  'nègre', 'negre', 'bougnoule', 'youpin', 'chinetoque', 'pédale', 'tapette', 'gouine',
  'nigger', 'faggot', 'retard', 'tranny', 'kike', 'chink', 'spic',
  // Sexuel explicite (FR/EN) — bloqué par défaut :
  'pornographie', 'zoophilie', 'pedophilie', 'pédophilie', 'inceste',
  'childporn', 'cp', 'gangbang', 'creampie', 'bukkake',
];

// Patterns (RegExp) pour catégories difficiles à lister mot à mot.
// Ils ciblent des expressions explicites, pas des mots isolés ambigus.
export const SEXUAL_PATTERNS = [
  /\b(child|kids?|minor|mineur\w*)\s*(porn|sex|nude|nu+es?)\b/i,
  /\b(rape|viol(er|ez|ons)?)\s+(her|him|them|la|le|les|elle)\b/i,
  /\bzoo?philia?\b/i,
  /\bbestialit[eé]\b/i,
];
