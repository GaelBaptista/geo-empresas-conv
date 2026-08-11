export interface DayDetails {
  label: string;
  message?: string;
  code?: string;
}
export interface MonthData {
  name: string;
  birthdays: Record<number, DayDetails>;
  days: Record<number, DayDetails>; // Mensagens específicas para cada dia do mês
  specials: Record<number, DayDetails>;
  daysInMonth: (year: number) => number;
  payments?: Record<number, DayDetails>;
  stateHolidays?: Record<number, DayDetails>;
}

export const months: MonthData[] = [
  {
    name: "Janeiro",
    stateHolidays: {
      6: {
        label: "(Dia de Reis) Feriado Municipal de Natal (RN)",
        message:
          "Hoje celebramos o Dia de Reis. Que seja um dia de reflexão e alegria!",
      },
    },
    payments: {
  
    },
    birthdays: {
      8: {
        label: "Aniversário de Empresa: Daniela 🎂",
        message:
          "Parabéns por mais um ano de Empresa, Daniela! Que seu novo ano seja cheio de alegrias, realizações e muitos motivos para sorrir!",
      },
      6: {
        label: "Aniversário de Empresa: Johnatan e Mayara ",
        message:
          "Parabéns a todos por mais um ano de Empresa! Que este novo ciclo seja repleto de sucesso, saúde e muitas conquistas!",
      },
      9: {
        label: "Aniversário: Isac 🎂",
        message:
          "Parabéns Isac pelo seu aniversário! 🎂🎉 Que seu dia seja repleto de alegria e celebração!",
      },
    },
    specials: {
      1: {
        label: "Ano Novo e Confraternização Universal",
        message: "Que este novo ano traga paz, saúde e muitas realizações!",
      },
    },
    days: {
      1: { label: "Vamos começar o ano com energia! ✨" },
      2: { label: "Hora de traçar metas para o ano." },
      3: { label: "Dia de foco no planejamento!" },
      4: { label: "Mantenha o ritmo e seja produtivo." },
      5: { label: "Faça algo novo hoje." },
      6: { label: "Parabéns a todos por mais um ano de Empresa! Que este novo ciclo seja repleto de sucesso, saúde e muitas conquistas!" },
      7: { label: "Vamos continuar nossa jornada com otimismo!" },
      8: { label: "Parabéns por mais um ano de Empresa, Daniela! Que seu novo ano seja cheio de alegrias, realizações e muitos motivos para sorrir!" },
      9: { label: "Parabéns, Luiza e Camila, pelo aniversário de empresa! 🎉👏 Que essa trajetória continue sendo de muito sucesso, crescimento e realizações. Vocês fazem a diferença na equipe! 🚀" },
      10: { label: "Dia ideal para reflexão e meditação." },
      11: { label: "Trabalhe com dedicação e persistência." },
      12: { label:  "Tenha um bom dia!" },
      13: { label: "Faça hoje o que você postergou ontem." },
      14: { label: "Vença seus medos, seja corajoso!" },
      15: { label: "É hora de colocar os planos em prática." },
      16: { label: "Encontre alegria nas pequenas coisas." },
      17: { label: "O sucesso começa com um passo de cada vez." },
      18: { label: "Acredite no seu potencial." },
      19: { label: "Hoje é um bom dia para começar algo grande!" },
      20: { label: "Encontre equilíbrio entre trabalho e descanso." },
      21: { label: "Seja grato pelo que você tem." },
      22: { label: "Cuide de sua saúde física e mental." },
      23: { label: "Dia perfeito para conectar com pessoas especiais." },
      24: { label: "Não desista, o sucesso está mais perto do que imagina!" },
      25: { label: "Aproveite os bons momentos da vida." },
      26: { label: "Diga sim às novas oportunidades!" },
      27: { label: "Mantenha o foco e a determinação." },
      28: { label: "Reflita sobre as suas conquistas." },
      29: { label: "Vença o dia com criatividade e coragem." },
      30: { label: "Não tenha medo de falhar, tenha medo de não tentar." },
      31: { label: "O último dia do mês é um novo começo!" },
    },
    daysInMonth: (year) => 31,
  },
  {
    name: "Fevereiro",
    birthdays: {
      14: {
        label: "Aniversário de Empresa: Jaerly",
        message: "Cada ano representa um passo firme na trajetória de sucesso da Jaerly. Feliz aniversário empresarial!"
      },
      17: {
        label: "Aniversário de Empresa: Sarah e Leticia 🎂🎉",
        message:
          "Hoje é um dia especial! 🎊 Parabéns, Sarah e Leticia! 🥳 Que este dia seja cheio de alegria, amor e celebração. Além disso, agradecemos por mais um ano de dedicação e sucesso na empresa. 🚀👏 Que venham muitos outros anos de conquistas! 🎂🎈",
      },
    },
specials: {
  17: {
    label: "Carnaval (ponto facultativo)",
    message: "Carnaval (ponto facultativo).",
  },
  18: {
    label: "Quarta-feira de Cinzas",
    message: "Quarta-feira de Cinzas.",
  },
},
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    days: {
      1: { label: "Comece o mês com energia e determinação!" },
      2: { label: "Aproveite o dia para planejar suas metas." },
      3: { label: "Mantenha o foco e a disciplina." },
      4: { label: "Seja grato pelas pequenas conquistas." },
      5: { label: "Invista em seu crescimento pessoal." },
      6: { label: "Acredite no seu potencial." },
      7: { label: "Faça algo que te inspire hoje." },
      8: { label: "Compartilhe conhecimento com os outros." },
      9: { label: "Encontre alegria nas pequenas coisas." },
      10: { label: "Trabalhe com dedicação e paixão." },
      11: { label: "Seja gentil consigo mesmo." },
      12: { label: "Desafie-se a sair da zona de conforto." },
      13: { label: "Celebre suas vitórias, por menores que sejam." },
      14: { label: "Mantenha uma atitude positiva." },
      15: { label: "Aprenda algo novo hoje." },
      16: { label: "Conecte-se com pessoas que te inspiram." },
      17: { label: "Faça uma pausa e relaxe." },
      18: { label: "Seja persistente em seus objetivos." },
      19: { label: "Aproveite o dia para refletir." },
      20: { label: "Seja proativo e tome iniciativa." },
      21: { label: "Valorize o tempo com a família." },
      22: { label: "Encontre equilíbrio entre trabalho e lazer." },
      23: { label: "Seja criativo em suas soluções." },
      24: { label: "Acredite que você pode fazer a diferença." },
      25: { label: "Mantenha-se motivado e focado." },
      26: { label: "Pratique a gratidão diariamente." },
      27: { label: "Seja flexível e adapte-se às mudanças." },
      28: { label: "Busque sempre a melhoria contínua." },
    },
    daysInMonth: (year) =>
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
  },
  {
    name: "Março",
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      5: {
        label: "Aniversário de Anderson 🎂",
        message:
          "Parabéns por mais um ano de vida! 🎉🎂 Que seu dia seja repleto de alegrias, sucesso e momentos especiais. Parabéns! 🥳🎁",
      },
      17: {
        label: "Aniversário de Daniela 🎂",
        message:
          "Parabéns, Daniela! Que seu aniversário seja o começo de um ano ainda mais próspero e cheio de amor! <3",
      },
      19: {
        label: "Aniversário de Maria Viviane 🎂",
        message:
          "Parabéns, Maria Viviane! Que seu dia seja repleto de alegrias, amor e momentos inesquecíveis! 🎉🎂",
      },
      31: {
        label: "Aniversário de Rosiely 🎂",
        message:
          "Feliz aniversário, Rosiely! Que seu novo ano de vida seja maravilhoso, com muita saúde e sucesso em todas as áreas! WoW",
      },
    },
    specials: {
      19: {
        label: "São José - Padroeiro do Ceará",
        message: "Hoje é dia de celebrar São José, padroeiro do Ceará.",
      },
      25: {
        label: "Data Magna",
        message:
          "Hoje é um dia especial para o Ceará. Vamos celebrar a Data Magna com orgulho e alegria!",
      },
    },
    days: {
      1: { label: "Novo mês, novas oportunidades!" },
      2: { label: "Cuide de você hoje." },
      3: { label: "Conecte-se com amigos e família." },
      4: { label: "Dia de explorar novas ideias." },
      5: { label: "Mantenha a consistência no que faz." },
      6: { label: "Pratique gratidão neste dia." },
      7: { label: "A vida é feita de escolhas." },
      8: { label: "Invista em seu autoconhecimento." },
      9: { label: "Hoje é um ótimo dia para aprender algo novo." },
      10: { label: "Não deixe o medo te parar!" },
      11: { label: "Vença as adversidades com coragem." },
      12: { label: "Confie em sua intuição." },
      13: { label: "Explore novas possibilidades." },
      14: { label: "Celebre o amor e a amizade neste Dia dos Namorados!" },
      15: { label: "Seja grato pelas pessoas que fazem parte de sua vida." },
      16: {
        label: "Aprenda com seus erros, mas não se deixe definir por eles.",
      },
      17: { label: "Desafie-se a ser melhor a cada dia." },
      18: { label: "Oportunidades estão ao seu redor!" },
      19: { label: "Acredite em seu potencial para conquistar o impossível." },
      20: { label: "Use sua criatividade para inovar." },
      21: { label: "Mantenha sua mente aberta às novidades." },
      22: { label: "Explore novas formas de ver o mundo." },
      23: { label: "Trabalhe em equipe para alcançar grandes resultados." },
      24: { label: "Descanse e recarregue suas energias." },
      25: { label: "Tenha um dia produtivo e motivado." },
      26: { label: "Seja um exemplo de positividade." },
      27: { label: "Aprenda a lidar com os imprevistos com leveza." },
      28: { label: "O sucesso vem de um esforço contínuo." },
      29: { label: "Cada dia é uma nova chance de fazer a diferença!" },
    },
    daysInMonth: (year) => 31,
  },
  {
    name: "Abril",
    birthdays: {
      4: {
        label: "Aniversário de Alynne 🎂",
        message:
          "Parabéns, Alynne! Que seu dia seja repleto de alegrias, realizações e momentos especiais!",
      },

    }, payments: {
      6: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    specials: {
      3: {
        label: "Paixão de cristo",
        message: "Celebre a Paixão de Cristo com reflexão e gratidão.",
      },
      21: {
        label: "Tiradentes 🇧🇷",
        message:
          "Hoje celebramos Tiradentes, um herói nacional que lutou pela liberdade do Brasil.",
      },
    },

    days: {
      1: {
        label:
          "Abril chegou! Vamos aproveitar cada dia para alcançar nossos objetivos.",
      },
      2: { label: "O sucesso é conquistado com pequenos passos diários." },
      3: { label: "Acredite que você pode, e você já está no caminho certo." },
      4: { label: "Hoje é um ótimo dia para começar algo novo!" },
      5: {
        label:
          "Nunca subestime o poder de uma ação simples para transformar sua vida.",
      },
      6: { label: "O maior erro é não tentar. Dê o primeiro passo hoje." },
      7: {
        label: "A persistência é a chave para a realização dos nossos sonhos.",
      },
      8: {
        label:
          "Quando você acredita em si mesmo, o impossível se torna possível.",
      },
      9: {
        label:
          "A vida é uma jornada de aprendizado. Cada dia é uma nova oportunidade para crescer.",
      },
      10: { label: "Cada dia é uma nova oportunidade para melhorar." },
      11: {
        label: "O melhor investimento é aquele que fazemos em nós mesmos.",
      },
      12: {
        label:
          "Em algum lugar alguem está fazendo aniversário! Vamos celebrar juntos este dia.",
      },
      13: { label: "Não espere pela perfeição. Dê o seu melhor agora." },
      14: {
        label: "Seja grato pelas pequenas vitórias, elas são as que importam.",
      },
      15: { label: "A sua mente é sua maior aliada. Use-a a seu favor!" },
      16: {
        label: "Focar no que realmente importa é o caminho para o sucesso.",
      },
      17: { label: "O sucesso não vem da sorte, mas sim da persistência." },
      18: {
        label: "Cada desafio é uma chance para você se tornar mais forte.",
      },
      19: { label: "O amanhã é moldado pelas escolhas que você faz hoje." },
      20: {
        label: "Acredite no seu potencial e dê o seu melhor todos os dias.",
      },
      21: { label: "Grandes coisas começam com pequenas ações." },
      22: {
        label: "Não tenha medo de falhar, tenha medo de não tentar.",
      },
      23: {
        label: "Nunca é tarde demais para começar a perseguir seus sonhos.",
      },
      24: { label: "O sucesso é construído em cima da confiança em si mesmo." },
      25: {
        label:
          "A verdadeira mudança começa quando você decide dar o primeiro passo.",
      },
      26: {
        label:
          "O segredo do sucesso é ser persistente, mesmo quando tudo parece difícil.",
      },
      27: { label: "Cada dia é uma nova chance de ser melhor do que ontem." },
      28: {
        label:
          "Não tenha medo de recomeçar, você tem o poder de mudar sua história.",
      },
      29: {
        label:
          "O que você faz hoje prepara você para as oportunidades de amanhã.",
      },
      30: {
        label: "Que tal refletir sobre suas conquistas e desafios até agora?",
      },
    },
    daysInMonth: (year) => 30,
  },
  {
    name: "Maio",
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      9: {
        label: "Aniversário de Augusto 🎂",
        message:
          "Feliz aniversário, Augusto! Que seu dia seja repleto de alegrias! Que você continue a brilhar e inspirar todos ao seu redor! 🎉🎂",
      },
      10: {
        label: "Aniversário de Empresa: Josy 🎂",
        message:
          "Parabéns por mais ano de empresa, Josy! Que a cada dia seja repleto de grandes momentos e muita felicidade.",
      },
      18: {
        label: "Aniversário de Sarah 🎂",
        message:
          "Feliz aniversário, Sarah! 🎉 Que seu dia seja cheio de alegria, amor e momentos especiais. 🥳🎂",
      },
    },
    specials: {
      1: {
        label: "Dia do Trabalhador 🛠️",
        message:
          "Hoje celebramos o Dia do Trabalhador! Vamos reconhecer e valorizar o esforço de todos os trabalhadores.",
      },
      23: {
        label: "Aniversário de Pacajus!",
        message:
          "Hoje é aniversário de Pacajus! Vamos celebrar com muita alegria e orgulho da nossa cidade!",
      },
      20: {
        label: "Dia do RH",
        message: "Hoje é o Dia do RH! Parabéns a todos os profissionais de Recursos Humanos que fazem a diferença nas organizações, cuidando das pessoas e promovendo um ambiente de trabalho saudável e produtivo! 🎉👏",
      }
    },
    days: {
      1: { label: "Início do mês, defina suas prioridades." },
      2: { label: "Faça algo por sua saúde hoje." },
      3: { label: "Reserve um tempo para aprender algo novo." },
      4: { label: "O sucesso começa com a atitude positiva." },
      5: { label: "Mantenha-se firme nos seus objetivos." },
      6: { label: "Seja gentil com os outros." },
      7: { label: "Dia para revisar seus planos e metas." },
      8: { label: "Busque sempre a melhoria contínua." },
      9: { label: "Valorize o que você tem." },
      10: { label: "A persistência é a chave para o sucesso." },
      11: { label: "Celebre cada pequena conquista." },
      12: { label: "Olhe para frente e mantenha o foco." },
      13: { label: "Use sua criatividade para resolver problemas." },
      14: { label: "Desafie-se a aprender algo novo." },
      15: { label: "Não tenha medo de cometer erros, aprenda com eles." },
      16: { label: "A vida é feita de escolhas." },
      17: { label: "Hoje é um ótimo dia para refletir sobre o futuro." },
      18: { label: "Valorize o presente, é tudo o que você tem." },
      19: { label: "Mantenha a calma diante dos desafios." },
      20: { label: "Seja grato pelos momentos simples." },
      21: { label: "Confie no seu processo." },
      22: { label: "Nada é impossível quando você tem fé." },
      23: { label: "Aceite as mudanças como parte do crescimento." },
      24: { label: "Dê o seu melhor, mesmo nos momentos difíceis." },
      25: { label: "Cada passo é uma vitória." },
      26: { label: "Aprenda a equilibrar trabalho e lazer." },
      27: { label: "Lembre-se de respirar e relaxar." },
      28: { label: "O amanhã começa hoje!" },
      29: { label: "Este é o dia para mudar sua vida." },
      30: { label: "Faça o dia de hoje valer a pena." },
      31: { label: "Termine o mês com gratidão e otimismo." },
    },
    daysInMonth: (year) => 31,
  },
  {
    name: "Junho",
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message:
          "Oxente! Hoje é dia de botar um sorriso na cara... o dinheiro caiu na conta, visse? 💸\u0001😄",
      },
    },
    birthdays: {
      1: {
        label: "Aniversário de Empresa: Talvanes 🎂",
        message:
          "Parabéns, Talvanes! Que esse novo ciclo venha cheinho de realizações, fartura e muito forró no coração! 🎉✨",
      },
      23: {
        label: "Aniversário de Camila 🎂",
        message:
          "Camila, parabéns pra tu, visse?! 🎉 Que teu dia seja arretado de bão, com muito bolo de milho, alegria e sucesso! Tu é show de bola na equipe! 🍾🌽",
      },
    },
    specials: {
      4: {
        label: "Corpus Christi ⛪",
        message:
          "Dia de renovar a fé e agradecer pelas bênção. Que nunca falte luz no teu caminho. ✨🙏",
      },
    },
    days: {
      1: {
        label: "Começou o mês, visse? Bora pra cima com força e confiança!",
      },
      2: { label: "Sábado bom é aquele com descanso, cuscuz e sossego!" },
      3: { label: "Levanta a cabeça, ajeita o chapéu e segue em frente!" },
      4: { label: "Na batida do zabumba, a persistência leva a gente longe!" },
      5: { label: "Hoje é dia de botar ordem na casa e focar no que importa." },
      6: { label: "Cuida da mente, mermão. Ela é seu maior tesouro." },
      7: { label: "Toda conquista começa com coragem. Vai simbora!" },
      8: { label: "Gratidão é matuto que nunca sai de moda." },
      9: { label: "Se escute mais... o silêncio também fala." },
      10: { label: "Foco, fé e um cafezinho pra começar o dia!" },
      11: { label: "Quem planta hoje, colhe amanhã. Vai com calma e vai!" },
      12: { label: "Um passinho de cada vez, e a estrada se abre." },
      13: { label: "Confia no teu potencial. Tu é mais forte do que pensa!" },
      14: { label: "Perguntar não é feio, feio é ficar com dúvida." },
      15: {
        label: "Os tropeços ensinam mais que os acertos. Aprende e segue!",
      },
      16: { label: "Agradeça primeiro, o resto é bônus." },
      17: {
        label: "Devagarzinho a gente chega lá. Passinho de formiga com fé!",
      },
      18: { label: "Valorize o pequeno. É ele que forma o grande." },
      19: { label: "Fé no alto, pé no chão e coração tranquilo. ⛪" },
      20: { label: "Seja a luz do teu próprio caminho, visse?" },
      21: { label: "Hoje é dia de sair do papel e botar a ideia no mundo!" },
      22: { label: "Nem só de trabalho vive o matuto. Descansa também!" },
      23: { label: "Num enrola, vai lá e faz! O futuro é agora!" },
      24: { label: "É repetindo o passo que se faz o caminho. Persevere!" },
      25: { label: "Capriche! Tudo que é feito com carinho tem mais valor." },
      26: { label: "Quem vai com pressa se perde. Quem persiste, chega." },
      27: { label: "Aprender não tem hora. Que tal tentar algo novo hoje?" },
      28: { label: "O medo existe, mas não manda nós. Bora tentar!" },
      29: { label: "Se cuida, viu? Um corpo descansado pensa melhor." },
      30: {
        label: "Fim do mês é hora de olhar pra trás e ver o quanto já andou.",
      },
    },
    daysInMonth: (year) => 30,
  },
  {
    name: "Julho",
    payments: {
      6: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      2: {
        label: "Aniversário de Mayara 🎂",
        message:
          "Parabéns, Mayara! Que seu novo ciclo de vida seja repleto de bênçãos, amor e grandes realizações!",
      },
      10: {
        label: "Aniversário de Empresa: Isac e Luiza 🎂",
        message:
          "Parabéns, Isac e Luiza! Que este novo ano de empresa seja repleto de conquistas, aprendizados e muito sucesso! 🎉🚀",
      },
      
      16: {
        label: "Aniversário de Empresa: Anderson 🎂",
        message:
          "Parabéns por mais um ano de empresa, Anderson! 🎉🎂 Que seu dia seja cheio de alegria, realizações e momentos especiais. Muitas felicidades e sucesso sempre! 🥳🎁",
      },
      30: {
        label: "Aniversário de Nara e Talvanes 🎂",
        message:
          "Feliz aniversário, Nara e Talvanes! Que o dia de vocês seja tão especial quanto o impacto que causam na vida de todos ao redor!",
      },
    },
    specials: {},
    days: {
      1: { label: "Comece o mês com energia e um novo foco!" },
      2: {
        label:
          "Feliz aniversário, Mayara! Que seu dia seja repleto de alegrias!",
      },
      3: { label: "Nada melhor do que começar a semana com entusiasmo!" },
      4: {
        label: "Trabalhe com dedicação e foco, o sucesso está ao seu alcance.",
      },
      5: {
        label: "Hoje é o dia perfeito para fazer algo que você adia há tempos.",
      },
      6: { label: "Seja grato por cada pequeno passo que você dá." },
      7: {
        label: "Tire um tempo para descansar e se reenergizar para a semana.",
      },
      8: { label: "O segredo do sucesso é a constância, continue firme." },
      9: { label: "Seja corajoso, desafie-se e saia da sua zona de conforto." },
      10: {
        label:
          "A vida é feita de escolhas, hoje é um bom dia para refletir sobre elas.",
      },
      11: {
        label:
          "Encontre prazer no que faz, isso torna o trabalho mais gratificante.",
      },
      12: { label: "Lembre-se: você é capaz de realizar mais do que imagina." },
      13: { label: "Foque no que você pode controlar e deixe o resto ir." },
      14: {
        label: "As oportunidades estão em todo lugar, basta estar atento!",
      },
      15: {
        label: "Fazer o bem ao próximo é uma das maiores recompensas da vida.",
      },
      16: { label: "Hoje é um ótimo dia para começar algo novo!" },
      17: {
        label: "Faça mais do que o esperado e colha os frutos do seu esforço.",
      },
      18: {
        label: "A confiança em si mesmo é a base para qualquer conquista.",
      },
      19: { label: "Valorize o tempo com a família e amigos." },
      20: {
        label: "A vida é curta demais para esperar, vá atrás dos seus sonhos.",
      },
      21: { label: "Cada passo é um avanço em direção ao seu objetivo." },
      22: {
        label:
          "Hoje é um ótimo dia para se concentrar no seu crescimento pessoal.",
      },
      23: { label: "O sucesso é a soma de pequenos esforços diários." },
      24: {
        label:
          "Reflita sobre os seus objetivos e faça ajustes quando necessário.",
      },
      25: { label: "Seja proativo, não espere as coisas acontecerem." },
      26: {
        label: "Invista em você, o melhor projeto a longo prazo é você mesmo!",
      },
      27: {
        label:
          "Não se preocupe com os obstáculos, concentre-se na sua superação.",
      },
      28: { label: "Continue com determinação, cada esforço vale a pena." },
      29: { label: "Seja paciente, tudo acontece no momento certo." },
      30: {
        label:
          "Feliz aniversário, Nara e Talvanes! Que seja um dia maravilhoso!",
      },
      31: {
        label:
          "O último dia do mês é um bom momento para refletir sobre o que você aprendeu.",
      },
    },
    daysInMonth: (year) => 31,
  },
  {
    name: "Agosto",
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      1: {
        label: "Aniversário de Empresa: Gabriel, Nara e Maria Viviane 🎂",
        message: "Parabéns, Gabriel, Nara e Maria Viviane! sejam felizes, felicidade e sucesso uhu!",
      },
      18: {
        label: "Aniversário de Sr. Eider 🎂",
        message:
          "Feliz aniversário, Sr. Eider! Que sua jornada continue cheia de sabedoria, paz e muitas vitórias!",
      },
    },
    specials: {},
    days: {
      1: { label: "Novo mês, novas oportunidades! Comece com energia." },
      2: { label: "Seja a mudança que você quer ver no mundo!" },
      3: { label: "Não espere por oportunidades, crie-as!" },
      4: { label: "Comece o dia com uma atitude positiva." },
      5: { label: "A vida é feita de escolhas, tome as melhores hoje." },
      6: { label: "O sucesso começa com pequenos passos, continue firme." },
      7: { label: "Cada dia é uma chance de ser melhor do que ontem." },
      8: { label: "Invista no seu crescimento pessoal e profissional." },
      9: { label: "Com dedicação, tudo se torna possível." },
      10: { label: "O que você faz hoje molda o seu futuro." },
      11: { label: "Foque no progresso, não na perfeição." },
      12: { label: "Acredite em si mesmo e vá além!" },
      13: { label: "O melhor momento para começar é agora!" },
      14: { label: "Não importa o quão devagar você vá, desde que não pare." },
      15: { label: "Faça a diferença no seu dia e no dos outros." },
      16: { label: "O sucesso é resultado de esforço constante." },
      17: { label: "Dedique tempo a quem você ama." },
      18: { label: "Feliz aniversário, Sr. Eider! Que seu dia seja incrível!" },
      19: { label: "O segredo para o sucesso é não desistir!" },
      20: { label: "Com coragem, você pode alcançar o impossível." },
      22: { label: "A gratidão é o caminho para a paz interior." },
      23: { label: "Continue sua jornada com foco e determinação." },
      24: { label: "Desafios são oportunidades disfarçadas." },
      25: { label: "Pense grande, aja com humildade." },
      26: { label: "Valorize cada momento com os seus." },
      27: { label: "Transforme suas ideias em ação." },
      28: { label: "Não espere por uma oportunidade, crie uma." },
      29: { label: "A mudança começa com você, faça acontecer." },
      30: { label: "A vida é feita de momentos, aproveite cada um deles." },
      31: {
        label: "O que você conquistou neste mês será a base para o próximo!",
      },
    },
    daysInMonth: (year) => 31,
  },
  {
    name: "Setembro",
    payments: {
      4: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      1: {
        label: "Aniversário de Empresa: Glória e Camila 🎂",
        message:
          "Parabéns, Glória e Camila, por mais um ano de empresa! 🎉👏 Que essa trajetória continue sendo de muito sucesso, crescimento e realizações. Vocês fazem a diferença na equipe! 🚀",
      },
    },
    specials: {
      7: {
        label: "Independência do Brasil 🇧🇷",
        message:
          "Hoje celebramos a Independência do Brasil! Vamos refletir sobre nossa história e valorizar nossa liberdade.",
      },
    },
    days: {
      1: { label: "Setembro chegou! Que seja um mês de muito sucesso!" },
      2: { label: "Aproveite o dia para focar em seus objetivos." },
      3: { label: "O que você pode fazer hoje para alcançar seus sonhos?" },
      4: { label: "Dê o seu melhor em tudo o que fizer!" },
      5: { label: "A persistência é a chave para o sucesso." },
      6: { label: "Lembre-se de fazer pausas e cuidar da sua saúde mental." },
      7: {
        label:
          "Hoje é o Dia da Independência! Vamos celebrar nossas conquistas!",
      },
      8: { label: "A cada dia, mais perto dos seus objetivos." },
      9: { label: "Acredite no seu potencial!" },
      10: { label: "Foque no que você pode controlar e libere o resto." },
      11: { label: "O caminho para o sucesso começa com o primeiro passo." },
      12: { label: "Seja grato pelo que tem e trabalhe pelo que quer." },
      13: { label: "Aproveite para aprender algo novo hoje." },
      14: { label: "O futuro é criado pelo que você faz hoje." },
      15: { label: "Concentre-se no processo, o sucesso virá naturalmente." },
      16: { label: "Desafios são oportunidades de crescimento." },
      17: { label: "O foco é o segredo do sucesso." },
      18: { label: "Dedique-se a fazer o melhor que puder, todos os dias." },
      19: { label: "Descanse, recarregue suas energias e continue em frente." },
      20: {
        label: "Acredite que você pode e você já está no meio do caminho.",
      },
      21: {
        label: "Faça mais do que o esperado, surpreenda-se com os resultados.",
      },
      22: { label: "Hoje é um ótimo dia para um recomeço!" },
      23: {
        label: "Foque no presente, o futuro depende das suas ações agora.",
      },
      24: { label: "Tenha fé no processo, tudo acontece no tempo certo." },
      25: { label: "O sucesso é a soma de pequenos esforços diários." },
      26: { label: "Acredite no seu potencial, o resto virá com o tempo." },
      27: { label: "Seja gentil consigo mesmo, o progresso é um processo." },
      28: { label: "Transforme seus desafios em aprendizado." },
      29: {
        label:
          "O sucesso não é final, o fracasso não é fatal: é a coragem de continuar que conta.",
      },
      30: {
        label:
          "Hoje é um ótimo dia para refletir sobre o mês que passou e o que virá!",
      },
    },
    daysInMonth: (year) => 30,
  },
  {
    name: "Outubro",
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      9: {
        label: "Aniversário de Empresa: Augusto 🎂",
        message:
          " Parabéns por mais um ano de empresa, Augusto! Agradecemos por estar mais um ano conosco, que você continue conquistando seus sonhos e vivendo momentos inesquecíveis!",
      },
      5: {
        label: "Aniversário de Luiza 🎂",
        message:
          "Feliz aniversário, Luiza! 🎉🎂 Que seu dia seja iluminado, cheio de alegria e momentos inesquecíveis. Muitas felicidades e sucesso sempre! 🥳💖",
      },
      22: {
        label: "Aniversário de D. Goreth 🎂 e Aniversário de Glòria 🎂",
        message:
          "Parabéns, D. Goreth! Que seu dia seja especial e que o novo ano traga ainda mais alegrias e vitórias! Feliz aniversário, Glória! 🎉🎂 Que seu dia seja repleto de alegria, amor e momentos especiais.Muitas felicidades e sucesso sempre! 🥳💖",
      },

    },

    stateHolidays: {
      3: {
        label:
          " (Dia dos Santos Mártires de Cunhau e Uruacu) Feriado Estadual (RN)",
        message:
          "Hoje celebramos os Santos Mártires de Cunhau e Uruacu, um dia de fé e reflexão.",
      },
    },
    specials: {
      12: {
        label: "Nossa Senhora Aparecida",
        message:
          "Hoje celebramos Nossa Senhora Aparecida, padroeira do Brasil.",
      },
      21: {
        label: "Feriado do comercio de Pacajus",
        message:
          "Hoje é feriado do comércio. Aproveite o dia para descansar e recarregar as energias.",
      },
    },
    days: {
      1: {
        label:
          "Outubro chegou! Vamos aproveitar cada dia para alcançar nossos objetivos.",
      },
      2: { label: "O sucesso é conquistado com pequenos passos diários." },
      3: { label: "Acredite que você pode, e você já está no caminho certo." },
      4: { label: "Hoje é um ótimo dia para começar algo novo!" },
      5: {
        label:
          "Nunca subestime o poder de uma ação simples para transformar sua vida.",
      },
      6: { label: "O maior erro é não tentar. Dê o primeiro passo hoje." },
      7: {
        label: "A persistência é a chave para a realização dos nossos sonhos.",
      },
      8: {
        label:
          "Quando você acredita em si mesmo, o impossível se torna possível.",
      },
      9: {
        label:
          "Feliz aniversário, Augusto! Que seu dia seja repleto de alegrias!",
      },
      10: { label: "Cada dia é uma nova oportunidade para melhorar." },
      11: {
        label: "O melhor investimento é aquele que fazemos em nós mesmos.",
      },
      12: {
        label:
          "Feliz Dia das Crianças! Vamos celebrar a alegria e a pureza dessa fase.",
      },
      13: { label: "Não espere pela perfeição. Dê o seu melhor agora." },
      14: {
        label: "Seja grato pelas pequenas vitórias, elas são as que importam.",
      },
      15: { label: "A sua mente é sua maior aliada. Use-a a seu favor!" },
      16: {
        label: "Focar no que realmente importa é o caminho para o sucesso.",
      },
      17: { label: "O sucesso não vem da sorte, mas sim da persistência." },
      18: {
        label: "Cada desafio é uma chance para você se tornar mais forte.",
      },
      19: { label: "O amanhã é moldado pelas escolhas que você faz hoje." },
      20: {
        label: "Acredite no seu potencial e dê o seu melhor todos os dias.",
      },
      21: { label: "Grandes coisas começam com pequenas ações." },
      22: {
        label: "Feliz aniversário, D. Goreth! Que seu dia seja cheio de luz!",
      },
      23: {
        label: "Nunca é tarde demais para começar a perseguir seus sonhos.",
      },
      24: { label: "O sucesso é construído em cima da confiança em si mesmo." },
      25: {
        label:
          "A verdadeira mudança começa quando você decide dar o primeiro passo.",
      },
      26: {
        label:
          "O segredo do sucesso é ser persistente, mesmo quando tudo parece difícil.",
      },
      27: { label: "Cada dia é uma nova chance de ser melhor do que ontem." },
      28: {
        label:
          "Não tenha medo de recomeçar, você tem o poder de mudar sua história.",
      },
      29: {
        label:
          "O que você faz hoje prepara você para as oportunidades de amanhã.",
      },
      30: {
        label: "Que tal refletir sobre suas conquistas e desafios até agora?",
      },
      31: {
        label: "Feliz Halloween! Que este dia seja cheio de diversão e magia.",
      },
    },
    daysInMonth: (year) => 31,
  },
  {
    name: "Novembro",
    birthdays: {
      24: {
        label: "Aniversário de Empresa: Alynne 🎂",
        message: "Parabéns, Alynne, por mais um ano de empresa! Que sua trajetória continue sendo de muito sucesso, aprendizado e realizações. 🎉👏",
      },
      30: {
        label: "Aniversário da Dr.Estágio - 11 anos 🎉🎂",
        message:
          "Hoje celebramos 11 anos da Dr.Estágio! 🎊 Parabéns por essa trajetória de sucesso, dedicação e conquistas. Que venham muitos anos pela frente! 🚀👏",
      },
    }, payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
      30: {
        label: "1º parcela do 13º💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    stateHolidays: {
      21: {
        label:
          "(Nossa Senhora da Apresentação) Feriado Municipal de Natal (RN)",
        message:
          "Hoje celebramos Nossa Senhora da Apresentação, padroeira de Natal. Que este dia seja de paz, fé e reflexão.",
      },
    },
    specials: {
      2: {
        label: "Finados",
        message: "Hoje é o Dia de Finados, um momento de reflexão e respeito.",
      },
      15: {
        label: "Proclamação da República 🇧🇷",
        message:
          "Hoje celebramos a Proclamação da República. Vamos refletir sobre nossa história e valorizar nossa liberdade.",
      },
      20: {
        label: "Dia da Consciência Negra",
        message:
          "Hoje é o Dia da Consciência Negra. Vamos refletir sobre igualdade, respeito e a importância da luta contra o racismo.",
      },
    },
    days: {
      1: { label: "Novembro chegou! Vamos fazer desse mês um marco." },
      2: {
        label: "Hoje é o Dia de Finados, um momento de reflexão e respeito.",
      },
      3: {
        label:
          "Acredite no seu potencial, o que você faz hoje impacta o futuro.",
      },
      4: { label: "Cada novo dia é uma nova oportunidade de crescer." },
      5: { label: "Seja o protagonista da sua história!" },
      6: { label: "O sucesso é fruto do trabalho diário, continue firme!" },
      7: { label: "Não desista! O que você faz agora irá refletir no futuro." },
      8: {
        label:
          "Lembre-se de que os pequenos passos também são grandes conquistas.",
      },
      9: { label: "O futuro é agora. O que você fará com o seu hoje?" },
      10: { label: "O melhor dia para começar é hoje." },
      11: { label: "Você é mais forte do que imagina!" },
      12: { label: "Cada obstáculo é uma chance de aprender algo novo." },
      13: { label: "O sucesso é resultado de ação consistente e persistente." },
      14: { label: "O que você faz no presente molda seu futuro." },
      15: {
        label:
          "Hoje celebramos a Proclamação da República. Vamos pensar em nossa história.",
      },
      16: {
        label: "Não tenha medo de arriscar. Grandes vitórias exigem coragem!",
      },
      17: { label: "A mudança começa com você." },
      18: { label: "Desafios fazem parte do caminho para o sucesso." },
      19: { label: "Você é capaz de muito mais do que imagina!" },
      20: {
        label:
          "Hoje é o Dia da Consciência Negra. Vamos refletir sobre igualdade e respeito.",
      },
      21: { label: "Seja grato pelas pequenas vitórias do dia." },
      22: {
        label: "A perseverança é o segredo para superar qualquer obstáculo.",
      },
      24: { label: "O amanhã é construído pelo que você faz hoje." },
      25: { label: "Persista, e você verá os frutos do seu trabalho." },
      26: { label: "Mantenha a confiança, o sucesso está ao seu alcance." },
      27: {
        label:
          "Cada ação que você toma leva você mais perto dos seus objetivos.",
      },
      28: { label: "O que você faz hoje pode mudar a sua vida." },
      29: { label: "O sucesso vem para aqueles que não desistem." },
      30: { label: "Hoje é o último dia do mês. Faça-o contar!" },
    },
    daysInMonth: (year) => 30,
  },
  {
    name: "Dezembro",
    payments: {
      5: {
        label: "Dia do pagamento 💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
      18: {
        label: "2º parcela do 13º💰",
        message: "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
      30: {
        label: "Talvez Dia do pagemnto 💰",
        message:
          "Hoje é dia de sorrir... o pagamento caiu! 💰😄",
      },
    },
    birthdays: {
      8: {
        label: "Aniversário de Empresa: Rosiely 🎂",
        message:
          "Parabéns, Rosiely! Tenha um ano maravilhoso cheio de grandes conquistas e muita felicidade e amor!",
      },
      11: {
        label: "Aniversário de Natanael 🎂",
        message:
          "Feliz aniversário, Natanael! Que você tenha um dia incrível, cheio de boas surpresas e momentos especiais!",
      },
      13: {
        label: "Aniversário de Josi 🎂",
        message:
          "Parabéns, Josi! Que a felicidade seja constante na sua vida e que este novo ciclo traga muitas realizações!",
      },
      14: {
        label: "Aniversário de Jaerly",
        message: "Hoje é dia de celebrar a sua vida, sua história e tudo o que você representa. Parabéns, Jaerly!"
      },
      16: {
        label: "Aniversário de Johnatan 🎂",
        message:
          "Hoje é o seu dia, Johnatan! Que o seu ano novo de vida seja tão maravilhoso quanto você merece!",
      },
      17: {
        label: "Aniversário de Gabriel 🎂",
        message:
          "Feliz aniversário, Gabriel! Que o seu dia seja recheado de amor, felicidade e muitas bênçãos!",
      },
      22: {
        label: "Aniversário de Leticia 🎂",
        message:
          "Parabéns, Leticia! 🎉 Que seu dia seja repleto de felicidade, amor e muitas conquistas. Aproveite! 🥳🎂",
      },
    },
    specials: {
      24: { label: "Véspera de Natal" },
      25: { label: "Natal" },
      31: { label: "Véspera de Ano Novo" },
      8: {
        label: "Nossa Senhora da Conceição - Padroeira de Pacajus",
        message:
          "Hoje celebramos Nossa Senhora da Conceição, padroeira de Pacajus. Que este dia seja de muita paz e reflexão.",
      },
    },
    days: {
      1: { label: "Dezembro chegou! Vamos terminar o ano com tudo.", code: "A1B2" },
      2: { label: "Prepare-se para encerrar este ano com chave de ouro!", code: "C3D4" },
      3: { label: "Hoje é o dia perfeito para revisar seus objetivos.", code: "E5F6" },
      4: { label: "O sucesso vem para aqueles que não desistem.", code: "G7H8" },
      5: { label: "Dê o seu melhor, não há melhor momento do que agora.", code: "J9K0" },
      6: { label: "Feliz aniversário, Rosiely! Que seu dia seja repleto de alegria!", code: "L1M2" },
      7: { label: "O melhor presente é a gratidão. Valorize o que você tem.", code: "N3P4" },
      8: { label: "Cada dia é uma oportunidade para fazer algo incrível.", code: "Q5R6" },
      9: { label: "Não espere pelo momento perfeito. Crie-o.", code: "S7T8" },
      10: { label: "Foque no seu crescimento e no que você pode conquistar.", code: "U9V0" },
      11: { label: "Feliz aniversário, Natanael! Que seja um dia especial!", code: "W1X2" },
      12: { label: "O que você aprender hoje vai refletir no seu amanhã.", code: "Y3Z4" },
      13: { label: "Feliz aniversário, Josi! Que o seu dia seja maravilhoso!", code: "B5C6" },
      14: { label: "Seja o melhor de si, todos os dias.", code: "D7E8" },
      15: { label: "Foco no objetivo. O sucesso virá com o tempo.", code: "F9G0" },
      16: { label: "Feliz aniversário, Johnatan! Que o seu dia seja incrível!", code: "H1J2" },
      17: { label: "Feliz aniversário, Gabriel! Que seu dia seja repleto de alegria!", code: "K3L4" },
      18: { label: "Vamos aproveitar cada dia que falta no ano!", code: "M5N6" },
      19: { label: "Não importa o quão devagar você vá, o importante é não parar.", code: "P7Q8" },
      20: { label: "Seja grato por cada conquista, por menor que seja.", code: "R9S0" },
      21: { label: "O sucesso é feito de ações diárias.", code: "T1U2" },
      22: { label: "Parabéns, Leticia! 🎉 Que seu dia seja repleto de felicidade, amor e muitas conquistas. Aproveite! 🥳🎂", code: "V3W4" },
      23: { label: "Aproveite o final do ano para refletir e se renovar.", code: "X5Y6" },
      24: { label: "Véspera de Natal! Que a magia desta data ilumine sua vida.", code: "Z7A8" },
      25: { label: "Feliz Natal! Que seu coração se encha de alegria e paz.", code: "B9D0" },
      26: { label: "O novo ano está chegando, prepare-se para recomeçar.", code: "C1E2" },
      27: { label: "Aproveite o final do ano para refletir e se renovar.", code: "F3H4" },
      28: { label: "Cada dia é uma nova chance para se reinventar.", code: "J5L6" },
      29: { label: "O que você fez este ano define a base para o próximo!", code: "N7P8" },
      30: { label: "O ano está acabando, mas você pode fazer cada dia contar!", code: "Q9S0" },
      31: { label: "Feliz Véspera de Ano Novo! Prepare-se para um ano de conquistas!", code: "R1S2" },
    },
    daysInMonth: (year) => 31,
  },
];
