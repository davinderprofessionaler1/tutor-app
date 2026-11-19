import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TeacherStudents } from "../components/live/teacher-students";
import type { ClassroomStudent } from "@tutor/contracts";

test("all 50 enrolled students remain in the initial gallery, including connected and offline students", () => {
  const students: ClassroomStudent[] = Array.from(
    { length: 50 },
    (_, index) => ({
      id: `s-${index}`,
      name: `Gallery Student ${index}`,
      email: `gallery-${index}@example.test`,
      enrollmentType: "course",
      connected: index % 2 === 0,
      identity: null,
      sessionEnded: false,
      microphone: false,
      camera: false,
      raisedHand: false,
      joinedAt: null,
    }),
  );
  const markup = renderToStaticMarkup(
    createElement(TeacherStudents, {
      students,
      room: null,
      live: true,
      loading: false,
      moderate: async () => {},
      refresh: async () => {},
      teacher: { name: "Teacher", microphone: false },
      admission: {
        waitingRoom: true,
        locked: false,
        waiting: [
          {
            id: "wait",
            name: "Waiting Student",
            requestedAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  for (const student of students)
    assert.ok(
      markup.includes(`aria-label="${student.name} student"`),
      `${student.name} is missing`,
    );
  assert.ok(markup.includes('aria-label="Admit Waiting Student"'));
  assert.ok(markup.includes("Mute all students"));
});
