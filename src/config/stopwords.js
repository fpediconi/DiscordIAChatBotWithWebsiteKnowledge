const STOPWORDS = new Set([
  // Conectores y palabras vacías comunes
  'que', 'como', 'es', 'cuando', 'donde', 'quien', 'cual', 'porque', 'para', 'por',
  'con', 'sin', 'del', 'al', 'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'a', 'en', 'y', 'o', 'u', 'ni', 'no', 'sí', 'ya', 'lo', 'le', 'les', 'me', 'te', 'se',
  'mi', 'mis', 'tu', 'tus', 'su', 'sus', 'nuestro', 'nuestra', 'nuestros', 'nuestras',
  'vuestro', 'vuestra', 'vuestros', 'vuestras',
  'mío', 'mía', 'míos', 'mías', 'tuyo', 'tuya', 'tuyos', 'tuyas', 'suyo', 'suya', 'suyos', 'suyas',
  'todo', 'todos', 'toda', 'todas', 'cada', 'algún', 'ningún', 'algo', 'nada', 'más', 'menos', 'muy',
  'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel', 'aquella', 'aquellos', 'aquellas',
  'entonces', 'luego', 'también', 'tampoco', 'incluso', 'aunque', 'mientras', 'siempre', 'nunca',
  'bien', 'mal', 'aquí', 'allí', 'allá', 'acá', 'ahora', 'antes', 'después',

  // Vulgaridades y puteadas comunes en español argentino
  'boludo', 'boluda', 'pelotudo', 'pelotuda', 'gordo', 'gorda', 'mogólico', 'mogólica',
  'idiota', 'imbécil', 'tarado', 'tarada', 'pelotudez', 'pelotudeces', 'mierda', 'carajo',
  'concha', 'pija', 'puto', 'puta', 'putita', 'reputo', 'reputa', 'reputísima', 'culiado',
  'culiada', 'chupala', 'chupame', 'ortiva', 'lpm', 'lpmqlp', 'hijo', 'hija', 'hdp', 'hijodeputa',
  'andate', 'andá', 'salame', 'gil', 'gila', 'forro', 'forra', 'cornudo', 'cornuda',
  'bobo', 'boba', 'zorra', 'zorro', 'lacra', 'rata', 'careta', 'mierdero', 'ñeri'
]);

export { STOPWORDS };