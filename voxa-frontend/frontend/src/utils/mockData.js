export const MOCK_SIGNS = [
  { sign: "NAMASTE", translation: "Namaste", confidence: 97 },
  { sign: "HELLO", translation: "Hello", confidence: 94 },
  { sign: "THANK YOU", translation: "Thank you", confidence: 91 },
  { sign: "GOOD MORNING", translation: "Good morning", confidence: 88 },
  { sign: "PLEASE", translation: "Please", confidence: 93 },
  { sign: "SORRY", translation: "Sorry", confidence: 89 },
  { sign: "YES", translation: "Yes", confidence: 96 },
  { sign: "NO", translation: "No", confidence: 95 },
  { sign: "HELP", translation: "Help", confidence: 90 },
  { sign: "WATER", translation: "Water", confidence: 87 },
];

export const INITIAL_HISTORY = [
  {
    id: "1",
    sign: "NAMASTE",
    translation: "Namaste",
    confidence: 97,
    timestamp: new Date(Date.now() - 2 * 60 * 1000),
  },
  {
    id: "2",
    sign: "THANK YOU",
    translation: "Thank you",
    confidence: 91,
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
  },
  {
    id: "3",
    sign: "GOOD MORNING",
    translation: "Good morning",
    confidence: 88,
    timestamp: new Date(Date.now() - 10 * 60 * 1000),
  },
];

export function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}