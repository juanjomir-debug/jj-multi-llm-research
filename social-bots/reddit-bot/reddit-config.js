/**
 * reddit-config.js — Configuración de cuentas y subreddits
 */

// Cuentas de Reddit (crear manualmente en reddit.com)
const ACCOUNTS = {
  reliableai: {
    username: 'reliableai_official', // Cambiar por tu cuenta real
    password: process.env.REDDIT_RELIABLEAI_PASSWORD,
    subreddits: [
      'artificial',
      'MachineLearning',
      'OpenAI',
      'ChatGPT',
      'ArtificialIntelligence',
      'LLM',
      'LocalLLaMA',
      'ClaudeAI',
      'Bard',
      'singularity',
      'Futurology',
      'technology',
      'programming',
      'learnmachinelearning',
      'datascience',
    ],
    keywords: [
      'compare llm',
      'multiple ai models',
      'claude vs gpt',
      'best ai tool',
      'ai comparison',
      'llm benchmark',
      'which ai is better',
      'ai research tool',
      'multi-model ai',
      'consensus ai',
    ],
    bio: 'Multi-LLM research platform | Compare Claude, GPT, Gemini & more',
    website: 'https://www.reliableai.net',
  },
  
  resistone: {
    username: 'resistone_microcemento', // Cambiar por tu cuenta real
    password: process.env.REDDIT_RESISTONE_PASSWORD,
    subreddits: [
      'HomeImprovement',
      'DIY',
      'InteriorDesign',
      'RoomPorn',
      'AmateurRoomPorn',
      'DesignMyRoom',
      'HomeDecorating',
      'Renovations',
      'Flooring',
      'Bathrooms',
      'Kitchens',
      'spain', // Para mercado español
      'madrid',
      'es', // España
    ],
    keywords: [
      'microcement',
      'microcemento',
      'concrete floor',
      'seamless floor',
      'bathroom renovation',
      'kitchen floor',
      'polished concrete',
      'resin floor',
      'continuous floor',
      'floor without joints',
    ],
    bio: 'Fabricantes de microcemento desde 2008 | Madrid, España',
    website: 'https://www.microcemento.org',
  },
};

// Estrategias de participación
const STRATEGIES = {
  // Responder a preguntas relevantes
  ANSWER_QUESTIONS: {
    enabled: true,
    maxPerDay: 5,
    minKarma: 10, // Solo responder en posts con mínimo karma
    responseStyle: 'helpful', // helpful, promotional, neutral
  },
  
  // Crear posts originales
  CREATE_POSTS: {
    enabled: true,
    maxPerWeek: 2,
    types: ['guide', 'showcase', 'discussion', 'question'],
  },
  
  // Comentar en posts populares
  ENGAGE_POPULAR: {
    enabled: true,
    maxPerDay: 3,
    minUpvotes: 50,
  },
  
  // Crosspost contenido propio
  CROSSPOST: {
    enabled: false, // Cuidado con spam
    maxPerWeek: 1,
  },
};

// Reglas anti-spam
const RULES = {
  // Esperar entre acciones
  minDelayBetweenActions: 300000, // 5 minutos
  maxDelayBetweenActions: 900000, // 15 minutos
  
  // Límites diarios
  maxCommentsPerDay: 10,
  maxPostsPerDay: 2,
  
  // Ratio de self-promotion
  maxSelfPromotionRatio: 0.1, // 10% de comentarios pueden mencionar tu producto
  
  // Karma mínimo antes de promocionar
  minKarmaToPromote: 100,
  
  // Edad de cuenta mínima
  minAccountAgeDays: 30,
  
  // Evitar detección
  varyResponseTime: true,
  humanizeText: true, // Usar GPT para hacer texto más natural
  avoidKeywordSpam: true,
};

// Templates de respuestas
const TEMPLATES = {
  reliableai: {
    helpful: [
      "I've been using {tool} for this. It lets you compare responses from multiple LLMs side by side, which is really helpful for {use_case}.",
      "Have you tried running your query through multiple models? I use {tool} to get consensus between Claude, GPT, and Gemini.",
      "For {use_case}, I'd recommend comparing outputs from different models. {tool} makes this easy.",
    ],
    showcase: [
      "Here's a comparison I did using {tool}: [screenshot/link]",
      "I ran this through multiple LLMs and the results were interesting: [details]",
    ],
  },
  
  resistone: {
    helpful: [
      "We've been working with microcement for over 15 years. For {use_case}, I'd recommend {solution}.",
      "Microcement is great for {use_case}. Key things to consider: {tips}",
      "As a microcement manufacturer, I can tell you that {advice}",
    ],
    showcase: [
      "Here's a recent project we did: [before/after photos]",
      "We just finished a {room} renovation with microcement: [details]",
    ],
  },
};

module.exports = {
  ACCOUNTS,
  STRATEGIES,
  RULES,
  TEMPLATES,
};
