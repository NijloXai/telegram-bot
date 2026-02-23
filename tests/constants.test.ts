import { describe, it, expect } from "vitest";
import {
  CLAUDE_MODEL,
  CLAUDE_MAX_TOKENS,
  MAX_HISTORY_MESSAGES,
  STREAM_EDIT_INTERVAL,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW,
  INACTIVITY_TIMEOUT,
  PROSPECT_COMPLETE_OPEN,
  PROSPECT_COMPLETE_CLOSE,
} from "../src/config/constants.js";

describe("constants", () => {
  it("CLAUDE_MODEL est un modele valide", () => {
    expect(CLAUDE_MODEL).toMatch(/^claude-/);
  });

  it("CLAUDE_MAX_TOKENS est 1024", () => {
    expect(CLAUDE_MAX_TOKENS).toBe(1024);
  });

  it("MAX_HISTORY_MESSAGES est 20", () => {
    expect(MAX_HISTORY_MESSAGES).toBe(20);
  });

  it("STREAM_EDIT_INTERVAL est 500ms", () => {
    expect(STREAM_EDIT_INTERVAL).toBe(500);
  });

  it("RATE_LIMIT_MAX est 3 messages", () => {
    expect(RATE_LIMIT_MAX).toBe(3);
  });

  it("RATE_LIMIT_WINDOW est 10 secondes", () => {
    expect(RATE_LIMIT_WINDOW).toBe(10_000);
  });

  it("INACTIVITY_TIMEOUT est 48 heures", () => {
    expect(INACTIVITY_TIMEOUT).toBe(48 * 60 * 60 * 1000);
  });

  it("les balises prospect sont coherentes", () => {
    expect(PROSPECT_COMPLETE_OPEN).toBe("[PROSPECT_COMPLETE]");
    expect(PROSPECT_COMPLETE_CLOSE).toBe("[/PROSPECT_COMPLETE]");
    expect(PROSPECT_COMPLETE_CLOSE).toContain(
      PROSPECT_COMPLETE_OPEN.replace("[", "[/"),
    );
  });
});

describe("extraction JSON des balises prospect", () => {
  const extractJson = (text: string): string | null => {
    const openIdx = text.indexOf(PROSPECT_COMPLETE_OPEN);
    const closeIdx = text.indexOf(PROSPECT_COMPLETE_CLOSE);
    if (openIdx !== -1 && closeIdx !== -1) {
      return text
        .slice(openIdx + PROSPECT_COMPLETE_OPEN.length, closeIdx)
        .trim();
    }
    return null;
  };

  const getVisibleText = (text: string): string => {
    const openIdx = text.indexOf(PROSPECT_COMPLETE_OPEN);
    const closeIdx = text.indexOf(PROSPECT_COMPLETE_CLOSE);
    if (openIdx !== -1 && closeIdx !== -1) {
      return (
        text.slice(0, openIdx) +
        text.slice(closeIdx + PROSPECT_COMPLETE_CLOSE.length)
      ).trim();
    }
    return text;
  };

  it("extrait le JSON entre les balises", () => {
    const text = 'Merci![PROSPECT_COMPLETE]{"nom":"Test"}[/PROSPECT_COMPLETE]';
    expect(extractJson(text)).toBe('{"nom":"Test"}');
  });

  it("retourne null sans balises", () => {
    expect(extractJson("Texte normal sans balises")).toBeNull();
  });

  it("retourne null avec balise ouvrante seule", () => {
    expect(extractJson("Texte[PROSPECT_COMPLETE]sans fermeture")).toBeNull();
  });

  it("filtre le JSON du texte visible", () => {
    const text =
      'Merci pour vos reponses![PROSPECT_COMPLETE]{"nom":"Test"}[/PROSPECT_COMPLETE]';
    expect(getVisibleText(text)).toBe("Merci pour vos reponses!");
  });

  it("retourne le texte complet sans balises", () => {
    const text = "Bonjour, comment puis-je vous aider?";
    expect(getVisibleText(text)).toBe(text);
  });

  it("gere le texte avant et apres les balises", () => {
    const text =
      'Avant[PROSPECT_COMPLETE]{"data":true}[/PROSPECT_COMPLETE] Apres';
    expect(getVisibleText(text)).toBe("Avant Apres");
  });
});
