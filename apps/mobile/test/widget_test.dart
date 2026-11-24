import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tutor_student_app/student_app.dart';
import 'package:tutor_student_app/models.dart';
import 'package:tutor_student_app/live/live_api.dart';

Tutorial course(String id, String title, int progress) => Tutorial(
        id: id,
        title: title,
        category: 'Engineering',
        thumbnailUrl: '',
        featured: false,
        progressPercent: progress,
        completedVideoCount: progress == 100 ? 1 : 0,
        attachments: const [],
        reviews: const [],
        chapters: [
          TutorialChapter(id: 'chapter-$id', title: 'Core topics', videos: [
            TutorialVideo(
                id: 'video-$id',
                title: 'Architecture fundamentals',
                provider: 'file',
                sourceUrl: '',
                durationMinutes: 20,
                progressSeconds: 0,
                durationSeconds: 1200,
                completed: progress == 100)
          ])
        ]);

const student = Student(
    id: 'test',
    firstName: 'Mira',
    lastName: 'Shah',
    email: 'mira@example.com',
    phone: '',
    status: 'Active');

Widget frame(Widget child, {double scale = 1}) => MaterialApp(
    theme: ThemeData(fontFamily: 'RobotoFlex', scaffoldBackgroundColor: canvas),
    home: MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(scale)),
        child: Scaffold(body: child)));

void main() {
  testWidgets('Academic login validates email without requesting a code',
      (tester) async {
    await tester.pumpWidget(const StudentApp());
    expect(find.text('Welcome back to Northstar'), findsOneWidget);
    expect(find.text('Academic or Organization Email'), findsOneWidget);
    expect(find.text('Send Login Code'), findsOneWidget);
    await tester.ensureVisible(find.text('Send Login Code'));
    await tester.tap(find.text('Send Login Code'));
    await tester.pump();
    expect(find.text('Enter your work email address.'), findsOneWidget);
    expect(find.textContaining('GDPR'), findsNothing);
  });

  testWidgets('course filters and search use actual progress and titles',
      (tester) async {
    final courses = [
      course('a', 'Data Engineering', 68),
      course('b', 'Python Foundations', 100)
    ];
    await tester.pumpWidget(
        frame(CoursesTab(tutorials: courses, onRefresh: () async {})));
    await tester.tap(find.text('Completed'));
    await tester.pumpAndSettle();
    expect(find.text('Python Foundations'), findsOneWidget);
    expect(find.text('Data Engineering'), findsNothing);
    expect(find.text('Review Course'), findsOneWidget);
    expect(find.text('View Certificate'), findsNothing);
    await tester.tap(find.text('In Progress'));
    await tester.pumpAndSettle();
    expect(find.text('Data Engineering'), findsOneWidget);
    expect(find.text('Python Foundations'), findsNothing);
    await tester.tap(find.text('All'));
    await tester.enterText(find.byType(TextField), 'python');
    await tester.pumpAndSettle();
    expect(find.text('Python Foundations'), findsOneWidget);
    expect(find.text('Data Engineering'), findsNothing);
    await tester.enterText(find.byType(TextField), 'does not exist');
    await tester.pumpAndSettle();
    expect(find.text('No matching courses'), findsOneWidget);
  });

  testWidgets('four bottom destinations select the correct tab',
      (tester) async {
    var selected = -1;
    await tester.pumpWidget(frame(
        FloatingNav(selected: 0, onSelected: (value) => selected = value)));
    for (final entry in {
      'Home': 0,
      'My Courses': 1,
      'Live Classes': 2,
      'Profile': 3
    }.entries) {
      await tester.tap(find.text(entry.key));
      expect(selected, entry.value);
    }
  });

  testWidgets(
      'dashboard omits inaccessible and ended sessions, shows real next class',
      (tester) async {
    LiveClass session(String id,
            {bool accessible = true, bool ended = false}) =>
        LiveClass({
          'id': id,
          'title': id,
          'teacherName': 'Teacher',
          'status': 'Scheduled',
          'accessible': accessible,
          'sessionEnded': ended,
          'startsAt': DateTime.now()
              .add(const Duration(hours: 2))
              .toUtc()
              .toIso8601String(),
          'durationMinutes': 75,
          'accessType': 'class',
          'price': 0,
        });
    await tester.pumpWidget(frame(HomeTab(
        student: student,
        tutorials: const [],
        featuredTutorials: const [],
        onRefresh: () async {},
        onCourses: () {},
        sessions: [
          session('Hidden purchase', accessible: false),
          session('Ended access', ended: true),
          session('Design Workshop')
        ])));
    expect(find.text('Design Workshop'), findsOneWidget);
    expect(find.text('Hidden purchase'), findsNothing);
    expect(find.text('Ended access'), findsNothing);
    expect(find.text('Teacher · 75 mins'), findsOneWidget);
  });

  testWidgets('small phone and larger text layouts remain usable',
      (tester) async {
    tester.view.physicalSize = const Size(320, 740);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    final courses = [
      course('a', 'Full-Stack Data Engineering and Pipelines', 68)
    ];
    await tester.pumpWidget(frame(
        CoursesTab(tutorials: courses, onRefresh: () async {}),
        scale: 1.5));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(frame(
        HomeTab(
            student: student,
            tutorials: courses,
            featuredTutorials: courses,
            onRefresh: () async {},
            onCourses: () {}),
        scale: 1.5));
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
}
