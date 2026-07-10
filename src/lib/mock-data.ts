export const MOCK_COURSES = [
  { id: "1", name: "Operating Systems", students: 124, resources: 12, lastUpdated: "2 days ago", status: "Active" },
  { id: "2", name: "Database Management", students: 98, resources: 8, lastUpdated: "5 hours ago", status: "Active" },
  { id: "3", name: "Computer Networks", students: 156, resources: 15, lastUpdated: "1 day ago", status: "Active" },
  { id: "4", name: "Artificial Intelligence", students: 210, resources: 24, lastUpdated: "3 days ago", status: "Active" },
  { id: "5", name: "Data Structures", students: 185, resources: 18, lastUpdated: "1 week ago", status: "Archived" },
];

export const MOCK_RESOURCES = [
  { id: "r1", title: "Head First Java.pdf", uploadDate: "Oct 12, 2023", discussions: 3, course: "Operating Systems", pages: 688, file: "/Head_First_Java.pdf" },
  { id: "r2", title: "SQL Normalization.pdf", uploadDate: "Oct 10, 2023", discussions: 3, course: "Database Management", pages: 34, file: null },
  { id: "r3", title: "TCP/IP Overview.pdf", uploadDate: "Oct 15, 2023", discussions: 2, course: "Computer Networks", pages: 52, file: null },
  { id: "r4", title: "Neural Networks Intro.pdf", uploadDate: "Oct 08, 2023", discussions: 2, course: "Artificial Intelligence", pages: 41, file: null },
];

export interface PinPosition {
  x: number;
  y: number;
}

export interface Reply {
  user: { name: string; avatar: string };
  message: string;
  time: string;
}

export interface Discussion {
  id: string;
  resourceId: string;
  user: { name: string; avatar: string };
  course: string;
  question: string;
  page: number;
  time: string;
  status: "Open" | "Resolved";
  replies: Reply[];
  position?: PinPosition;
}

