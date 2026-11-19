import 'package:flutter_test/flutter_test.dart';
import 'package:tutor_student_app/student_app.dart';

void main() {
  testWidgets('shows the redesigned enterprise login screen', (tester) async {
    await tester.pumpWidget(const StudentApp());

    expect(find.text('Welcome to Northstar'), findsOneWidget);
    expect(find.text('Work Email or Corporate ID'), findsOneWidget);
    expect(find.text('Email Login Code'), findsOneWidget);
    expect(find.text('Enterprise Managed Workspace'), findsOneWidget);
  });
}
