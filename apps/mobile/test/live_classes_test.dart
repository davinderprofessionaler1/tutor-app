import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tutor_student_app/live/live_api.dart';
import 'package:tutor_student_app/live/live_classes_page.dart';

LiveClass sample(
        {bool enrolled = false,
        String status = 'Scheduled',
        String access = 'both'}) =>
    LiveClass({
      'id': 'class-test',
      'title': 'Networking workshop',
      'teacherName': 'Existing Teacher',
      'description': 'A practical live class',
      'courseTitle': 'CCNA Complete Course',
      'accessType': access,
      'thumbnailUrl': '',
      'accessible': enrolled,
      'canJoin': enrolled && status == 'Live',
      'price': 29900,
      'coursePrice': 199900,
      'availableSeats': 20,
      'durationMinutes': 60,
      'startsAt': '2026-11-20T12:00:00Z',
      'status': status,
      'timeZone': 'Asia/Kolkata',
      'paymentStatus': enrolled ? 'Enrolled' : 'Not enrolled',
      'objectives': 'Learn together',
      'instructions': '',
    });

class FakeLiveApi extends LiveApi {
  FakeLiveApi(this.value) : super('test-token');
  final LiveClass value;
  @override
  Future<List<LiveClass>> classes({String? courseId}) async => [value];
  @override
  Future<LiveClass> detail(String id) async => value;
  @override
  Future<Map<String, dynamic>> request(String path,
          {Map<String, dynamic>? body, String? method}) async =>
      {
        'data': [
          {
            'title': value.title,
            'joinedAt': '2026-11-19T11:29:41Z',
            'leftAt': '2026-11-19T11:31:38Z',
            'durationSeconds': 117
          }
        ]
      };
}

void main() {
  testWidgets('attendance history displays the server-recorded duration',
      (tester) async {
    await tester.pumpWidget(
        MaterialApp(home: LiveAttendancePage(api: FakeLiveApi(sample()))));
    await tester.pumpAndSettle();
    expect(find.text('Attendance history'), findsOneWidget);
    expect(find.text('Networking workshop'), findsOneWidget);
    expect(find.text('1 min 57 sec attended'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
      'live class listing displays teacher, schedule and existing course',
      (tester) async {
    final value = sample();
    await tester.pumpWidget(MaterialApp(
        home: LiveClassesPage(token: 'test', api: FakeLiveApi(value))));
    await tester.pumpAndSettle();
    expect(find.text('Live Classes'), findsOneWidget);
    expect(find.text('Networking workshop'), findsOneWidget);
    expect(find.text('Existing Teacher'), findsOneWidget);
    expect(find.text('CCNA Complete Course'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('unpaid student sees both class and course purchase models',
      (tester) async {
    final value = sample();
    await tester.pumpWidget(MaterialApp(
        home: LiveClassDetails(api: FakeLiveApi(value), value: value)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
        find.text('Buy Complete Course — ₹1999'), 250);
    expect(find.text('Pay for Class — ₹299'), findsOneWidget);
    expect(find.text('Buy Complete Course — ₹1999'), findsOneWidget);
    expect(find.text('Join Live Class'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
      'existing enrollment does not offer another charge or premature join',
      (tester) async {
    final value = sample(enrolled: true);
    await tester.pumpWidget(MaterialApp(
        home: LiveClassDetails(api: FakeLiveApi(value), value: value)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Already Enrolled'), 250);
    expect(find.text('Already Enrolled'), findsOneWidget);
    expect(find.text('Class Not Started'), findsOneWidget);
    expect(find.textContaining('Pay for Class'), findsNothing);
    expect(find.textContaining('Buy Complete Course —'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
      'enrolled live student is offered join and completed classes are closed',
      (tester) async {
    var value = sample(enrolled: true, status: 'Live');
    await tester.pumpWidget(MaterialApp(
        home: LiveClassDetails(api: FakeLiveApi(value), value: value)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Join Live Class'), 250);
    expect(find.text('Join Live Class'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    value = sample(enrolled: true, status: 'Completed');
    await tester.pumpWidget(MaterialApp(
        home: LiveClassDetails(api: FakeLiveApi(value), value: value)));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Class Completed'), 250);
    expect(find.text('Class Completed'), findsOneWidget);
    expect(find.text('Join Live Class'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
