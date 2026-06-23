const en = {
  spinner: {
    connecting: 'Connecting to demo server…',
    parsing: 'Loading data in the browser…',
    parsingSubtitle: 'Your file is being read locally. Nothing is sent anywhere yet.',
    analyzing: 'Analyzing with metadata-first AI…',
    analyzingSubtitle: 'Only column names and statistics are shared with the AI — your actual data never leaves the browser.',
    rendering: 'Rendering…',
  },
  hero: {
    subtitle: 'Ask questions about your data in plain language — your data never leaves your device.',
  },
  pillars: [
    {
      title: 'Security by design',
      body: 'Raw rows never leave your browser. The AI receives only column names and statistics — your data stays entirely local, always.',
    },
    {
      title: 'Fixed price',
      body: 'Metadata-first means a few hundred tokens per query, regardless of dataset size. No raw data sent, no token waste, fully predictable costs.',
    },
    {
      title: 'Easy to deploy',
      body: 'Works with Gemini, GPT-4, Claude, or your own endpoint. Full privacy without a local model, GPU, or on-premise infrastructure.',
    },
  ],
  samples: [
    {
      title: 'Seattle Weather',
      description: 'Daily precipitation, temperature, wind and weather type recorded in Seattle over 4 years.',
    },
    {
      title: 'Bird Strikes',
      description: 'FAA aviation wildlife strike database: aircraft, airline, species, phase of flight, damage and repair cost.',
    },
    {
      title: 'Natural Disasters',
      description: 'Global disaster deaths by type and year from 1900 to 2020 — earthquakes, floods, droughts and more.',
    },
    {
      title: 'Gapminder',
      description: 'Income, life expectancy and population for 188 countries — the classic global development economics dataset.',
    },
  ],
  upload: {
    dropMessage: 'Drop a CSV or Excel file here',
    formats: 'Supports .csv, .xlsx, .xls',
    browse: 'Browse files',
    trySample: 'Or try a sample dataset →',
    useOwn: '← Use your own file',
    columns: (n: number) => `${n} columns`,
    statsLabel: (rows: number, cols: number) => `${rows.toLocaleString()} rows · ${cols} cols`,
  },
  footer: {
    rateLimit: (n: number) => `${n} AI requests/day per IP on this demo`,
    poweredBy: 'Powered by',
    contact: 'Contact us',
  },
  chat: {
    initialPrompt: 'Visualise this data comprehensively and tell me what kinds of analyses would be most insightful.',
    empty: 'Ask a question about your data.',
    placeholder: 'Ask something about your data…',
    disclaimer: 'Your data stays local — only column names and statistics are shared with the AI.',
    loadNewFile: 'Load a new file',
    viewRawData: 'View raw data',
    inspectFormula: 'Inspect generated formula',
    noResult: 'Ask a question to see the analysis here.',
    tabChat: 'Chat',
    tabResult: 'Result',
    rowCount: (n: number) => `${n} rows`,
    rowCountPreview: (shown: number, total: number) => `first ${shown} of ${total} rows`,
    startAnalysis: 'Start analysis',
  },
  errors: {
    parseFile: 'Could not read this file. Please make sure it is a valid CSV or Excel file.',
    emptyFile: 'This file appears to be empty.',
    connection: 'Could not connect to the demo server. Please try again later.',
    rateLimit: "You've reached the demo limit. Come back tomorrow, or host your own proxy with your own API key!",
    disabled: 'The demo is temporarily disabled. Please try again later.',
    unavailable: 'The demo AI service is temporarily unavailable. Please try again later.',
    generic: (msg: string) => `Error: ${msg}`,
  },
  formula: {
    title: 'Generated formula',
    copy: 'Copy',
    copied: '✓ Copied',
  },
}

type I18n = typeof en

