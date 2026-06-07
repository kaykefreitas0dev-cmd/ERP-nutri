// AUTO-GERADO — não editar à mão.
// Mapa de medida caseira por alimento TACO. Gramas por medida = valores
// OFICIAIS IBGE POF 2008-2009 (Tabela de Medidas Referidas), resolvidos
// deterministicamente da tabela oficial; a escolha de alimento+medida
// passou por curadoria + auditoria adversarial. Cada item é uma SUGESTÃO
// revisável pelo nutri; a gramagem continua o valor clínico autoritativo.

export interface FoodMeasureEntry {
  singular: string;
  plural: string;
  gramsPerUnit: number;
}

// Chave = MealItem.food.externalId (ex.: "TACO_001"). 441 alimentos.
export const FOOD_MEASURES_BY_EXTERNAL_ID: Record<string, FoodMeasureEntry> = {
  TACO_001: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Arroz, integral, cozido
  TACO_002: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Arroz, integral, cru
  TACO_007: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 15,
  }, // Aveia, flocos, crua
  TACO_008: { singular: "unidade", plural: "unidades", gramsPerUnit: 5 }, // Biscoito, doce, maisena
  TACO_009: { singular: "unidade", plural: "unidades", gramsPerUnit: 13 }, // Biscoito, doce, recheado com chocolate
  TACO_010: { singular: "unidade", plural: "unidades", gramsPerUnit: 13 }, // Biscoito, doce, recheado com morango
  TACO_011: { singular: "unidade", plural: "unidades", gramsPerUnit: 13 }, // Biscoito, doce, wafer, recheado de chocolate
  TACO_012: { singular: "unidade", plural: "unidades", gramsPerUnit: 13 }, // Biscoito, doce, wafer, recheado de morango
  TACO_013: { singular: "unidade", plural: "unidades", gramsPerUnit: 5 }, // Biscoito, salgado, cream cracker
  TACO_015: { singular: "fatia", plural: "fatias", gramsPerUnit: 80 }, // Bolo, pronto, aipim
  TACO_016: { singular: "fatia", plural: "fatias", gramsPerUnit: 60 }, // Bolo, pronto, chocolate
  TACO_017: { singular: "fatia", plural: "fatias", gramsPerUnit: 60 }, // Bolo, pronto, coco
  TACO_018: { singular: "fatia", plural: "fatias", gramsPerUnit: 60 }, // Bolo, pronto, milho
  TACO_019: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Canjica, branca, crua
  TACO_020: { singular: "concha", plural: "conchas", gramsPerUnit: 120 }, // Canjica, com leite integral
  TACO_021: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 4,
  }, // Cereais, milho, flocos, com sal
  TACO_022: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 4,
  }, // Cereais, milho, flocos, sem sal
  TACO_023: { singular: "concha", plural: "conchas", gramsPerUnit: 110 }, // Cereais, mingau, milho, infantil
  TACO_025: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 4,
  }, // Cereal matinal, milho
  TACO_026: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 4,
  }, // Cereal matinal, milho, açúcar
  TACO_027: { singular: "concha", plural: "conchas", gramsPerUnit: 110 }, // Creme de arroz, pó
  TACO_028: { singular: "concha", plural: "conchas", gramsPerUnit: 110 }, // Creme de milho, pó
  TACO_029: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 35,
  }, // Curau, milho verde
  TACO_033: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 12,
  }, // Farinha, de milho, amarela
  TACO_036: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Farinha, láctea, de cereais
  TACO_039: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Macarrão, instantâneo
  TACO_040: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Macarrão, trigo, cru
  TACO_041: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Macarrão, trigo, cru, com ovos
  TACO_043: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 35,
  }, // Milho, fubá, cru
  TACO_044: { singular: "espiga", plural: "espigas", gramsPerUnit: 100 }, // Milho, verde, cru
  TACO_045: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 24,
  }, // Milho, verde, enlatado, drenado
  TACO_047: { singular: "fatia", plural: "fatias", gramsPerUnit: 40 }, // Pamonha, barra para cozimento, pré-cozida
  TACO_048: { singular: "fatia", plural: "fatias", gramsPerUnit: 25 }, // Pão, aveia, forma
  TACO_050: { singular: "fatia", plural: "fatias", gramsPerUnit: 25 }, // Pão, glúten, forma
  TACO_051: { singular: "fatia", plural: "fatias", gramsPerUnit: 35 }, // Pão, milho, forma
  TACO_052: { singular: "fatia", plural: "fatias", gramsPerUnit: 25 }, // Pão, trigo, forma, integral
  TACO_055: { singular: "unidade", plural: "unidades", gramsPerUnit: 32 }, // Pastel, de carne, cru
  TACO_056: { singular: "unidade", plural: "unidades", gramsPerUnit: 32 }, // Pastel, de carne, frito
  TACO_057: { singular: "unidade", plural: "unidades", gramsPerUnit: 32 }, // Pastel, de queijo, cru
  TACO_058: { singular: "unidade", plural: "unidades", gramsPerUnit: 32 }, // Pastel, de queijo, frito
  TACO_062: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 35,
  }, // Polenta, pré-cozida
  TACO_063: { singular: "unidade", plural: "unidades", gramsPerUnit: 8 }, // Torrada, pão francês
  TACO_064: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 36,
  }, // Abóbora, cabotian, cozida
  TACO_065: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 36,
  }, // Abóbora, cabotian, crua
  TACO_066: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 36,
  }, // Abóbora, menina brasileira, crua
  TACO_067: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 36,
  }, // Abóbora, moranga, crua
  TACO_068: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 36,
  }, // Abóbora, moranga, refogada
  TACO_069: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 36,
  }, // Abóbora, pescoço, crua
  TACO_070: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Abobrinha, italiana, cozida
  TACO_071: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Abobrinha, italiana, crua
  TACO_072: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Abobrinha, italiana, refogada
  TACO_073: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Abobrinha, paulista, crua
  TACO_074: { singular: "folha", plural: "folhas", gramsPerUnit: 10 }, // Acelga, crua
  TACO_075: { singular: "folha", plural: "folhas", gramsPerUnit: 5 }, // Agrião, cru
  TACO_076: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 14.3,
  }, // Aipo, cru
  TACO_077: { singular: "folha", plural: "folhas", gramsPerUnit: 10 }, // Alface, americana, crua
  TACO_078: { singular: "folha", plural: "folhas", gramsPerUnit: 10 }, // Alface, crespa, crua
  TACO_079: { singular: "folha", plural: "folhas", gramsPerUnit: 10 }, // Alface, lisa, crua
  TACO_080: { singular: "folha", plural: "folhas", gramsPerUnit: 10 }, // Alface, roxa, crua
  TACO_082: { singular: "unidade", plural: "unidades", gramsPerUnit: 4.4 }, // Alho, cru
  TACO_084: { singular: "folha", plural: "folhas", gramsPerUnit: 12 }, // Almeirão, cru
  TACO_085: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Almeirão, refogado
  TACO_086: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 35,
  }, // Batata, baroa, cozida
  TACO_087: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 35,
  }, // Batata, baroa, crua
  TACO_088: { singular: "fatia", plural: "fatias", gramsPerUnit: 70 }, // Batata, doce, cozida
  TACO_089: { singular: "unidade", plural: "unidades", gramsPerUnit: 355 }, // Batata, doce, crua
  TACO_091: { singular: "unidade", plural: "unidades", gramsPerUnit: 140 }, // Batata, inglesa, cozida
  TACO_092: { singular: "unidade", plural: "unidades", gramsPerUnit: 140 }, // Batata, inglesa, crua
  TACO_093: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Batata, inglesa, frita
  TACO_094: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Batata, inglesa, sauté
  TACO_095: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Berinjela, cozida
  TACO_096: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Berinjela, crua
  TACO_097: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Beterraba, cozida
  TACO_098: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Beterraba, crua
  TACO_099: { singular: "unidade", plural: "unidades", gramsPerUnit: 3 }, // Biscoito, polvilho doce
  TACO_100: { singular: "ramo", plural: "ramos", gramsPerUnit: 60 }, // Brócolis, cozido
  TACO_101: { singular: "ramo", plural: "ramos", gramsPerUnit: 60 }, // Brócolis, cru
  TACO_102: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 100 }, // Cará, cozido
  TACO_103: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 100 }, // Cará, cru
  TACO_104: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Caruru, cru
  TACO_107: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 10,
  }, // Cebola, crua
  TACO_108: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 2.3,
  }, // Cebolinha, crua
  TACO_109: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 12,
  }, // Cenoura, cozida
  TACO_110: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 12,
  }, // Cenoura, crua
  TACO_111: { singular: "folha", plural: "folhas", gramsPerUnit: 12 }, // Chicória, crua
  TACO_112: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Chuchu, cozido
  TACO_113: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Chuchu, cru
  TACO_115: { singular: "folha", plural: "folhas", gramsPerUnit: 25 }, // Couve, manteiga, crua
  TACO_116: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Couve, manteiga, refogada
  TACO_117: { singular: "ramo", plural: "ramos", gramsPerUnit: 60 }, // Couve-flor, crua
  TACO_118: { singular: "ramo", plural: "ramos", gramsPerUnit: 60 }, // Couve-flor, cozida
  TACO_119: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Espinafre, Nova Zelândia, cru
  TACO_120: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Espinafre, Nova Zelândia, refogado
  TACO_121: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 16,
  }, // Farinha, de mandioca, crua
  TACO_122: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 16,
  }, // Farinha, de mandioca, torrada
  TACO_125: {
    singular: "colher de servir",
    plural: "colheres de servir",
    gramsPerUnit: 54,
  }, // Feijão, broto, cru
  TACO_126: { singular: "unidade", plural: "unidades", gramsPerUnit: 125 }, // Inhame, cru
  TACO_127: { singular: "unidade", plural: "unidades", gramsPerUnit: 26 }, // Jiló, cru
  TACO_128: { singular: "unidade", plural: "unidades", gramsPerUnit: 10 }, // Jurubeba, crua
  TACO_129: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 100 }, // Mandioca, cozida
  TACO_130: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 100 }, // Mandioca, crua
  TACO_132: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 100 }, // Mandioca, frita
  TACO_134: { singular: "unidade", plural: "unidades", gramsPerUnit: 25 }, // Maxixe, cru
  TACO_135: { singular: "folha", plural: "folhas", gramsPerUnit: 10 }, // Mostarda, folha, crua
  TACO_136: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Nhoque, batata, cozido
  TACO_138: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Palmito, juçara, em conserva
  TACO_139: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Palmito, pupunha, em conserva
  TACO_140: { singular: "unidade", plural: "unidades", gramsPerUnit: 20 }, // Pão, de queijo, assado
  TACO_141: { singular: "unidade", plural: "unidades", gramsPerUnit: 20 }, // Pão, de queijo, cru
  TACO_142: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Pepino, cru
  TACO_143: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Pimentão, amarelo, cru
  TACO_144: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Pimentão, verde, cru
  TACO_145: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Pimentão, vermelho, cru
  TACO_147: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 40,
  }, // Quiabo, cru
  TACO_148: { singular: "unidade", plural: "unidades", gramsPerUnit: 25 }, // Rabanete, cru
  TACO_149: { singular: "folha", plural: "folhas", gramsPerUnit: 26 }, // Repolho, branco, cru
  TACO_150: { singular: "folha", plural: "folhas", gramsPerUnit: 26 }, // Repolho, roxo, cru
  TACO_151: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Repolho, roxo, refogado
  TACO_152: { singular: "folha", plural: "folhas", gramsPerUnit: 6 }, // Rúcula, crua
  TACO_154: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Seleta de legumes, enlatada
  TACO_155: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Serralha, crua
  TACO_156: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Taioba, crua
  TACO_157: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Tomate, com semente, cru
  TACO_158: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Tomate, extrato
  TACO_159: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Tomate, molho industrializado
  TACO_161: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Tomate, salada
  TACO_162: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Vagem, crua
  TACO_163: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 45,
  }, // Abacate, cru
  TACO_164: { singular: "fatia", plural: "fatias", gramsPerUnit: 75 }, // Abacaxi, cru
  TACO_166: { singular: "unidade", plural: "unidades", gramsPerUnit: 50 }, // Abiu, cru
  TACO_168: { singular: "tigela", plural: "tigelas", gramsPerUnit: 202 }, // Açaí, polpa, congelada
  TACO_169: { singular: "unidade", plural: "unidades", gramsPerUnit: 12 }, // Acerola, crua
  TACO_171: { singular: "unidade", plural: "unidades", gramsPerUnit: 42 }, // Ameixa, calda, enlatada
  TACO_172: { singular: "unidade", plural: "unidades", gramsPerUnit: 42 }, // Ameixa, crua
  TACO_173: { singular: "unidade", plural: "unidades", gramsPerUnit: 42 }, // Ameixa, em calda, enlatada, drenada
  TACO_174: { singular: "unidade", plural: "unidades", gramsPerUnit: 227 }, // Atemóia, crua
  TACO_175: { singular: "unidade", plural: "unidades", gramsPerUnit: 75 }, // Banana, da terra, crua
  TACO_180: { singular: "unidade", plural: "unidades", gramsPerUnit: 75 }, // Banana, ouro, crua
  TACO_181: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Banana, pacova, crua
  TACO_182: { singular: "unidade", plural: "unidades", gramsPerUnit: 75 }, // Banana, prata, crua
  TACO_183: { singular: "unidade", plural: "unidades", gramsPerUnit: 91.2 }, // Cacau, cru
  TACO_184: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Cajá-Manga, cru
  TACO_186: { singular: "unidade", plural: "unidades", gramsPerUnit: 90 }, // Caju, cru
  TACO_187: { singular: "unidade", plural: "unidades", gramsPerUnit: 90 }, // Caju, polpa, congelada
  TACO_189: { singular: "unidade", plural: "unidades", gramsPerUnit: 110 }, // Caqui, chocolate, cru
  TACO_190: { singular: "unidade", plural: "unidades", gramsPerUnit: 75 }, // Carambola, crua
  TACO_191: { singular: "unidade", plural: "unidades", gramsPerUnit: 10 }, // Ciriguela, crua
  TACO_192: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Cupuaçu, cru
  TACO_193: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Cupuaçu, polpa, congelada
  TACO_194: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Figo, cru
  TACO_195: { singular: "unidade", plural: "unidades", gramsPerUnit: 60 }, // Figo, enlatado, em calda
  TACO_196: { singular: "fatia", plural: "fatias", gramsPerUnit: 70 }, // Fruta-pão, crua
  TACO_197: { singular: "unidade", plural: "unidades", gramsPerUnit: 170 }, // Goiaba, branca, com casca, crua
  TACO_198: { singular: "fatia", plural: "fatias", gramsPerUnit: 60 }, // Goiaba, doce em pasta
  TACO_200: { singular: "unidade", plural: "unidades", gramsPerUnit: 170 }, // Goiaba, vermelha, com casca, crua
  TACO_201: { singular: "unidade", plural: "unidades", gramsPerUnit: 227 }, // Graviola, crua
  TACO_202: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 56.8 }, // Graviola, polpa, congelada
  TACO_204: { singular: "bago", plural: "bagos", gramsPerUnit: 12 }, // Jaca, crua
  TACO_205: { singular: "unidade", plural: "unidades", gramsPerUnit: 40 }, // Jambo, cru
  TACO_206: { singular: "unidade", plural: "unidades", gramsPerUnit: 5 }, // Jamelão, cru
  TACO_207: { singular: "unidade", plural: "unidades", gramsPerUnit: 94 }, // Kiwi, cru
  TACO_209: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Laranja, baía, suco
  TACO_210: { singular: "gomo", plural: "gomos", gramsPerUnit: 18 }, // Laranja, da terra, crua
  TACO_211: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Laranja, da terra, suco
  TACO_212: { singular: "gomo", plural: "gomos", gramsPerUnit: 18 }, // Laranja, lima, crua
  TACO_213: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Laranja, lima, suco
  TACO_214: { singular: "gomo", plural: "gomos", gramsPerUnit: 18 }, // Laranja, pêra, crua
  TACO_215: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Laranja, pêra, suco
  TACO_217: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Laranja, valência, suco
  TACO_220: { singular: "unidade", plural: "unidades", gramsPerUnit: 84 }, // Limão, tahiti, cru
  TACO_221: { singular: "unidade", plural: "unidades", gramsPerUnit: 150 }, // Maçã, Argentina, com casca, crua
  TACO_222: { singular: "unidade", plural: "unidades", gramsPerUnit: 150 }, // Maçã, Fuji, com casca, crua
  TACO_224: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 57 }, //  Mamão, doce em calda, drenado
  TACO_225: { singular: "fatia", plural: "fatias", gramsPerUnit: 170 }, // Mamão, Formosa, cru
  TACO_226: { singular: "fatia", plural: "fatias", gramsPerUnit: 170 }, // Mamão, Papaia, cru
  TACO_227: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 57 }, //  Mamão verde, doce em calda, drenado
  TACO_228: { singular: "unidade", plural: "unidades", gramsPerUnit: 140 }, // Manga, Haden, crua
  TACO_229: { singular: "unidade", plural: "unidades", gramsPerUnit: 140 }, // Manga, Palmer, crua
  TACO_230: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 22,
  }, // Manga, polpa, congelada
  TACO_231: { singular: "unidade", plural: "unidades", gramsPerUnit: 140 }, // Manga, Tommy Atkins, crua
  TACO_232: { singular: "unidade", plural: "unidades", gramsPerUnit: 45 }, // Maracujá, cru
  TACO_233: { singular: "unidade", plural: "unidades", gramsPerUnit: 45 }, // Maracujá, polpa, congelada
  TACO_234: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Maracujá, suco concentrado, envasado
  TACO_235: { singular: "fatia", plural: "fatias", gramsPerUnit: 200 }, // Melancia, crua
  TACO_236: { singular: "fatia", plural: "fatias", gramsPerUnit: 90 }, // Melão, cru
  TACO_237: { singular: "unidade", plural: "unidades", gramsPerUnit: 135 }, // Mexerica, Murcote, crua
  TACO_238: { singular: "unidade", plural: "unidades", gramsPerUnit: 135 }, // Mexerica, Rio, crua
  TACO_239: { singular: "unidade", plural: "unidades", gramsPerUnit: 12 }, // Morango, cru
  TACO_240: { singular: "unidade", plural: "unidades", gramsPerUnit: 27 }, // Nêspera, crua
  TACO_241: { singular: "unidade", plural: "unidades", gramsPerUnit: 3.8 }, // Pequi, cru
  TACO_242: { singular: "unidade", plural: "unidades", gramsPerUnit: 130 }, // Pêra, Park, crua
  TACO_243: { singular: "unidade", plural: "unidades", gramsPerUnit: 130 }, // Pêra, Williams, crua
  TACO_244: { singular: "unidade", plural: "unidades", gramsPerUnit: 60 }, // Pêssego, Aurora, cru
  TACO_245: { singular: "unidade", plural: "unidades", gramsPerUnit: 60 }, // Pêssego, enlatado, em calda
  TACO_246: { singular: "unidade", plural: "unidades", gramsPerUnit: 60 }, // Pinha, crua
  TACO_247: { singular: "unidade", plural: "unidades", gramsPerUnit: 10 }, // Pitanga, crua
  TACO_249: { singular: "unidade", plural: "unidades", gramsPerUnit: 70 }, // Romã, crua
  TACO_250: { singular: "unidade", plural: "unidades", gramsPerUnit: 8.1 }, // Tamarindo, cru
  TACO_251: { singular: "unidade", plural: "unidades", gramsPerUnit: 135 }, // Tangerina, Poncã, crua
  TACO_252: { singular: "copo", plural: "copos", gramsPerUnit: 100 }, // Tangerina, Poncã, suco
  TACO_253: { singular: "unidade", plural: "unidades", gramsPerUnit: 11.7 }, // Tucumã, cru
  TACO_254: { singular: "unidade", plural: "unidades", gramsPerUnit: 33.3 }, // Umbu, cru
  TACO_255: { singular: "unidade", plural: "unidades", gramsPerUnit: 33.3 }, // Umbu, polpa, congelada
  TACO_256: { singular: "unidade", plural: "unidades", gramsPerUnit: 8 }, // Uva, Itália, crua
  TACO_257: { singular: "unidade", plural: "unidades", gramsPerUnit: 8 }, // Uva, Rubi, crua
  TACO_259: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 8,
  }, // Azeite, de dendê
  TACO_260: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 8,
  }, // Azeite, de oliva, extra virgem
  TACO_261: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 32,
  }, // Manteiga, com sal
  TACO_262: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 32,
  }, // Manteiga, sem sal
  TACO_263: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 32,
  }, // Margarina, com óleo hidrogenado, com sal (65% de lipídeos)
  TACO_264: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 32,
  }, // Margarina, com óleo hidrogenado, sem sal (80% de lipídeos)
  TACO_265: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 32,
  }, // Margarina, com óleo interesterificado, com sal (65%de lipídeos)
  TACO_266: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 32,
  }, // Margarina, com óleo interesterificado, sem sal (65% de lipídeos)
  TACO_272: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 8,
  }, // Óleo, de soja
  TACO_277: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 16,
  }, // Atum, conserva em óleo
  TACO_279: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 135 }, // Bacalhau, salgado, cru
  TACO_280: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Bacalhau, salgado, refogado
  TACO_282: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Cação, posta, cozida
  TACO_283: { singular: "filé", plural: "filés", gramsPerUnit: 120 }, // Cação, posta, crua
  TACO_284: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Camarão, Rio Grande, grande, cozido
  TACO_285: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Camarão, Rio Grande, grande, cru
  TACO_286: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Camarão, Sete Barbas, sem cabeça, com casca, frito
  TACO_287: { singular: "unidade", plural: "unidades", gramsPerUnit: 20 }, // Caranguejo, cozido
  TACO_291: { singular: "filé", plural: "filés", gramsPerUnit: 120 }, // Corvina de água doce, crua
  TACO_318: { singular: "unidade", plural: "unidades", gramsPerUnit: 41.5 }, // Sardinha, assada
  TACO_319: { singular: "unidade", plural: "unidades", gramsPerUnit: 41.5 }, // Sardinha, conserva em óleo
  TACO_320: { singular: "unidade", plural: "unidades", gramsPerUnit: 41.5 }, // Sardinha, frita
  TACO_321: { singular: "unidade", plural: "unidades", gramsPerUnit: 41.5 }, // Sardinha, inteira, crua
  TACO_323: { singular: "fatia", plural: "fatias", gramsPerUnit: 15 }, // Apresuntado
  TACO_326: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Carne, bovina, acém, moído, cozido
  TACO_327: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Carne, bovina, acém, moído, cru
  TACO_328: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, acém, sem gordura, cozido
  TACO_329: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, acém, sem gordura, cru
  TACO_330: { singular: "unidade", plural: "unidades", gramsPerUnit: 80 }, // Carne, bovina, almôndegas, cruas
  TACO_331: { singular: "unidade", plural: "unidades", gramsPerUnit: 80 }, // Carne, bovina, almôndegas, fritas
  TACO_332: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 35 }, // Carne, bovina, bucho, cozido
  TACO_333: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 35 }, // Carne, bovina, bucho, cru
  TACO_334: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, capa de contra-filé, com gordura, crua
  TACO_335: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, capa de contra-filé, com gordura, grelhada
  TACO_336: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, capa de contra-filé, sem gordura, crua
  TACO_337: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, capa de contra-filé, sem gordura, grelhada
  TACO_338: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 65 }, // Carne, bovina, charque, cozido
  TACO_339: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 65 }, // Carne, bovina, charque, cru
  TACO_340: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé, à milanesa
  TACO_341: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé de costela, cru
  TACO_342: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé de costela, grelhado
  TACO_343: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé, com gordura, cru
  TACO_344: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé, com gordura, grelhado
  TACO_345: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé, sem gordura, cru
  TACO_346: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, contra-filé, sem gordura, grelhado
  TACO_347: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 35 }, // Carne, bovina, costela, assada
  TACO_348: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 35 }, // Carne, bovina, costela, crua
  TACO_349: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, coxão duro, sem gordura, cozido
  TACO_350: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, coxão duro, sem gordura, cru
  TACO_351: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, coxão mole, sem gordura, cozido
  TACO_352: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, coxão mole, sem gordura, cru
  TACO_353: { singular: "fatia", plural: "fatias", gramsPerUnit: 90 }, // Carne, bovina, cupim, assado
  TACO_354: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, cupim, cru
  TACO_357: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Carne, bovina, filé mingnon, sem gordura, cru
  TACO_358: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Carne, bovina, filé mingnon, sem gordura, grelhado
  TACO_359: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, flanco, sem gordura, cozido
  TACO_360: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, flanco, sem gordura, cru
  TACO_361: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, fraldinha, com gordura, cozida
  TACO_362: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, fraldinha, com gordura, crua
  TACO_363: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, lagarto, cozido
  TACO_364: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, lagarto, cru
  TACO_365: { singular: "fatia", plural: "fatias", gramsPerUnit: 90 }, // Carne, bovina, língua, cozida
  TACO_366: { singular: "fatia", plural: "fatias", gramsPerUnit: 90 }, // Carne, bovina, língua, crua
  TACO_367: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, maminha, crua
  TACO_368: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, maminha, grelhada
  TACO_369: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, miolo de alcatra, sem gordura, cru
  TACO_370: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, miolo de alcatra, sem gordura, grelhado
  TACO_371: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, músculo, sem gordura, cozido
  TACO_372: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, músculo, sem gordura, cru
  TACO_373: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, paleta, com gordura, crua
  TACO_374: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, paleta, sem gordura, cozida
  TACO_375: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, paleta, sem gordura, crua
  TACO_376: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, patinho, sem gordura, cru
  TACO_377: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, patinho, sem gordura, grelhado
  TACO_378: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, peito, sem gordura, cozido
  TACO_379: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, peito, sem gordura, cru
  TACO_380: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, picanha, com gordura, crua
  TACO_381: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, picanha, com gordura, grelhada
  TACO_382: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, picanha, sem gordura, crua
  TACO_383: { singular: "bife", plural: "bifes", gramsPerUnit: 100 }, // Carne, bovina, picanha, sem gordura, grelhada
  TACO_384: {
    singular: "colher de servir",
    plural: "colheres de servir",
    gramsPerUnit: 28,
  }, // Carne, bovina, seca, cozida
  TACO_385: {
    singular: "colher de servir",
    plural: "colheres de servir",
    gramsPerUnit: 28,
  }, // Carne, bovina, seca, crua
  TACO_386: { singular: "unidade", plural: "unidades", gramsPerUnit: 50 }, // Coxinha de frango, frita
  TACO_387: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Croquete, de carne, cru
  TACO_388: { singular: "unidade", plural: "unidades", gramsPerUnit: 55 }, // Croquete, de carne, frito
  TACO_391: { singular: "unidade", plural: "unidades", gramsPerUnit: 40 }, // Frango, asa, com pele, crua
  TACO_392: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Frango, caipira, inteiro, com pele, cozido
  TACO_393: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Frango, caipira, inteiro, sem pele, cozido
  TACO_394: { singular: "unidade", plural: "unidades", gramsPerUnit: 5 }, // Frango, coração, cru
  TACO_395: { singular: "unidade", plural: "unidades", gramsPerUnit: 5 }, // Frango, coração, grelhado
  TACO_400: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 50,
  }, // Frango, fígado, cru
  TACO_401: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, filé, à milanesa
  TACO_402: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Frango, inteiro, com pele, cru
  TACO_403: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Frango, inteiro, sem pele, assado
  TACO_404: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Frango, inteiro, sem pele, cozido
  TACO_405: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Frango, inteiro, sem pele, cru
  TACO_406: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, peito, com pele, assado
  TACO_407: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, peito, com pele, cru
  TACO_408: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, peito, sem pele, cozido
  TACO_409: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, peito, sem pele, cru
  TACO_410: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, peito, sem pele, grelhado
  TACO_418: { singular: "gomo", plural: "gomos", gramsPerUnit: 60 }, // Lingüiça, frango, crua
  TACO_419: { singular: "gomo", plural: "gomos", gramsPerUnit: 60 }, // Lingüiça, frango, frita
  TACO_420: { singular: "gomo", plural: "gomos", gramsPerUnit: 60 }, // Lingüiça, frango, grelhada
  TACO_421: { singular: "gomo", plural: "gomos", gramsPerUnit: 60 }, // Lingüiça, porco, crua
  TACO_422: { singular: "gomo", plural: "gomos", gramsPerUnit: 60 }, // Lingüiça, porco, frita
  TACO_423: { singular: "gomo", plural: "gomos", gramsPerUnit: 60 }, // Lingüiça, porco, grelhada
  TACO_424: { singular: "fatia", plural: "fatias", gramsPerUnit: 15 }, // Mortadela
  TACO_427: { singular: "bife", plural: "bifes", gramsPerUnit: 70 }, // Porco, bisteca, crua
  TACO_428: { singular: "bife", plural: "bifes", gramsPerUnit: 70 }, // Porco, bisteca, frita
  TACO_429: { singular: "bife", plural: "bifes", gramsPerUnit: 70 }, // Porco, bisteca, grelhada
  TACO_430: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 25 }, // Porco, costela, assada
  TACO_431: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 25 }, // Porco, costela, crua
  TACO_432: { singular: "fatia", plural: "fatias", gramsPerUnit: 190 }, // Porco, lombo, assado
  TACO_433: { singular: "fatia", plural: "fatias", gramsPerUnit: 190 }, // Porco, lombo, cru
  TACO_435: { singular: "fatia", plural: "fatias", gramsPerUnit: 90 }, // Porco, pernil, assado
  TACO_436: { singular: "fatia", plural: "fatias", gramsPerUnit: 90 }, // Porco, pernil, cru
  TACO_438: { singular: "fatia", plural: "fatias", gramsPerUnit: 15 }, // Presunto, com capa de gordura
  TACO_439: { singular: "fatia", plural: "fatias", gramsPerUnit: 15 }, // Presunto, sem capa de gordura
  TACO_440: { singular: "unidade", plural: "unidades", gramsPerUnit: 50 }, // Quibe, assado
  TACO_441: { singular: "unidade", plural: "unidades", gramsPerUnit: 50 }, // Quibe, cru
  TACO_442: { singular: "unidade", plural: "unidades", gramsPerUnit: 50 }, // Quibe, frito
  TACO_443: { singular: "fatia", plural: "fatias", gramsPerUnit: 20 }, // Salame
  TACO_444: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 10 }, // Toucinho, cru
  TACO_445: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 10 }, // Toucinho, frito
  TACO_446: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Bebida láctea, pêssego
  TACO_447: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 15,
  }, // Creme de Leite
  TACO_448: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Iogurte, natural
  TACO_449: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Iogurte, natural, desnatado
  TACO_450: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Iogurte, sabor abacaxi
  TACO_451: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Iogurte, sabor morango
  TACO_452: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Iogurte, sabor pêssego
  TACO_453: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 15,
  }, // Leite, condensado
  TACO_454: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Leite, de cabra
  TACO_455: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Leite, de vaca, achocolatado
  TACO_456: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 10,
  }, // Leite, de vaca, desnatado, pó
  TACO_457: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Leite, de vaca, desnatado, UHT
  TACO_458: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Leite, de vaca, integral
  TACO_459: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 16,
  }, // Leite, de vaca, integral, pó
  TACO_460: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Leite, fermentado
  TACO_461: { singular: "fatia", plural: "fatias", gramsPerUnit: 30 }, // Queijo, minas, frescal
  TACO_462: { singular: "fatia", plural: "fatias", gramsPerUnit: 45 }, // Queijo, minas, meia cura
  TACO_467: { singular: "fatia", plural: "fatias", gramsPerUnit: 15 }, // Queijo, prato
  TACO_468: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Queijo, requeijão, cremoso
  TACO_469: { singular: "fatia", plural: "fatias", gramsPerUnit: 35 }, // Queijo, ricota
  TACO_471: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Café, infusão 10%
  TACO_472: {
    singular: "copo americano",
    plural: "copos americanos",
    gramsPerUnit: 150,
  }, // Cana, aguardente 1
  TACO_473: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Cana, caldo de
  TACO_474: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Cerveja, pilsen 2
  TACO_476: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Chá, mate, infusão 5%
  TACO_477: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Chá, preto, infusão 5%
  TACO_478: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Coco, água de
  TACO_479: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Refrigerante, tipo água tônica
  TACO_480: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Refrigerante, tipo cola
  TACO_481: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Refrigerante, tipo guaraná
  TACO_482: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Refrigerante, tipo laranja
  TACO_483: { singular: "copo", plural: "copos", gramsPerUnit: 240 }, // Refrigerante, tipo limão
  TACO_484: { singular: "unidade", plural: "unidades", gramsPerUnit: 65 }, // Omelete, de queijo
  TACO_485: { singular: "unidade", plural: "unidades", gramsPerUnit: 10 }, // Ovo, de codorna, inteiro, cru
  TACO_488: { singular: "unidade", plural: "unidades", gramsPerUnit: 45 }, // Ovo, de galinha, inteiro, cozido/10minutos
  TACO_489: { singular: "unidade", plural: "unidades", gramsPerUnit: 45 }, // Ovo, de galinha, inteiro, cru
  TACO_490: { singular: "unidade", plural: "unidades", gramsPerUnit: 45 }, // Ovo, de galinha, inteiro, frito
  TACO_491: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 16,
  }, // Achocolatado, pó
  TACO_492: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 24,
  }, // Açúcar, cristal
  TACO_493: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 19,
  }, // Açúcar, mascavo
  TACO_494: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 24,
  }, // Açúcar, refinado
  TACO_495: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 6.3 }, // Chocolate, ao leite
  TACO_496: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 6.3 }, // Chocolate, ao leite, com castanha do Pará
  TACO_497: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 6.3 }, // Chocolate, ao leite, dietético
  TACO_498: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 6.3 }, // Chocolate, meio amargo
  TACO_499: { singular: "unidade", plural: "unidades", gramsPerUnit: 70 }, // Cocada branca
  TACO_501: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 40,
  }, // Doce, de leite, cremoso
  TACO_502: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 34 }, // Geléia, mocotó, natural
  TACO_504: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 90 }, // Maria mole
  TACO_505: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 90 }, // Maria mole, coco queimado
  TACO_506: { singular: "fatia", plural: "fatias", gramsPerUnit: 60 }, // Marmelada
  TACO_507: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 15,
  }, // Mel, de abelha
  TACO_508: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 15,
  }, // Melado
  TACO_509: { singular: "unidade", plural: "unidades", gramsPerUnit: 35 }, // Quindim
  TACO_510: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 55 }, // Rapadura
  TACO_520: { singular: "unidade", plural: "unidades", gramsPerUnit: 4 }, // Azeitona, preta, conserva
  TACO_521: { singular: "unidade", plural: "unidades", gramsPerUnit: 4 }, // Azeitona, verde, conserva
  TACO_522: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Chantilly, spray, com gordura vegetal
  TACO_523: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Leite, de coco
  TACO_524: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 27,
  }, // Maionese, tradicional com ovos
  TACO_525: { singular: "unidade", plural: "unidades", gramsPerUnit: 100 }, // Acarajé
  TACO_526: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Arroz carreteiro
  TACO_527: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 21,
  }, // Baião de dois, arroz e feijão-de-corda
  TACO_532: { singular: "unidade", plural: "unidades", gramsPerUnit: 30 }, // Charuto, de repolho
  TACO_533: { singular: "fatia", plural: "fatias", gramsPerUnit: 135 }, // Cuscuz, de milho, cozido com sal
  TACO_534: { singular: "fatia", plural: "fatias", gramsPerUnit: 150 }, // Cuscuz, paulista
  TACO_535: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 20,
  }, // Cuxá, molho
  TACO_536: { singular: "concha", plural: "conchas", gramsPerUnit: 150 }, // Dobradinha
  TACO_539: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 17,
  }, // Feijão tropeiro mineiro
  TACO_540: { singular: "concha", plural: "conchas", gramsPerUnit: 225 }, // Feijoada
  TACO_541: { singular: "filé", plural: "filés", gramsPerUnit: 100 }, // Frango, com açafrão
  TACO_542: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Macarrão, molho bolognesa
  TACO_543: { singular: "concha", plural: "conchas", gramsPerUnit: 225 }, // Maniçoba
  TACO_544: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 35,
  }, // Quibebe
  TACO_545: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 38,
  }, // Salada, de legumes, com maionese
  TACO_546: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Salada, de legumes, cozida no vapor
  TACO_547: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Salpicão, de frango
  TACO_548: { singular: "concha", plural: "conchas", gramsPerUnit: 142 }, // Sarapatel
  TACO_551: { singular: "unidade", plural: "unidades", gramsPerUnit: 50 }, // Tapioca, com manteiga
  TACO_552: { singular: "concha", plural: "conchas", gramsPerUnit: 130 }, // Tucupi, com pimenta-de-cheiro
  TACO_553: { singular: "concha", plural: "conchas", gramsPerUnit: 130 }, // Vaca atolada
  TACO_554: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 25,
  }, // Vatapá
  TACO_557: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 17,
  }, // Amendoim, grão, cru
  TACO_558: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 16,
  }, // Amendoim, torrado, salgado
  TACO_559: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 30,
  }, // Ervilha, em vagem
  TACO_560: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 27,
  }, // Ervilha, enlatada, drenada
  TACO_561: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, carioca, cozido
  TACO_563: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, fradinho, cozido
  TACO_565: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, jalo, cozido
  TACO_567: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, preto, cozido
  TACO_568: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, preto, cru
  TACO_569: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, rajado, cozido
  TACO_571: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, rosinha, cozido
  TACO_572: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, rosinha, cru
  TACO_573: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, roxo, cozido
  TACO_574: { singular: "concha", plural: "conchas", gramsPerUnit: 140 }, // Feijão, roxo, cru
  TACO_575: { singular: "concha", plural: "conchas", gramsPerUnit: 120 }, // Grão-de-bico, cru
  TACO_577: { singular: "concha", plural: "conchas", gramsPerUnit: 160 }, // Lentilha, cozida
  TACO_578: { singular: "concha", plural: "conchas", gramsPerUnit: 160 }, // Lentilha, crua
  TACO_579: { singular: "unidade", plural: "unidades", gramsPerUnit: 30 }, // Paçoca, amendoim
  TACO_580: { singular: "unidade", plural: "unidades", gramsPerUnit: 17 }, // Pé-de-moleque, amendoim
  TACO_583: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 13,
  }, // Soja, extrato solúvel, pó
  TACO_587: { singular: "unidade", plural: "unidades", gramsPerUnit: 1 }, // Amêndoa, torrada, salgada
  TACO_588: { singular: "unidade", plural: "unidades", gramsPerUnit: 2.5 }, // Castanha-de-caju, torrada, salgada
  TACO_589: { singular: "unidade", plural: "unidades", gramsPerUnit: 4 }, // Castanha-do-Brasil, crua
  TACO_590: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 40 }, // Coco, cru
  TACO_591: { singular: "pedaço", plural: "pedaços", gramsPerUnit: 40 }, // Coco,  verde, cru
  TACO_594: {
    singular: "colher de sopa",
    plural: "colheres de sopa",
    gramsPerUnit: 13,
  }, // Linhaça, semente
  TACO_595: { singular: "unidade", plural: "unidades", gramsPerUnit: 4 }, // Pinhão, cozido
  TACO_596: { singular: "unidade", plural: "unidades", gramsPerUnit: 22.5 }, // Pupunha, cozida
  TACO_597: { singular: "unidade", plural: "unidades", gramsPerUnit: 5 }, // Noz, crua
};
