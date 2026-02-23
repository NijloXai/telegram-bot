import { describe, it, expect } from "vitest";
import { extractProspectData, prospectSchema } from "../src/utils/validation.js";

const validProspect = {
  nom: "Иван Иванов",
  entreprise: "ООО Тест",
  type_projet: "site_vitrine",
  description: "Нужен сайт для компании",
  delais: "2 месяца",
  email: "ivan@test.com",
  whatsapp: "+79001234567",
  resume_texte: "Клиент хочет сайт-визитку для компании",
};

describe("prospectSchema", () => {
  it("valide un prospect complet", () => {
    const result = prospectSchema.safeParse(validProspect);
    expect(result.success).toBe(true);
  });

  it("valide un prospect avec champs null", () => {
    const result = prospectSchema.safeParse({
      nom: null,
      entreprise: null,
      type_projet: null,
      description: null,
      delais: null,
      email: null,
      whatsapp: null,
      resume_texte: "Резюме без данных",
    });
    expect(result.success).toBe(true);
  });

  it("rejette un type_projet invalide", () => {
    const result = prospectSchema.safeParse({
      ...validProspect,
      type_projet: "webapp_invalide",
    });
    expect(result.success).toBe(false);
  });

  it("accepte tous les types de projet valides", () => {
    const types = [
      "site_vitrine",
      "ecommerce",
      "application_web",
      "application_mobile",
      "landing_page",
      "refonte",
      "autre",
    ];
    for (const type of types) {
      const result = prospectSchema.safeParse({
        ...validProspect,
        type_projet: type,
      });
      expect(result.success, `type_projet "${type}" should be valid`).toBe(true);
    }
  });

  it("rejette si resume_texte manquant", () => {
    const { resume_texte: _, ...withoutResume } = validProspect;
    const result = prospectSchema.safeParse(withoutResume);
    expect(result.success).toBe(false);
  });

  it("rejette si resume_texte est null", () => {
    const result = prospectSchema.safeParse({
      ...validProspect,
      resume_texte: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("extractProspectData", () => {
  it("extrait les donnees d'un JSON valide", () => {
    const json = JSON.stringify(validProspect);
    const result = extractProspectData(json);
    expect(result).not.toBeNull();
    expect(result?.nom).toBe("Иван Иванов");
    expect(result?.type_projet).toBe("site_vitrine");
  });

  it("retourne null pour un JSON invalide", () => {
    const result = extractProspectData("not json at all");
    expect(result).toBeNull();
  });

  it("retourne null pour un JSON avec champs manquants", () => {
    const result = extractProspectData(JSON.stringify({ nom: "Test" }));
    expect(result).toBeNull();
  });

  it("retourne null pour un JSON avec type_projet invalide", () => {
    const result = extractProspectData(
      JSON.stringify({ ...validProspect, type_projet: "invalid" }),
    );
    expect(result).toBeNull();
  });

  it("retourne null pour une string vide", () => {
    const result = extractProspectData("");
    expect(result).toBeNull();
  });

  it("accepte un prospect avec tous les champs null sauf resume_texte", () => {
    const json = JSON.stringify({
      nom: null,
      entreprise: null,
      type_projet: null,
      description: null,
      delais: null,
      email: null,
      whatsapp: null,
      resume_texte: "Клиент отказался от предоставления данных",
    });
    const result = extractProspectData(json);
    expect(result).not.toBeNull();
    expect(result?.resume_texte).toBe("Клиент отказался от предоставления данных");
  });
});