export const INITIAL_DISCUSSIONS: Discussion[] = [
  // --- Head First Java (r1) ---
  {
    id: "d1",
    resourceId: "r1",
    user: { name: "Alice Chen", avatar: "AC" },
    course: "Operating Systems",
    question: "Why does the book say Java is 'write once, run anywhere'? How does the JVM actually handle platform differences?",
    page: 1,
    time: "2 hours ago",
    status: "Open",
    position: { x: 68, y: 38 },
    replies: [
      { user: { name: "Prof. Smith", avatar: "PS" }, message: "The JVM compiles bytecode at runtime for each specific OS, so the compiled .class files work on any machine with a compatible JVM installed.", time: "1 hour ago" }
    ]
  },
  {
    id: "d2",
    resourceId: "r1",
    user: { name: "Bob Johnson", avatar: "BJ" },
    course: "Operating Systems",
    question: "What's the difference between a class and an object? The diagram on this page is confusing me.",
    page: 1,
    time: "5 hours ago",
    status: "Resolved",
    position: { x: 22, y: 62 },
    replies: [
      { user: { name: "Prof. Smith", avatar: "PS" }, message: "A class is the blueprint (the recipe), an object is the instance created from that blueprint (the actual cake). You can have many objects from one class.", time: "4 hours ago" }
    ]
  },
  {
    id: "d3",
    resourceId: "r1",
    user: { name: "Charlie Davis", avatar: "CD" },
    course: "Operating Systems",
    question: "On page 12, does Java garbage collect immediately when an object has no references?",
    page: 12,
    time: "1 day ago",
    status: "Open",
    position: undefined,
    replies: [
      { user: { name: "Alice Chen", avatar: "AC" }, message: "No — GC is non-deterministic. The JVM decides when to run it based on memory pressure.", time: "20 hours ago" },
      { user: { name: "Charlie Davis", avatar: "CD" }, message: "Ah, so you can't rely on a finalizer for cleanup timing. Got it!", time: "19 hours ago" }
    ]
  },

  // --- SQL Normalization (r2) ---
  {
    id: "d4",
    resourceId: "r2",
    user: { name: "Diana Lee", avatar: "DL" },
    course: "Database Management",
    question: "What exactly makes a table violate 2NF? The example here with partial dependencies is unclear.",
    page: 3,
    time: "3 hours ago",
    status: "Open",
    position: { x: 45, y: 35 },
    replies: [
      { user: { name: "Prof. Smith", avatar: "PS" }, message: "A table violates 2NF when a non-key attribute depends on only part of a composite primary key, not the whole key.", time: "2 hours ago" }
    ]
  },
  {
    id: "d5",
    resourceId: "r2",
    user: { name: "Evan Park", avatar: "EP" },
    course: "Database Management",
    question: "Is BCNF always achievable without losing information? The diagram on p.8 seems to suggest otherwise.",
    page: 8,
    time: "Yesterday",
    status: "Open",
    position: { x: 60, y: 55 },
    replies: []
  },
  {
    id: "d6",
    resourceId: "r2",
    user: { name: "Fiona Hale", avatar: "FH" },
    course: "Database Management",
    question: "Why would you ever denormalize a database on purpose?",
    page: 15,
    time: "2 days ago",
    status: "Resolved",
    position: undefined,
    replies: [
      { user: { name: "Prof. Smith", avatar: "PS" }, message: "Performance. Joins are expensive at scale. Read-heavy systems like analytics warehouses often denormalize to avoid costly multi-table joins.", time: "2 days ago" }
    ]
  },

  // --- TCP/IP Overview (r3) ---
  {
    id: "d7",
    resourceId: "r3",
    user: { name: "George Wu", avatar: "GW" },
    course: "Computer Networks",
    question: "Why does TCP use a 3-way handshake instead of just 2?",
    page: 4,
    time: "5 hours ago",
    status: "Resolved",
    position: { x: 30, y: 45 },
    replies: [
      { user: { name: "Prof. Smith", avatar: "PS" }, message: "A 2-way handshake can't confirm that both sides have synchronized sequence numbers. The third ACK lets the client confirm the server's ISN.", time: "4 hours ago" }
    ]
  },
  {
    id: "d8",
    resourceId: "r3",
    user: { name: "Hannah Kim", avatar: "HK" },
    course: "Computer Networks",
    question: "How does subnetting actually reduce broadcast traffic? I can see the math but not the intuition.",
    page: 18,
    time: "1 day ago",
    status: "Open",
    position: undefined,
    replies: []
  },

  // --- Neural Networks Intro (r4) ---
  {
    id: "d9",
    resourceId: "r4",
    user: { name: "Ivan Russo", avatar: "IR" },
    course: "Artificial Intelligence",
    question: "Is the learning rate on p.6 just an example or is 0.01 actually a good default to start with?",
    page: 6,
    time: "1 day ago",
    status: "Open",
    position: { x: 55, y: 40 },
    replies: [
      { user: { name: "Alice Chen", avatar: "AC" }, message: "It depends on the optimizer. With Adam, 0.001 is more common. With plain SGD, 0.01 is a reasonable starting point.", time: "20 hours ago" },
    ]
  },
  {
    id: "d10",
    resourceId: "r4",
    user: { name: "Jess Morgan", avatar: "JM" },
    course: "Artificial Intelligence",
    question: "The backprop derivation on this page skips a step — how does the chain rule apply across the activation function?",
    page: 14,
    time: "3 days ago",
    status: "Resolved",
    position: { x: 70, y: 65 },
    replies: [
      { user: { name: "Prof. Smith", avatar: "PS" }, message: "You apply the chain rule at each layer: dL/dW = dL/dA × dA/dZ × dZ/dW, where A is post-activation and Z is the pre-activation linear output.", time: "2 days ago" }
    ]
  },
];

export const MOCK_DISCUSSIONS = INITIAL_DISCUSSIONS;

export const CHART_ACTIVITY_DATA = [
  { name: 'Mon', discussions: 12 },
  { name: 'Tue', discussions: 19 },
  { name: 'Wed', discussions: 15 },
  { name: 'Thu', discussions: 25 },
  { name: 'Fri', discussions: 22 },
  { name: 'Sat', discussions: 8 },
  { name: 'Sun', discussions: 10 },
];

export const CHART_UPLOADS_DATA = [
  { name: 'Week 1', uploads: 20 },
  { name: 'Week 2', uploads: 35 },
  { name: 'Week 3', uploads: 25 },
  { name: 'Week 4', uploads: 45 },
];

export const CHART_ENGAGEMENT_DATA = [
  { name: 'Sep', active: 400, total: 500 },
  { name: 'Oct', active: 600, total: 800 },
  { name: 'Nov', active: 800, total: 1000 },
  { name: 'Dec', active: 1100, total: 1200 },
];
