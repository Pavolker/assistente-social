import { Type } from "@google/genai";

export interface StudyTask {
  id: string;
  title: string;
  topic: string;
  date: string;
  completed: boolean;
}

export interface Quote {
  text: string;
  author: string;
}

export const STUDY_TOPICS = [
  "Seguridade Social",
  "LOAS (Lei Orgânica da Assistência Social)",
  "ECA (Estatuto da Criança e do Adolescente)",
  "Estatuto do Idoso",
  "Fundamentos Éticos do Serviço Social",
  "Projeto Ético-Político",
  "Políticas Públicas",
  "Instrumentais Técnico-Operativos",
  "Saúde Mental e Serviço Social",
  "Direitos Humanos"
];

export const DAILY_QUOTES: Quote[] = [
  {
    text: "O Serviço Social tem na questão social o objeto de sua intervenção profissional.",
    author: "Iamamoto"
  },
  {
    text: "A ética é o que nos permite agir com liberdade e responsabilidade.",
    author: "Código de Ética Profissional"
  },
  {
    text: "A assistência social é direito do cidadão e dever do Estado.",
    author: "Constituição Federal de 1988"
  },
  {
    text: "Liberdade como valor ético central.",
    author: "Princípios Fundamentais"
  }
];