const fr: I18n = {
  spinner: {
    connecting: 'Connexion au serveur de démonstration…',
    parsing: 'Chargement des données dans le navigateur…',
    parsingSubtitle: "Votre fichier est lu localement. Rien n'est encore envoyé nulle part.",
    analyzing: "Analyse avec l'IA metadata-first…",
    analyzingSubtitle: "Seuls les noms de colonnes et des statistiques sont partagés avec l'IA — vos données réelles ne quittent jamais le navigateur.",
    rendering: 'Rendu en cours…',
  },
  hero: {
    subtitle: 'Posez des questions sur vos données en langage naturel — vos données restent sur votre appareil.',
  },
  pillars: [
    {
      title: 'Sécurité by design',
      body: "Les données brutes ne quittent jamais votre navigateur. L'IA ne reçoit que les noms de colonnes et des statistiques — vos données restent entièrement locales.",
    },
    {
      title: 'Prix fixe',
      body: "L'approche metadata-first génère quelques centaines de tokens par requête, quelle que soit la taille du dataset. Pas de données brutes envoyées, coûts prévisibles.",
    },
    {
      title: 'Facile à déployer',
      body: "Compatible avec Gemini, GPT-4, Claude ou votre propre endpoint. Confidentialité totale sans modèle local, GPU ou infrastructure on-premise.",
    },
  ],
  samples: [
    {
      title: 'Météo Seattle',
      description: 'Relevés météo quotidiens de Seattle : précipitations, températures, vent et type de temps sur 4 ans.',
    },
    {
      title: 'Collisions Aviaires',
      description: 'Base FAA des collisions avec des oiseaux : appareil, compagnie, espèce, phase de vol, dommages et coûts de réparation.',
    },
    {
      title: 'Catastrophes Naturelles',
      description: 'Décès liés aux catastrophes naturelles par type et par année de 1900 à 2020 — tremblements de terre, inondations, sécheresses et plus.',
    },
    {
      title: 'Gapminder',
      description: 'Revenus, espérance de vie et population pour 188 pays — le jeu de données classique du développement mondial.',
    },
  ],
  upload: {
    dropMessage: 'Déposez un fichier CSV ou Excel ici',
    formats: 'Formats supportés : .csv, .xlsx, .xls',
    browse: 'Parcourir',
    trySample: 'Ou essayez un jeu de données exemple →',
    useOwn: '← Utiliser votre propre fichier',
    columns: (n: number) => `${n} colonnes`,
    statsLabel: (rows: number, cols: number) => `${rows.toLocaleString()} lignes · ${cols} col.`,
  },
  footer: {
    rateLimit: (n: number) => `${n} requêtes IA par jour et par IP sur cette démo`,
    poweredBy: 'Propulsé par',
    contact: 'Nous contacter',
  },
  chat: {
    initialPrompt: 'Visualise ces données de façon complète et dis-moi quelles analyses seraient les plus pertinentes.',
    empty: 'Posez une question sur vos données.',
    placeholder: 'Posez une question sur vos données…',
    disclaimer: "Vos données restent locales — seuls les noms de colonnes et les statistiques sont partagés avec l'IA.",
    loadNewFile: 'Charger un nouveau fichier',
    viewRawData: 'Voir les données brutes',
    inspectFormula: 'Inspecter la formule générée',
    noResult: "Posez une question pour voir l'analyse ici.",
    tabChat: 'Chat',
    tabResult: 'Résultat',
    rowCount: (n: number) => `${n} lignes`,
    rowCountPreview: (shown: number, total: number) => `${shown} premières lignes sur ${total}`,
    startAnalysis: 'Lancer l\'analyse',
  },
  errors: {
    parseFile: 'Impossible de lire ce fichier. Vérifiez qu\'il s\'agit d\'un fichier CSV ou Excel valide.',
    emptyFile: 'Ce fichier semble être vide.',
    connection: 'Impossible de se connecter au serveur de démonstration. Veuillez réessayer plus tard.',
    rateLimit: 'Vous avez atteint la limite de la démo. Revenez demain, ou hébergez votre propre proxy avec votre propre clé API !',
    disabled: 'La démo est temporairement désactivée. Veuillez réessayer plus tard.',
    unavailable: 'Le service IA de la démo est temporairement indisponible. Veuillez réessayer plus tard.',
    generic: (msg: string) => `Erreur : ${msg}`,
  },
  formula: {
    title: 'Formule générée',
    copy: 'Copier',
    copied: '✓ Copié',
  },
}

// `?lang=` (set by the marketing site when launching the demo) wins over the
// browser language, so the demo matches the language the visitor was reading in.
const _urlLang = new URLSearchParams(window.location.search).get('lang')
const _isFr = _urlLang ? _urlLang.toLowerCase().startsWith('fr') : navigator.language.startsWith('fr')
export const i18n: I18n = _isFr ? fr : en
