/**
 * business-data.js — Datos centralizados de los negocios
 */

const RESISTONE = {
  // Identificación
  name: 'Resistone Microcemento',
  razonSocial: 'Ipetel Adquisiciones S.L.',
  url: 'https://www.microcemento.org',
  
  // Contacto
  email: 'info@resistone.es', // Email que se registra en directorios
  email_verificacion: 'juanjomir@gmail.com', // Email donde llegan verificaciones (TEMPORAL - cambiar cuando crees resistone.microcemento@gmail.com)
  phone: '917528727',
  phone_formatted: '+34 917 528 727',
  
  // Ubicación
  address: 'C/ Carabaña, 32-3',
  city: 'Alcorcón',
  province: 'Madrid',
  zip: '28925',
  country: 'España',
  
  // Fiscal
  cif: 'B85123040',
  nif: '52987784Q', // DNI del administrador: Juan Jose Mir Bermejo
  
  // Administrador
  admin_nombre: 'Juan Jose',
  admin_apellidos: 'Mir Bermejo',
  admin_dni: '52987784Q',
  
  // Descripción
  description_short: 'Fabricantes de microcemento desde 2008. Especialistas en microcemento para suelos, paredes, baños y cocinas.',
  description_long: 'Resistone es fabricante de microcemento de alta calidad desde 2008, con más de 20 años de experiencia. Fabricamos el mejor producto del mercado gracias a un proceso de mejora continua, consiguiendo las más altas prestaciones y resistencias. Disponemos de una amplia gama de productos: listos al uso, Microcemento Epoxi, tradicional y Ecológico. Aplicables en suelos, paredes, muebles, baños, cocinas y exteriores. Cualquier color, sin juntas. Contamos con aplicadores propios con amplia experiencia. Showroom en Madrid.',
  
  // Categorización
  category: 'Reformas', // Categoría genérica que existe en todos los catálogos
  subcategory: 'Revestimientos',
  keywords: 'microcemento, microcemento Madrid, fabricantes microcemento, microcemento suelos, microcemento baños, microcemento cocinas, microcemento epoxi',
  
  // Empresa
  companySize: 'De 1 a 10 empleados',
  founded: '2008',
  employees: '1-10',
  
  // Redes sociales (añadir si existen)
  linkedin: '',
  instagram: '',
  twitter: '',
  facebook: '',
  youtube: '',
  
  // Credenciales
  username: 'resistone',
  password: 'Resistone2024!',
  
  // Multimedia (añadir rutas si existen)
  logo: '',
  images: [],
};

const RELIABLEAI = {
  // Identificación
  name: 'ReliableAI',
  razonSocial: 'Ipetel Adquisiciones S.L.',
  url: 'https://www.reliableai.net',
  
  // Contacto
  email: 'contact@reliableai.co', // Email que se registra en directorios
  email_verificacion: 'juanjomir@gmail.com', // Email donde llegan verificaciones (TEMPORAL - cambiar cuando crees reliableai.contact@gmail.com)
  phone: '',
  
  // Ubicación
  address: '',
  city: '',
  province: '',
  zip: '',
  country: 'Spain',
  
  // Fiscal
  cif: 'B85123040',
  
  // Descripción
  tagline: 'Multi-LLM research platform for reliable AI insights',
  description_short: 'Multi-LLM research platform that queries multiple AI models simultaneously and synthesizes results for more reliable insights.',
  description_long: 'ReliableAI is a multi-LLM research platform that queries multiple AI models simultaneously, compares responses in real-time, and synthesizes results for more reliable insights. Compare Claude, GPT, Gemini, Grok and more. Features include real-time comparison, debate mode, consensus analysis, and integrated web search.',
  
  // Categorización
  category: 'AI Tools',
  subcategory: 'Research & Analysis',
  keywords: 'AI, LLM, research, comparison, multi-model, Claude, GPT, Gemini, Grok, AI comparison, AI research',
  tags: 'AI, LLM, research, comparison, multi-model',
  
  // Producto
  pricing: 'Freemium',
  plan: 'Free',
  
  // Empresa
  companySize: 'De 1 a 10 empleados',
  employees: '1-10',
  
  // Redes sociales
  linkedin: '',
  instagram: '',
  twitter: '@reliableai',
  github: 'https://github.com/reliableai',
  
  // Credenciales
  username: 'reliableai',
  password: 'ReliableAI2024!',
  
  // Multimedia
  logo: '',
  images: [],
  screenshots: [],
};

module.exports = {
  RESISTONE,
  RELIABLEAI,
};
