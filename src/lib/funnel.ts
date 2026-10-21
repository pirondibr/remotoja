export type FunnelAnswer = string | string[];

export type FunnelStep =
  | {
      id: string;
      kind: "intro" | "value" | "matches" | "paywall";
      progress: number;
      headline: string;
      subheadline?: string;
      cta: string;
      badges?: string[];
      bullets?: string[];
      note?: string;
    }
  | {
      id: string;
      kind: "single" | "multi";
      progress: number;
      headline: string;
      subheadline?: string;
      options: string[];
      cta: string;
    }
  | {
      id: string;
      kind: "text";
      progress: number;
      headline: string;
      subheadline?: string;
      placeholder: string;
      cta: string;
    }
  | {
      id: string;
      kind: "contact";
      progress: number;
      headline: string;
      subheadline?: string;
      cta: string;
    };

export const FUNNEL_STEPS: FunnelStep[] = [
  {
    id: "intro",
    kind: "intro",
    progress: 5,
    headline: "Descubra vagas remotas que ainda não estão no LinkedIn",
    subheadline:
      "Escaneamos as páginas de carreira das empresas várias vezes ao dia para encontrar vagas remotas novas cedo, incluindo vagas que nunca chegam ao LinkedIn.",
    cta: "Continuar",
    badges: ["100% remoto", "Vagas verificadas", "Brasil + LATAM"],
  },
  {
    id: "work_type",
    kind: "multi",
    progress: 15,
    headline: "Que tipo de vaga você busca?",
    subheadline: "Pode marcar mais de uma",
    options: ["100% remoto", "Híbrido", "Presencial ocasional"],
    cta: "Próximo",
  },
  {
    id: "happiness",
    kind: "value",
    progress: 22,
    headline: "Bom saber.",
    subheadline:
      "Quem trabalha remoto no Brasil relata mais equilíbrio e menos tempo perdido no deslocamento.",
    bullets: [
      "Mais controle da rotina",
      "Menos estresse de trânsito",
      "~1h/dia economizada em média",
    ],
    cta: "Continuar",
  },
  {
    id: "search_time",
    kind: "single",
    progress: 32,
    headline: "Há quanto tempo você está buscando?",
    subheadline: "Isso ajuda a calibrar o ritmo das recomendações",
    options: ["Acabei de começar", "Algumas semanas", "Alguns meses", "Mais de um ano"],
    cta: "Próximo",
  },
  {
    id: "pain",
    kind: "multi",
    progress: 42,
    headline: "Qual a parte mais difícil da busca?",
    subheadline: "Pode marcar mais de uma",
    options: [
      "Não recebo retorno",
      "Não sei onde as vagas realmente estão",
      "Poucas entrevistas",
      "Muita concorrência no LinkedIn",
      "Ainda não sei",
    ],
    cta: "Próximo",
  },
  {
    id: "hidden",
    kind: "value",
    progress: 52,
    headline: "Não é (só) você.",
    subheadline:
      "Uma fatia grande das vagas remotas no Brasil nunca chega ao LinkedIn. Fica em Gupy, paginas de carreiras internas e portais nichados.",
    bullets: [
      "~1/3 das vagas nunca vão para o LinkedIn",
      "Quem aplica cedo compete com bem menos gente",
      "Nós agregamos essas fontes antes da saturação",
    ],
    cta: "Quero ver as vagas ocultas",
  },
  {
    id: "salary",
    kind: "single",
    progress: 62,
    headline: "Qual faixa salarial você busca?",
    subheadline: "Em reais, por mês (CLT ou PJ equivalente)",
    options: [
      "Até R$ 4 mil",
      "R$ 4–7 mil",
      "R$ 7–12 mil",
      "R$ 12–20 mil",
      "R$ 20 mil+",
    ],
    cta: "Próximo",
  },
  {
    id: "location",
    kind: "single",
    progress: 72,
    headline: "De onde você está?",
    subheadline: "Mostramos vagas compatíveis com sua região e fuso",
    options: [
      "Brasil, remoto",
      "Brasil, aceito híbrido na minha cidade",
      "LATAM, remoto",
      "Mundial, remoto (inglês ok)",
    ],
    cta: "Próximo",
  },
  {
    id: "seniority",
    kind: "single",
    progress: 80,
    headline: "Qual seu nível atual?",
    options: [
      "Estágio / Júnior",
      "Pleno (3–5 anos)",
      "Sênior (5+ anos)",
      "Especialista / Liderança",
      "Freelance / PJ",
    ],
    cta: "Próximo",
  },
  {
    id: "headstart",
    kind: "value",
    progress: 88,
    headline: "A Minha Vaga Remota te coloca na frente.",
    subheadline: "Enquanto outros ainda não viram a vaga, você já pode se candidatar.",
    bullets: [
      "Vaga publicada → detectamos em minutos",
      "Você aplica cedo",
      "A massa do LinkedIn chega dias depois",
    ],
    cta: "Quero essa vantagem",
  },
  {
    id: "role",
    kind: "contact",
    progress: 94,
    headline: "Última pergunta: seus dados e o cargo",
    subheadline:
      "Nome, e-mail e um cargo — só um por busca, para as vagas não se misturarem.",
    cta: "Encontrar minhas vagas",
  },
  {
    id: "matches",
    kind: "matches",
    progress: 98,
    headline: "Encontramos vagas para o seu perfil",
    subheadline: "Prévia com base nas suas respostas. O feed completo libera no plano.",
    cta: "Ver meus matches",
  },
  {
    id: "paywall",
    kind: "paywall",
    progress: 100,
    headline: "Aviso rápido",
    subheadline:
      "Nossos scrapers rodam o tempo todo. Por isso a Minha Vaga Remota é um produto pago: você é o cliente, não as empresas.",
    cta: "Acessar todas as vagas",
    note: "Pagamento único · Cartão ou Pix · 7 dias de garantia",
  },
];

export const PLANS = [
  {
    id: "access",
    name: "Acesso às vagas",
    priceLabel: "R$ 29,90",
    period: "",
    detail: "Pagamento único. Sem mensalidade.",
    savings: null,
    popular: true,
  },
] as const;
