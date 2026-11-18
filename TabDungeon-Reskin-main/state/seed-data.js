const DAY_MS = 86400000;

const sourceFiles = {
  concepts: 'Ch01-Software-Design-Concepts-and-Principles.pdf',
  architecture: 'Ch02-Software-Architecture-part1.pdf',
  analysis: 'Ch03-Software-Design-Elements-and-Analysis.pdf'
};

function deadlineFromToday(weeks) {
  const date = new Date(Date.now() + weeks * 7 * DAY_MS);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export function createMockStudyContent() {
  const decks = [
    {
      id: 'software-design-concepts',
      name: '01 · Software Design Concepts',
      examDate: deadlineFromToday(2),
      source: sourceFiles.concepts
    },
    {
      id: 'software-architecture',
      name: '02 · Software Architecture',
      examDate: deadlineFromToday(3),
      source: sourceFiles.architecture
    },
    {
      id: 'design-elements-analysis',
      name: '03 · Design Elements & Analysis',
      examDate: deadlineFromToday(4),
      source: sourceFiles.analysis
    }
  ];

  const cards = [
    {
      id: 'concepts-1',
      deckId: decks[0].id,
      front: 'What is the primary purpose of software design?',
      back: 'To transform requirements into a structured solution that can be implemented, tested, maintained, and evolved.'
    },
    {
      id: 'concepts-2',
      deckId: decks[0].id,
      front: 'What is abstraction in software design?',
      back: 'Focusing on the essential properties of a problem or solution while hiding unnecessary implementation detail.'
    },
    {
      id: 'concepts-3',
      deckId: decks[0].id,
      front: 'How do cohesion and coupling affect design quality?',
      back: 'High cohesion keeps related responsibilities together; low coupling limits dependencies between components. Together they improve changeability and maintainability.'
    },
    {
      id: 'concepts-4',
      deckId: decks[0].id,
      front: 'Why is separation of concerns useful?',
      back: 'It separates different responsibilities so each part can be understood, changed, and tested with less impact on unrelated parts.'
    },
    {
      id: 'architecture-1',
      deckId: decks[1].id,
      front: 'What does software architecture describe?',
      back: 'The major structures of a system, their responsibilities, and the relationships and constraints between them.'
    },
    {
      id: 'architecture-2',
      deckId: decks[1].id,
      front: 'What is an architectural style or pattern?',
      back: 'A recurring organization of components and interactions that provides a proven way to structure a system.'
    },
    {
      id: 'architecture-3',
      deckId: decks[1].id,
      front: 'What is the role of interfaces between architectural components?',
      back: 'Interfaces define the contract for interaction while allowing the components behind them to change independently.'
    },
    {
      id: 'architecture-4',
      deckId: decks[1].id,
      front: 'What is a key trade-off when selecting an architecture?',
      back: 'Architectural choices balance competing quality attributes such as performance, security, scalability, reliability, and maintainability.'
    },
    {
      id: 'analysis-1',
      deckId: decks[2].id,
      front: 'What are design elements?',
      back: 'The detailed building blocks of a design, such as components, classes, interfaces, data structures, and their interactions.'
    },
    {
      id: 'analysis-2',
      deckId: decks[2].id,
      front: 'What is the purpose of analyzing a design before implementation?',
      back: 'To identify inconsistencies, risks, missing responsibilities, and quality concerns while changes are still less expensive.'
    },
    {
      id: 'analysis-3',
      deckId: decks[2].id,
      front: 'What makes a design traceable to requirements?',
      back: 'Each important design decision and element can be connected back to one or more stated functional or quality requirements.'
    },
    {
      id: 'analysis-4',
      deckId: decks[2].id,
      front: 'What should a design review evaluate?',
      back: 'Whether the design satisfies requirements, has clear responsibilities, manages dependencies, addresses quality attributes, and remains feasible to implement.'
    }
  ];

  return { decks, cards, history: [] };
}
