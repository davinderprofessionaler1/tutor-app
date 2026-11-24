export type ClassStatus =
  | "Draft"
  | "Scheduled"
  | "Live"
  | "Completed"
  | "Cancelled";
export type AccessType = "individual" | "course" | "both";
export type LiveClass = {
  id: string;
  title: string;
  description: string;
  objectives: string;
  instructions: string;
  teacherId: string;
  teacherName: string;
  courseId: string | null;
  thumbnailUrl: string;
  startsAt: string;
  timeZone: string;
  durationMinutes: number;
  capacity: number;
  price: number;
  enrollmentDeadline: string | null;
  accessType: AccessType;
  status: ClassStatus;
  roomName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  chatEnabled: boolean;
  recording?: {
    id: string;
    mime: "video/webm" | "video/mp4";
    bytes: number;
    createdAt: string;
  };
  recordingUntil?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type LiveOrder = {
  id: string;
  studentId: string;
  kind: "class" | "course";
  targetId: string;
  classId: string | null;
  amount: number;
  currency: "INR";
  status: "Pending" | "Paid" | "Failed" | "Refunded";
  providerOrderId: string | null;
  paymentId: string | null;
  idempotencyKey: string;
  refundedAmount: number;
  createdAt: string;
  paidAt: string | null;
};
export type LiveEnrollment = {
  id: string;
  classId: string;
  studentId: string;
  orderId: string | null;
  status: "Active" | "Revoked";
  createdAt: string;
};
export type JoinTicket = {
  id: string;
  classId: string;
  actorId: string;
  role: "teacher" | "student";
  identity: string;
  roomName: string;
  expiresAt: string;
  createdAt: string;
  usedSid: string | null;
  revoked: boolean;
  microphone: boolean;
  camera: boolean;
  raisedHand: boolean;
  heartbeatAt: string;
  mutePending?: boolean;
};
export type Attendance = {
  id: string;
  classId: string;
  studentId: string;
  identity: string;
  sid: string;
  joinedAt: string;
  leftAt: string | null;
  lastSeenAt: string;
  durationSeconds: number;
};
export type ChatMessage = {
  id: string;
  classId: string;
  actorId: string;
  name: string;
  role: "teacher" | "student";
  text: string;
  hidden: boolean;
  createdAt: string;
};
export type LiveEvent = {
  id: string;
  classId: string | null;
  actorId: string;
  type: string;
  detail: string;
  createdAt: string;
};
export type LiveNotification = {
  id: string;
  classId: string | null;
  studentId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  emailSentAt: string | null;
};
export type WebhookReceipt = { id: string; digest: string; createdAt: string };
export type LiveState = {
  classes: LiveClass[];
  orders: LiveOrder[];
  enrollments: LiveEnrollment[];
  tickets: JoinTicket[];
  attendance: Attendance[];
  messages: ChatMessage[];
  events: LiveEvent[];
  notifications: LiveNotification[];
  webhooks: WebhookReceipt[];
};
export type PlatformStudent = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  courseIds: string[];
};
export type PlatformCourse = {
  id: string;
  title: string;
  status: string;
  price: number;
  salePrice: number;
  thumbnailUrl: string;
};
export type Platform = {
  profile: { firstName: string; lastName: string; email: string; role: string };
  sessionVersion: number;
  studentSessionSecret: string;
  students: PlatformStudent[];
  courses: PlatformCourse[];
  orders: {
    id: string;
    studentId: string;
    courseId: string;
    status: string;
    enrollmentCreated: boolean;
  }[];
};
export type Actor = {
  id: string;
  role: "teacher" | "student";
  name: string;
  email: string;
  courseIds: string[];
};
export interface LiveRepository {
  transaction<T>(work: (state: LiveState) => T | Promise<T>): Promise<T>;
  close?(): Promise<void>;
}
export class LiveError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "LIVE_ERROR",
  ) {
    super(message);
  }
}
export const emptyLiveState = (): LiveState => ({
  classes: [],
  orders: [],
  enrollments: [],
  tickets: [],
  attendance: [],
  messages: [],
  events: [],
  notifications: [],
  webhooks: [],
});
