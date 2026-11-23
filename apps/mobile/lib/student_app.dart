import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'api.dart';
import 'models.dart';
import 'live/live_classes_page.dart';
import 'live/live_api.dart';

part 'academic_ui.dart';

const primary = Color(0xFF006D2F);
const accent = Color(0xFF25D366);
const deepGreen = Color(0xFF075E54);
const teal = Color(0xFF128C7E);
const canvas = Color(0xFFF5FAFF);
const paleBlue = Color(0xFFEAF5FE);
const line = Color(0xFFE9EDEF);
const ink = Color(0xFF131D23);
const muted = Color(0xFF667781);
const native = MethodChannel('northstar/native');

Future<void> start() async {
  WidgetsFlutterBinding.ensureInitialized();
  final token = await native.invokeMethod<String>('readToken');
  runApp(StudentApp(initialToken: token));
}

class StudentApp extends StatefulWidget {
  const StudentApp({super.key, this.initialToken});
  final String? initialToken;
  @override
  State<StudentApp> createState() => _StudentAppState();
}

class _StudentAppState extends State<StudentApp> with WidgetsBindingObserver {
  String? token, loginMessage;
  AppBranding branding = AppBranding.fallback;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    token = widget.initialToken;
    loadBranding();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) loadBranding();
  }

  Future<void> loadBranding() async {
    try {
      final value = await StudentApi().branding();
      if (mounted) setState(() => branding = value);
    } on ApiFailure {
      // Retain the bundled fallback when the API is unavailable.
    }
  }

  Future<void> signedIn(String value) async {
    await native.invokeMethod('saveToken', value);
    if (mounted) setState(() => token = value);
  }

  Future<void> signedOut([String? reason]) async {
    await native.invokeMethod('clearToken');
    if (mounted) {
      setState(() {
        token = null;
        loginMessage = reason;
      });
    }
  }

  @override
  Widget build(BuildContext context) => BrandingScope(
        branding: branding,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          title: branding.appName,
          theme: ThemeData(
            useMaterial3: true,
            scaffoldBackgroundColor: canvas,
            fontFamily: 'RobotoFlex',
            colorScheme: ColorScheme.fromSeed(
                seedColor: primary, primary: primary, surface: canvas),
            textTheme: const TextTheme(
              headlineLarge: TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w700, color: ink),
              headlineMedium: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w700, color: ink),
              titleLarge: TextStyle(
                  fontSize: 18, fontWeight: FontWeight.w700, color: ink),
              bodyLarge: TextStyle(fontSize: 16, height: 1.45, color: ink),
              bodyMedium: TextStyle(fontSize: 14, height: 1.42, color: ink),
            ),
            appBarTheme: const AppBarTheme(
                backgroundColor: canvas,
                surfaceTintColor: Colors.transparent,
                foregroundColor: ink,
                elevation: 0,
                titleTextStyle: TextStyle(
                    fontFamily: 'RobotoFlex',
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: ink)),
            filledButtonTheme: FilledButtonThemeData(
                style: FilledButton.styleFrom(
                    backgroundColor: primary,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(48, 52),
                    textStyle: const TextStyle(
                        fontFamily: 'RobotoFlex',
                        fontSize: 15,
                        fontWeight: FontWeight.w600),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)))),
            inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: Colors.white,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: Color(0xFFBBCBB9))),
              focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: teal, width: 2)),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: line)),
            ),
          ),
          home: token == null
              ? LoginScreen(message: loginMessage, onSignedIn: signedIn)
              : StudentShell(token: token!, onLogout: signedOut),
        ),
      );
}

class BrandingScope extends InheritedWidget {
  const BrandingScope(
      {super.key, required this.branding, required super.child});
  final AppBranding branding;
  static AppBranding of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<BrandingScope>()?.branding ??
      AppBranding.fallback;
  @override
  bool updateShouldNotify(BrandingScope oldWidget) =>
      branding != oldWidget.branding;
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.onSignedIn, this.message});
  final Future<void> Function(String) onSignedIn;
  final String? message;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController(), otp = TextEditingController();
  bool codeSent = false, loading = false;
  int resendSeconds = 0;
  Timer? resendTimer;
  String? error, notice;

  @override
  void initState() {
    super.initState();
    notice = widget.message;
  }

  @override
  void dispose() {
    resendTimer?.cancel();
    email.dispose();
    otp.dispose();
    super.dispose();
  }

  Future<void> requestCode() async {
    if (loading || resendSeconds > 0) return;
    if (!email.text.contains('@')) {
      setState(() => error = 'Enter your work email address.');
      return;
    }
    setState(() {
      loading = true;
      error = notice = null;
    });
    try {
      final message = await StudentApi().requestOtp(email.text.trim());
      if (mounted) {
        setState(() {
          codeSent = true;
          notice = message;
          resendSeconds = 60;
        });
        resendTimer?.cancel();
        resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
          if (!mounted) {
            timer.cancel();
            return;
          }
          setState(() => resendSeconds--);
          if (resendSeconds <= 0) timer.cancel();
        });
      }
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> verify() async {
    if (loading) return;
    if (otp.text.trim().length != 6) {
      setState(() => error = 'Enter the 6-digit code from your email.');
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result =
          await StudentApi().verifyOtp(email.text.trim(), otp.text.trim());
      await widget.onSignedIn(result.token);
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => _AcademicLogin(
        email: email,
        otp: otp,
        codeSent: codeSent,
        loading: loading,
        error: error,
        notice: notice,
        resendSeconds: resendSeconds,
        onSubmit: codeSent ? verify : requestCode,
        onResend: requestCode,
        onEditEmail: () => setState(() {
          codeSent = false;
          otp.clear();
          error = notice = null;
          resendTimer?.cancel();
          resendSeconds = 0;
        }),
      );
}

class StudentShell extends StatefulWidget {
  const StudentShell({super.key, required this.token, required this.onLogout});
  final String token;
  final ValueChanged<String?> onLogout;
  @override
  State<StudentShell> createState() => _StudentShellState();
}

class _StudentShellState extends State<StudentShell>
    with WidgetsBindingObserver {
  late final StudentApi api;
  late final PageController pageController;
  final scaffoldKey = GlobalKey<ScaffoldState>();
  Student? student;
  List<Tutorial> tutorials = [];
  List<Tutorial> featuredTutorials = [];
  List<LiveClass> liveClasses = [];
  int unreadNotifications = 0;
  bool liveLoading = true, liveRefreshing = false;
  String? liveError;
  bool loading = true;
  String? accessMessage, accessCode;
  int tab = 0;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    api = StudentApi(token: widget.token);
    pageController = PageController();
    refresh();
    loadLiveSummary();
    timer = Timer.periodic(const Duration(seconds: 15), (_) {
      checkAccess();
      loadLiveSummary();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    timer?.cancel();
    pageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      refresh();
      loadLiveSummary();
    }
  }

  Future<void> loadLiveSummary() async {
    if (liveRefreshing) return;
    liveRefreshing = true;
    final live = LiveApi(widget.token);
    try {
      final values = await live.classes();
      if (mounted) {
        setState(() {
          liveClasses = values;
          liveLoading = false;
          liveError = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          liveLoading = false;
          liveError = 'Live sessions could not be refreshed.';
        });
      }
    } finally {
      liveRefreshing = false;
    }
    try {
      final response = await live.request('/notifications');
      final count = (response['data'] as List)
          .where((value) => value['read'] != true)
          .length;
      if (mounted) setState(() => unreadNotifications = count);
    } catch (_) {/* Keep the last known notification count. */}
  }

  Future<void> openNotifications() async {
    await Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => LiveNotificationsPage(api: LiveApi(widget.token))));
    await loadLiveSummary();
  }

  Future<void> checkAccess() async {
    try {
      final current = await api.me();
      if (mounted) {
        setState(() {
          student = current;
          accessMessage = accessCode = null;
        });
      }
    } on ApiFailure catch (failure) {
      if (failure.code == 'STUDENT_BLOCKED') {
        widget.onLogout(
            'Your account was blocked by the administrator. Contact support.');
      } else if (mounted && failure.code == 'UNAUTHORIZED') {
        setState(() {
          accessCode = failure.code;
          accessMessage =
              'The server could not verify this login. Your saved session has been kept.';
        });
      }
    }
  }

  Future<void> refresh() async {
    setState(() => loading = true);
    try {
      final results = await Future.wait(
          [api.me(), api.tutorials(), api.featuredTutorials()]);
      if (mounted) {
        setState(() {
          student = results[0] as Student;
          tutorials = results[1] as List<Tutorial>;
          featuredTutorials = results[2] as List<Tutorial>;
          accessMessage = accessCode = null;
        });
      }
    } on ApiFailure catch (failure) {
      if (failure.code == 'STUDENT_BLOCKED') {
        widget.onLogout(
            'Your account was blocked by the administrator. Contact support.');
      } else if (failure.code == 'UNAUTHORIZED') {
        if (mounted) {
          setState(() {
            accessCode = failure.code;
            accessMessage =
                'The server could not verify this login. Your saved session has been kept.';
          });
        }
      } else if (mounted) {
        setState(() {
          accessCode = null;
          accessMessage = failure.message;
        });
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(failure.message)));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  void selectTab(int value) {
    if (value == tab || !pageController.hasClients) return;
    setState(() => tab = value);
    pageController.animateToPage(
      value,
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeInOutCubic,
    );
  }

  Future<void> confirmLogout() async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            icon: const Icon(Icons.logout_rounded, color: deepGreen),
            title: const Text('Log out?'),
            content: const Text(
                'Are you sure you want to end your current learning session?'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Cancel')),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                style: FilledButton.styleFrom(
                    backgroundColor: deepGreen, foregroundColor: Colors.white),
                child: const Text('Log out'),
              ),
            ],
          ),
        ) ??
        false;
    if (confirmed) widget.onLogout(null);
  }

  Future<void> showHelp() async => Navigator.of(context)
      .push(MaterialPageRoute(builder: (_) => SupportPage(api: api)));

  @override
  Widget build(BuildContext context) {
    if (loading && student == null) {
      return const Scaffold(
          body: Center(child: CircularProgressIndicator(color: accent)));
    }
    if (student == null) {
      return Scaffold(
        appBar: AppBar(
          toolbarHeight: 72,
          backgroundColor: canvas,
          surfaceTintColor: canvas,
          title: const Brand(
              compact: true,
              showName: false,
              background: false,
              width: 112,
              height: 56),
          centerTitle: true,
        ),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 430),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: SurfaceCard(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(
                    accessCode == 'STUDENT_BLOCKED'
                        ? Icons.block_rounded
                        : Icons.cloud_off_rounded,
                    color: deepGreen,
                    size: 42,
                  ),
                  const SizedBox(height: 14),
                  const Text('Your login is saved',
                      style:
                          TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(
                    accessMessage ??
                        'We could not load your learning account right now.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: muted, height: 1.45),
                  ),
                  const SizedBox(height: 20),
                  FilledButton.icon(
                    onPressed: refresh,
                    icon: const Icon(Icons.refresh_rounded),
                    label: const Text('Retry'),
                  ),
                  if (accessCode == 'UNAUTHORIZED')
                    TextButton(
                      onPressed: () => widget.onLogout(
                          'Sign in again to replace the saved login.'),
                      child: const Text('Sign in again'),
                    ),
                ]),
              ),
            ),
          ),
        ),
      );
    }
    final pages = [
      HomeTab(
          student: student!,
          tutorials: tutorials,
          featuredTutorials: featuredTutorials,
          onRefresh: () async {
            await Future.wait([refresh(), loadLiveSummary()]);
          },
          onCourses: () => selectTab(1),
          sessions: liveClasses,
          liveApi: LiveApi(widget.token),
          liveLoading: liveLoading,
          liveError: liveError,
          onLiveRetry: loadLiveSummary,
          onLiveClasses: () => selectTab(2)),
      CoursesTab(tutorials: tutorials, onRefresh: refresh),
      LiveClassesPage(token: widget.token, embedded: true),
      ProfileTab(
          student: student!,
          tutorials: tutorials,
          api: api,
          onUpdated: (value) => setState(() => student = value)),
    ];
    return Scaffold(
      key: scaffoldKey,
      extendBody: false,
      drawer: AppDrawer(
        student: student!,
        selected: tab,
        onNavigate: (value) {
          Navigator.pop(context);
          selectTab(value);
        },
        onSettings: () {
          Navigator.pop(context);
          selectTab(3);
        },
        onHelp: () {
          Navigator.pop(context);
          showHelp();
        },
        onLogout: () {
          Navigator.pop(context);
          confirmLogout();
        },
      ),
      appBar: _AcademicAppBar(
        title: ['Home', 'My Courses', 'Live Classes', 'Profile'][tab],
        student: student!,
        unread: unreadNotifications,
        onMenu: () => scaffoldKey.currentState?.openDrawer(),
        onNotifications: openNotifications,
        onProfile: () => selectTab(3),
        onHistory: tab == 2
            ? () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) =>
                        LiveAttendancePage(api: LiveApi(widget.token))))
            : null,
      ),
      body: Column(
        children: [
          if (accessMessage != null)
            Container(
              width: double.infinity,
              color: const Color(0xFFFFF3CD),
              padding: const EdgeInsets.fromLTRB(16, 9, 8, 9),
              child: Row(children: [
                const Icon(Icons.info_outline_rounded,
                    color: Color(0xFF765A00), size: 20),
                const SizedBox(width: 9),
                Expanded(
                    child: Text(accessMessage!,
                        style: const TextStyle(
                            color: Color(0xFF5C4700), fontSize: 12))),
                TextButton(onPressed: refresh, child: const Text('Retry')),
              ]),
            ),
          Expanded(
            child: PageView(
              controller: pageController,
              physics: const NeverScrollableScrollPhysics(),
              onPageChanged: (value) => setState(() => tab = value),
              children: pages,
            ),
          ),
        ],
      ),
      bottomNavigationBar: FloatingNav(selected: tab, onSelected: selectTab),
    );
  }
}

class SupportPage extends StatefulWidget {
  const SupportPage({super.key, required this.api});
  final StudentApi api;
  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  final subject = TextEditingController();
  final message = TextEditingController();
  List<SupportQuery> queries = [];
  bool loading = true, submitting = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    subject.dispose();
    message.dispose();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final values = await widget.api.supportQueries();
      if (mounted) setState(() => queries = values);
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> submit() async {
    if (subject.text.trim().length < 3 || message.text.trim().length < 10) {
      setState(() => error =
          'Enter a subject and at least 10 characters describing your query.');
      return;
    }
    setState(() {
      submitting = true;
      error = null;
    });
    try {
      final query = await widget.api
          .submitSupportQuery(subject.text.trim(), message.text.trim());
      if (mounted) {
        setState(() {
          queries = [query, ...queries];
          subject.clear();
          message.clear();
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text('Submitted. Reference ${query.referenceNumber}.')));
      }
    } on ApiFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          toolbarHeight: 72,
          backgroundColor: canvas,
          surfaceTintColor: canvas,
          title: const Text('Help & Support',
              style: TextStyle(fontWeight: FontWeight.w700)),
        ),
        body: RefreshIndicator(
          color: accent,
          onRefresh: load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 36),
            children: [
              const SurfaceCard(
                child: Row(children: [
                  CircleAvatar(
                      backgroundColor: paleBlue,
                      foregroundColor: teal,
                      child: Icon(Icons.support_agent_rounded)),
                  SizedBox(width: 13),
                  Expanded(
                      child: Text(
                          'Send your question to the learning administrator. You can track its status below.',
                          style: TextStyle(height: 1.4))),
                ]),
              ),
              const SizedBox(height: 16),
              SurfaceCard(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Submit a query',
                          style: TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 14),
                      TextField(
                          controller: subject,
                          maxLength: 120,
                          decoration: const InputDecoration(
                              labelText: 'Subject',
                              hintText: 'Example: Unable to open a lesson')),
                      const SizedBox(height: 10),
                      TextField(
                        controller: message,
                        minLines: 4,
                        maxLines: 7,
                        maxLength: 2000,
                        decoration: const InputDecoration(
                            labelText: 'Describe your query',
                            alignLabelWithHint: true),
                      ),
                      if (error != null) Message(error!, error: true),
                      const SizedBox(height: 14),
                      FilledButton.icon(
                        onPressed: submitting ? null : submit,
                        style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(50),
                            backgroundColor: deepGreen),
                        icon: submitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.send_rounded),
                        label:
                            Text(submitting ? 'Submitting…' : 'Submit query'),
                      ),
                    ]),
              ),
              const SizedBox(height: 24),
              SectionHeader(
                  title: 'Recent queries',
                  badge: '${queries.length} submitted'),
              const SizedBox(height: 10),
              if (loading)
                const Center(
                    child: Padding(
                        padding: EdgeInsets.all(28),
                        child: CircularProgressIndicator(color: accent)))
              else if (queries.isEmpty)
                const SurfaceCard(
                    child: Center(
                        child: Text('No support queries submitted yet.')))
              else
                ...queries.map((query) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: SurfaceCard(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(
                                    child: Text(query.subject,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w700))),
                                SupportStatus(status: query.status),
                              ]),
                              const SizedBox(height: 7),
                              Text(query.referenceNumber,
                                  style: const TextStyle(
                                      color: teal,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700)),
                              const SizedBox(height: 8),
                              Text(query.message,
                                  style: const TextStyle(
                                      color: muted, height: 1.4)),
                              if (query.adminReply.isNotEmpty) ...[
                                const SizedBox(height: 12),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                      color: paleBlue,
                                      borderRadius: BorderRadius.circular(10)),
                                  child: Text(
                                      'Admin reply: ${query.adminReply}',
                                      style: const TextStyle(height: 1.4)),
                                ),
                              ],
                              const SizedBox(height: 9),
                              Text(supportDate(query.updatedAt),
                                  style: const TextStyle(
                                      color: muted, fontSize: 10)),
                            ]),
                      ),
                    )),
            ],
          ),
        ),
      );
}

class SupportStatus extends StatelessWidget {
  const SupportStatus({super.key, required this.status});
  final String status;
  @override
  Widget build(BuildContext context) {
    final resolved = status == 'Resolved';
    final inProgress = status == 'In Progress';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
          color: resolved
              ? const Color(0xFFDFF5E7)
              : inProgress
                  ? const Color(0xFFFFF0CC)
                  : paleBlue,
          borderRadius: BorderRadius.circular(999)),
      child: Text(status,
          style: TextStyle(
              color: resolved
                  ? primary
                  : inProgress
                      ? const Color(0xFF765A00)
                      : teal,
              fontSize: 10,
              fontWeight: FontWeight.w700)),
    );
  }
}

String supportDate(String value) {
  final date = DateTime.tryParse(value)?.toLocal();
  if (date == null) return '';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
}

class TutorialPage extends StatefulWidget {
  const TutorialPage({super.key, required this.tutorial});
  final Tutorial tutorial;

  @override
  State<TutorialPage> createState() => _TutorialPageState();
}

class _TutorialPageState extends State<TutorialPage> {
  late Tutorial currentTutorial;
  Tutorial get tutorial => currentTutorial;
  late List<TutorialReview> reviews;

  @override
  void initState() {
    super.initState();
    currentTutorial = widget.tutorial;
    reviews = [...tutorial.reviews];
  }

  Future<void> openVideo(BuildContext context, TutorialVideo video) async {
    try {
      await native.invokeMethod('playVideo', {
        'url': video.sourceUrl,
        'provider': video.provider,
        'title': video.title,
        'videoId': video.id,
        'startSeconds': video.completed ? 0 : video.progressSeconds,
        'reportUrl': '${StudentApi.baseUrl}/security-events',
        'progressUrl': '${StudentApi.baseUrl}/progress',
      });
      await Future<void>.delayed(const Duration(milliseconds: 600));
      final token = await native.invokeMethod<String>('readToken');
      if (token != null) {
        final courses = await StudentApi(token: token).tutorials();
        final updated =
            courses.where((course) => course.id == tutorial.id).firstOrNull;
        if (mounted && updated != null) {
          setState(() {
            currentTutorial = updated;
            reviews = [...updated.reviews];
          });
        }
      }
    } on PlatformException {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not play this video.')));
      }
    }
  }

  Future<void> downloadAttachment(
      BuildContext context, TutorialAttachment attachment) async {
    try {
      await native.invokeMethod(
          'downloadFile', {'url': attachment.url, 'name': attachment.name});
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Downloading ${attachment.name}…')));
      }
    } on PlatformException {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not download this file.')));
      }
    }
  }

  Future<void> writeReview() async {
    var rating = 0;
    final comment = TextEditingController();
    final submitted = await showModalBottomSheet<bool>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          backgroundColor: Colors.transparent,
          builder: (sheetContext) => StatefulBuilder(
            builder: (context, setSheetState) {
              final canSubmit = rating > 0 && comment.text.trim().length >= 2;
              return Padding(
                padding: EdgeInsets.only(
                    bottom: MediaQuery.viewInsetsOf(context).bottom),
                child: Container(
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    borderRadius:
                        BorderRadius.vertical(top: Radius.circular(26)),
                  ),
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 42,
                            height: 4,
                            decoration: BoxDecoration(
                              color: const Color(0xFFD9DFDC),
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                        Row(children: [
                          const Expanded(
                            child: Text('Write a review',
                                style: TextStyle(
                                    fontSize: 22, fontWeight: FontWeight.w800)),
                          ),
                          IconButton(
                            onPressed: () => Navigator.pop(sheetContext, false),
                            icon: const Icon(Icons.close_rounded),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFFF1F4F2),
                            ),
                          ),
                        ]),
                        const SizedBox(height: 22),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(5, (index) {
                            final selected = index < rating;
                            return Expanded(
                              child: Semantics(
                                button: true,
                                selected: selected,
                                label: '${index + 1} stars',
                                child: IconButton(
                                  onPressed: () =>
                                      setSheetState(() => rating = index + 1),
                                  padding: EdgeInsets.zero,
                                  constraints:
                                      const BoxConstraints(minHeight: 52),
                                  iconSize: 42,
                                  icon: Icon(
                                    selected
                                        ? Icons.star_rounded
                                        : Icons.star_outline_rounded,
                                    color: selected
                                        ? const Color(0xFFFFB020)
                                        : const Color(0xFFB7C0BB),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: 20),
                        TextField(
                          controller: comment,
                          onChanged: (_) => setSheetState(() {}),
                          minLines: 4,
                          maxLines: 6,
                          maxLength: 1000,
                          textCapitalization: TextCapitalization.sentences,
                          decoration: InputDecoration(
                            labelText: 'Your review',
                            alignLabelWithHint: true,
                            hintText: 'Share your experience with this course',
                            filled: true,
                            fillColor: const Color(0xFFF7F9F8),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(15),
                              borderSide:
                                  const BorderSide(color: Color(0xFFDDE3E0)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(15),
                              borderSide:
                                  const BorderSide(color: Color(0xFFDDE3E0)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(15),
                              borderSide:
                                  const BorderSide(color: primary, width: 1.5),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        FilledButton(
                          onPressed: canSubmit
                              ? () => Navigator.pop(sheetContext, true)
                              : null,
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(52),
                            backgroundColor: primary,
                            disabledBackgroundColor: const Color(0xFFD8DFDB),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14)),
                          ),
                          child: const Text('Submit review',
                              style: TextStyle(fontWeight: FontWeight.w800)),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ) ??
        false;
    if (!submitted) {
      comment.dispose();
      return;
    }
    try {
      final token = await native.invokeMethod<String>('readToken');
      if (token == null) throw const ApiFailure('Please sign in again.');
      await StudentApi(token: token)
          .saveReview(tutorial.id, rating, comment.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          duration: Duration(seconds: 6),
          content: Text(
              'Your review will be verified by admin and published within 24 hours.'),
        ));
      }
    } on ApiFailure catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(failure.message)));
      }
    } finally {
      comment.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final videos = tutorial.chapters.expand((c) => c.videos).toList();
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        backgroundColor: canvas,
        surfaceTintColor: canvas,
        title: const Brand(
            compact: true,
            showName: false,
            background: false,
            width: 112,
            height: 56),
        actions: [
          IconButton(onPressed: () {}, icon: const Icon(Icons.bookmark_border)),
          IconButton(onPressed: () {}, icon: const Icon(Icons.share_outlined))
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 10, 14, 100),
        children: [
          Align(
              alignment: Alignment.centerLeft,
              child: StatusPill(label: tutorial.category)),
          const SizedBox(height: 16),
          Hero(
              tag: 'course-${tutorial.id}',
              child:
                  CourseImage(tutorial: tutorial, height: 210, overlay: true)),
          const SizedBox(height: 14),
          SurfaceCard(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tutorial.title,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w700)),
              const SizedBox(height: 9),
              const Text(
                  'Build practical skills through focused, company-assigned video lessons and guided modules.',
                  style: TextStyle(color: muted, fontSize: 13, height: 1.5)),
              const SizedBox(height: 14),
              Wrap(spacing: 8, runSpacing: 8, children: [
                MetaChip(
                    icon: Icons.video_library_outlined,
                    label: '${tutorial.videoCount} Videos'),
                MetaChip(
                    icon: Icons.schedule_rounded,
                    label: '${courseDuration(tutorial)} min'),
                const MetaChip(
                    icon: Icons.assignment_turned_in_outlined,
                    label: 'Assigned'),
                const MetaChip(
                    icon: Icons.workspace_premium_outlined,
                    label: 'Certificate'),
              ]),
            ]),
          ),
          LiveCourseSessions(courseId: tutorial.id),
          const SizedBox(height: 22),
          SectionHeader(
              title: 'Course Videos',
              badge: '${tutorial.chapters.length} Modules',
              action:
                  '${tutorial.completedVideoCount} of ${videos.length} Completed'),
          const SizedBox(height: 10),
          if (videos.isEmpty)
            const EmptyTutorials(message: 'No ready videos in this course yet.')
          else
            ...videos.asMap().entries.map((entry) => VideoTile(
                number: entry.key + 1,
                video: entry.value,
                active:
                    !entry.value.completed && entry.value.progressSeconds > 0,
                complete: entry.value.completed,
                onTap: () => openVideo(context, entry.value))),
          const SizedBox(height: 20),
          SectionHeader(
              title: 'Attachments',
              action: '${tutorial.attachments.length} Files'),
          const SizedBox(height: 10),
          if (tutorial.attachments.isEmpty)
            const SurfaceCard(
                child: Center(child: Text('No attachment to download.')))
          else
            ...tutorial.attachments.map((attachment) => DownloadTile(
                icon: attachment.name.toLowerCase().endsWith('.pdf')
                    ? Icons.picture_as_pdf_outlined
                    : Icons.attach_file_rounded,
                title: attachment.name,
                subtitle:
                    '${formatFileSize(attachment.sizeBytes)} • ${attachmentType(attachment)}',
                onTap: () => downloadAttachment(context, attachment))),
          const SizedBox(height: 20),
          SectionHeader(
              title: 'Reviews', action: 'Write a Review', onTap: writeReview),
          const SizedBox(height: 10),
          if (reviews.isEmpty)
            const SurfaceCard(child: Center(child: Text('No review yet.')))
          else ...[
            SurfaceCard(
                child: Row(children: [
              Text(averageRating(reviews).toStringAsFixed(1),
                  style: const TextStyle(
                      fontSize: 29, fontWeight: FontWeight.w700)),
              const SizedBox(width: 10),
              Text(starRating(averageRating(reviews).round()),
                  style: const TextStyle(color: Colors.orange)),
              const Spacer(),
              Text('${reviews.length} reviews',
                  style: const TextStyle(color: muted, fontSize: 11))
            ])),
            const SizedBox(height: 10),
            ...reviews.map((review) => Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: SurfaceCard(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Row(children: [
                        Expanded(
                            child: Text(review.studentName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700))),
                        Text(starRating(review.rating),
                            style: const TextStyle(color: Colors.orange))
                      ]),
                      const SizedBox(height: 7),
                      Text(review.comment,
                          style: const TextStyle(color: muted, height: 1.4)),
                    ]))))
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton.icon(
            onPressed:
                videos.isEmpty ? null : () => openVideo(context, videos.first),
            style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                backgroundColor: accent,
                foregroundColor: Colors.white),
            icon: const Icon(Icons.play_arrow_rounded),
            label: const Text('Continue studying')),
      ),
    );
  }
}

class ProfileTab extends StatefulWidget {
  const ProfileTab(
      {super.key,
      required this.student,
      required this.tutorials,
      required this.api,
      required this.onUpdated});
  final Student student;
  final List<Tutorial> tutorials;
  final StudentApi api;
  final ValueChanged<Student> onUpdated;
  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  late final TextEditingController firstName, lastName, phone;
  bool saving = false;
  @override
  void initState() {
    super.initState();
    firstName = TextEditingController(text: widget.student.firstName);
    lastName = TextEditingController(text: widget.student.lastName);
    phone = TextEditingController(text: widget.student.phone);
  }

  @override
  void dispose() {
    firstName.dispose();
    lastName.dispose();
    phone.dispose();
    super.dispose();
  }

  Future<void> save() async {
    setState(() => saving = true);
    try {
      final value = await widget.api
          .updateProfile(firstName.text, lastName.text, phone.text);
      widget.onUpdated(value);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile updated successfully.')));
      }
    } on ApiFailure catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(failure.message)));
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  Future<void> editProfile() async => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        builder: (sheetContext) => Padding(
          padding: EdgeInsets.fromLTRB(
              20, 24, 20, MediaQuery.viewInsetsOf(sheetContext).bottom + 24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Text('Edit employee information',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
            const SizedBox(height: 18),
            TextField(
                controller: firstName,
                decoration: const InputDecoration(labelText: 'First name')),
            const SizedBox(height: 12),
            TextField(
                controller: lastName,
                decoration: const InputDecoration(labelText: 'Last name')),
            const SizedBox(height: 12),
            TextField(
                controller: phone,
                decoration: const InputDecoration(labelText: 'Phone number')),
            const SizedBox(height: 18),
            FilledButton(
                onPressed: saving
                    ? null
                    : () async {
                        await save();
                        if (sheetContext.mounted) Navigator.pop(sheetContext);
                      },
                style: FilledButton.styleFrom(
                    backgroundColor: accent,
                    minimumSize: const Size.fromHeight(50)),
                child: const Text('Save changes')),
          ]),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final initials =
        '${widget.student.firstName.isEmpty ? '' : widget.student.firstName[0]}${widget.student.lastName.isEmpty ? '' : widget.student.lastName[0]}';
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 116),
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
              gradient: const LinearGradient(
                  colors: [Colors.white, Color(0xFFE7FFF4)]),
              borderRadius: BorderRadius.circular(24)),
          child: Column(children: [
            Stack(children: [
              CircleAvatar(
                  radius: 54,
                  backgroundColor: const Color(0xFFCFF6EA),
                  child: Text(initials,
                      style: const TextStyle(
                          color: deepGreen,
                          fontSize: 30,
                          fontWeight: FontWeight.w700))),
              const Positioned(
                  right: 0,
                  bottom: 2,
                  child: CircleAvatar(
                      radius: 15,
                      backgroundColor: accent,
                      foregroundColor: Colors.white,
                      child: Icon(Icons.check_rounded, size: 18)))
            ]),
            const SizedBox(height: 14),
            Text('${widget.student.firstName} ${widget.student.lastName}',
                style:
                    const TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const MetaChip(
                icon: Icons.verified_user_outlined,
                label: 'Active Learner • Learning Workspace'),
            const SizedBox(height: 13),
            Text(BrandingScope.of(context).siteName,
                textAlign: TextAlign.center,
                style: const TextStyle(color: muted)),
            const SizedBox(height: 16),
            const StatusPill(label: 'Student account'),
          ]),
        ),
        const SizedBox(height: 18),
        Row(children: [
          Expanded(
              child: MetricCard(
                  value: '${widget.tutorials.length}', label: 'Assigned')),
          const SizedBox(width: 10),
          Expanded(
              child: MetricCard(
                  value:
                      '${widget.tutorials.where((value) => value.progressPercent >= 100).length}',
                  label: 'Completed',
                  highlighted: true)),
          const SizedBox(width: 10),
          Expanded(
              child: MetricCard(
                  value:
                      '${widget.tutorials.where((value) => value.progressPercent < 100).length}',
                  label: 'In Progress')),
        ]),
        const SizedBox(height: 18),
        SurfaceCard(
          child: Column(children: [
            Row(children: [
              const Icon(Icons.badge_outlined, color: teal),
              const SizedBox(width: 10),
              const Expanded(
                  child: Text('Employee Information',
                      style: TextStyle(
                          fontSize: 19, fontWeight: FontWeight.w700))),
              IconButton(
                  onPressed: editProfile,
                  icon: const Icon(Icons.edit_outlined, color: teal)),
            ]),
            InfoRow(
                icon: Icons.mail_outline_rounded,
                label: 'Email Address',
                value: widget.student.email),
            InfoRow(
                icon: Icons.phone_outlined,
                label: 'Corporate Phone',
                value: widget.student.phone.isEmpty
                    ? 'Not provided'
                    : widget.student.phone),
            const InfoRow(
                icon: Icons.calendar_month_outlined,
                label: 'Joined Date',
                value: 'Active employee'),
            const InfoRow(
                icon: Icons.apartment_rounded,
                label: 'Department',
                value: 'Learning & Development'),
          ]),
        ),
        const SizedBox(height: 18),
        const SurfaceCard(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('APP & TRAINING PREFERENCES',
                style: TextStyle(color: muted, fontSize: 12, letterSpacing: 1)),
            PreferenceRow(
                icon: Icons.cloud_download_outlined,
                title: 'Download Quality & Offline',
                subtitle: 'Smart cache on Wi-Fi only'),
            PreferenceRow(
                icon: Icons.notifications_active_outlined,
                title: 'Notification Preferences',
                subtitle: 'Daily reminders & deadline alerts'),
            PreferenceRow(
                icon: Icons.help_outline_rounded,
                title: 'Help & Learning Support',
                subtitle: 'IT desk, FAQs & instructor direct chat'),
          ]),
        ),
      ],
    );
  }
}

class AppDrawer extends StatelessWidget {
  const AppDrawer({
    super.key,
    required this.student,
    required this.selected,
    required this.onNavigate,
    required this.onSettings,
    required this.onHelp,
    required this.onLogout,
  });

  final Student student;
  final int selected;
  final ValueChanged<int> onNavigate;
  final VoidCallback onSettings;
  final VoidCallback onHelp;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final initials =
        '${student.firstName.isEmpty ? '' : student.firstName[0]}${student.lastName.isEmpty ? '' : student.lastName[0]}';
    return Drawer(
      width: MediaQuery.sizeOf(context).width * .84,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.horizontal(right: Radius.circular(26))),
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 18, 22),
              child: Row(
                children: [
                  const Brand(
                      showName: false,
                      background: false,
                      width: 190,
                      height: 82),
                  const Spacer(),
                  IconButton(
                    tooltip: 'Close menu',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [Color(0xFFEAF5FE), Color(0xFFE5FFF2)]),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: const Color(0xFFBDF2E7),
                    foregroundColor: deepGreen,
                    child: Text(initials,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${student.firstName} ${student.lastName}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 3),
                        Text(student.email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: muted, fontSize: 11)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            DrawerMenuItem(
              icon: Icons.home_outlined,
              label: 'Home',
              selected: selected == 0,
              onTap: () => onNavigate(0),
            ),
            DrawerMenuItem(
              icon: Icons.school_outlined,
              label: 'My Courses',
              selected: selected == 1,
              onTap: () => onNavigate(1),
            ),
            DrawerMenuItem(
              icon: Icons.settings_outlined,
              label: 'Settings',
              onTap: onSettings,
            ),
            DrawerMenuItem(
              icon: Icons.video_camera_front_outlined,
              label: 'Live Classes',
              selected: selected == 2,
              onTap: () => onNavigate(2),
            ),
            DrawerMenuItem(
              icon: Icons.support_agent_outlined,
              label: 'Help & Support',
              onTap: onHelp,
            ),
            const Spacer(),
            const Divider(height: 1, color: line),
            DrawerMenuItem(
              icon: Icons.logout_rounded,
              label: 'Log out',
              danger: true,
              onTap: onLogout,
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class DrawerMenuItem extends StatelessWidget {
  const DrawerMenuItem({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.selected = false,
    this.danger = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool selected;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final color = danger
        ? const Color(0xFFBA1A1A)
        : selected
            ? primary
            : ink;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 3),
      child: Material(
        color: selected ? const Color(0xFFE5FFE9) : Colors.transparent,
        borderRadius: BorderRadius.circular(14),
        child: ListTile(
          onTap: onTap,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          leading: Icon(icon, color: color),
          title: Text(label,
              style: TextStyle(color: color, fontWeight: FontWeight.w600)),
          trailing: danger
              ? null
              : Icon(Icons.chevron_right_rounded,
                  size: 19, color: selected ? primary : muted),
        ),
      ),
    );
  }
}

class SurfaceCard extends StatelessWidget {
  const SurfaceCard(
      {super.key,
      required this.child,
      this.padding = const EdgeInsets.all(16),
      this.onTap});
  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final box = Container(
        padding: padding,
        decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: line),
            boxShadow: const [
              BoxShadow(
                  color: Color(0x0A111B21),
                  blurRadius: 16,
                  offset: Offset(0, 4))
            ]),
        child: child);
    return onTap == null
        ? box
        : InkWell(
            onTap: onTap, borderRadius: BorderRadius.circular(16), child: box);
  }
}

class SectionHeader extends StatelessWidget {
  const SectionHeader(
      {super.key, required this.title, this.badge, this.action, this.onTap});
  final String title;
  final String? badge, action;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Row(children: [
        Expanded(
          child: Row(children: [
            Flexible(
                child: Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w700))),
            if (badge != null) ...[
              const SizedBox(width: 8),
              MetaChip(label: badge!)
            ],
          ]),
        ),
        if (action != null) const SizedBox(width: 10),
        if (action != null)
          InkWell(
              onTap: onTap,
              child: Text(action!,
                  style: const TextStyle(color: deepGreen, fontSize: 11)))
      ]);
}

class CourseImage extends StatelessWidget {
  const CourseImage(
      {super.key, required this.tutorial, this.height, this.overlay = false});
  final Tutorial tutorial;
  final double? height;
  final bool overlay;
  @override
  Widget build(BuildContext context) {
    final fallback = Container(
        height: height,
        decoration: const BoxDecoration(
            gradient:
                LinearGradient(colors: [Color(0xFFBFEADE), Color(0xFF6DAE9A)])),
        child: const Center(
            child: Icon(Icons.play_lesson_rounded,
                color: Colors.white, size: 54)));
    final image = tutorial.thumbnailUrl.isEmpty
        ? fallback
        : Image.network(tutorial.thumbnailUrl,
            height: height,
            width: double.infinity,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => fallback);
    if (!overlay) return image;
    return ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(alignment: Alignment.center, children: [
          SizedBox(width: double.infinity, height: height, child: image),
          const CircleAvatar(
              radius: 30,
              backgroundColor: accent,
              foregroundColor: ink,
              child: Icon(Icons.play_arrow_rounded, size: 32)),
          const Positioned(
              right: 12,
              top: 12,
              child:
                  MetaChip(icon: Icons.schedule_rounded, label: 'Self-paced')),
          const Positioned(
              left: 12,
              bottom: 12,
              child: StatusPill(label: 'Lesson in Progress'))
        ]));
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
            color: const Color(0xFFBDF2E7),
            borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
              width: 7,
              height: 7,
              decoration:
                  const BoxDecoration(color: accent, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(label,
              style: const TextStyle(
                  color: deepGreen, fontSize: 10, fontWeight: FontWeight.w600))
        ]),
      );
}

class MetaChip extends StatelessWidget {
  const MetaChip({super.key, required this.label, this.icon});
  final String label;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
            color: paleBlue, borderRadius: BorderRadius.circular(999)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: teal),
            const SizedBox(width: 5)
          ],
          Text(label, style: const TextStyle(color: deepGreen, fontSize: 10))
        ]),
      );
}

class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.value});
  final double value;
  @override
  Widget build(BuildContext context) => ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: LinearProgressIndicator(
          value: value,
          minHeight: 6,
          color: primary,
          backgroundColor: const Color(0xFFDDE7EF)));
}

class VideoTile extends StatelessWidget {
  const VideoTile(
      {super.key,
      required this.number,
      required this.video,
      required this.active,
      required this.complete,
      required this.onTap});
  final int number;
  final TutorialVideo video;
  final bool active, complete;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: SurfaceCard(
          padding: const EdgeInsets.all(10),
          onTap: onTap,
          child: Row(children: [
            SizedBox(
                width: 27,
                child: Text(number.toString().padLeft(2, '0'),
                    style: const TextStyle(fontSize: 10))),
            Container(
                width: 70,
                height: 48,
                decoration: BoxDecoration(
                    color: active ? const Color(0xFFBDF2E7) : paleBlue,
                    borderRadius: BorderRadius.circular(9)),
                child: Icon(
                    complete
                        ? Icons.check_circle_rounded
                        : Icons.play_circle_fill_rounded,
                    color: active || complete ? primary : muted)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(video.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text(
                      '${video.durationMinutes} min • ${complete ? 'Completed' : active ? 'Resume at ${formatVideoTime(video.progressSeconds)}' : 'Up next'}',
                      style: TextStyle(
                          fontSize: 10, color: active ? primary : muted))
                ]))
          ])));
}

class DownloadTile extends StatelessWidget {
  const DownloadTile(
      {super.key,
      required this.icon,
      required this.title,
      required this.subtitle,
      required this.onTap});
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 9),
      child: SurfaceCard(
          padding: const EdgeInsets.all(12),
          onTap: onTap,
          child: Row(children: [
            CircleAvatar(
                backgroundColor: const Color(0xFFDFF5F0),
                foregroundColor: teal,
                child: Icon(icon)),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(subtitle,
                      style: const TextStyle(color: muted, fontSize: 10))
                ])),
            const Icon(Icons.download_rounded, color: teal)
          ])));
}

String formatFileSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
}

String attachmentType(TutorialAttachment attachment) {
  if (attachment.mimeType == 'application/pdf') return 'PDF document';
  if (attachment.mimeType.contains('zip')) return 'Archive';
  if (attachment.mimeType.contains('word')) return 'Word document';
  if (attachment.mimeType.contains('presentation') ||
      attachment.mimeType.contains('powerpoint')) {
    return 'Presentation';
  }
  return 'Course resource';
}

double averageRating(List<TutorialReview> reviews) =>
    reviews.fold<int>(0, (total, review) => total + review.rating) /
    reviews.length;

String starRating(int rating) =>
    '${'★' * rating}${'☆' * (5 - rating.clamp(0, 5))}';

class MetricCard extends StatelessWidget {
  const MetricCard(
      {super.key,
      required this.value,
      required this.label,
      this.highlighted = false});
  final String value, label;
  final bool highlighted;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(vertical: 20),
      decoration: BoxDecoration(
          color: highlighted ? const Color(0xFFD9FAF2) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: line)),
      child: Column(children: [
        Text(value,
            style: TextStyle(
                color: highlighted ? primary : ink,
                fontSize: 30,
                fontWeight: FontWeight.w700)),
        Text(label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted, fontSize: 11))
      ]));
}

class InfoRow extends StatelessWidget {
  const InfoRow(
      {super.key,
      required this.icon,
      required this.label,
      required this.value});
  final IconData icon;
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(children: [
        CircleAvatar(
            backgroundColor: paleBlue,
            foregroundColor: teal,
            child: Icon(icon, size: 21)),
        const SizedBox(width: 14),
        Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Text(label, style: const TextStyle(color: muted, fontSize: 11)),
              Text(value)
            ]))
      ]));
}

class PreferenceRow extends StatelessWidget {
  const PreferenceRow(
      {super.key,
      required this.icon,
      required this.title,
      required this.subtitle});
  final IconData icon;
  final String title, subtitle;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(children: [
        CircleAvatar(
            backgroundColor: paleBlue,
            foregroundColor: teal,
            child: Icon(icon)),
        const SizedBox(width: 13),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
          Text(subtitle, style: const TextStyle(color: muted, fontSize: 12))
        ])),
        const Icon(Icons.chevron_right_rounded, color: muted)
      ]));
}

class Brand extends StatelessWidget {
  const Brand({
    super.key,
    this.compact = false,
    this.hero = false,
    this.showName = true,
    this.background = true,
    this.width,
    this.height,
  });
  final bool compact, hero, showName, background;
  final double? width, height;
  @override
  Widget build(BuildContext context) {
    final brand = BrandingScope.of(context);
    final mark = Container(
        width: width ?? (hero ? 120 : (compact ? 68 : 62)),
        height: height ?? (hero ? 88 : (compact ? 50 : 52)),
        padding: EdgeInsets.all(background ? 5 : 0),
        decoration: background
            ? BoxDecoration(
                color: paleBlue,
                borderRadius: BorderRadius.circular(hero ? 22 : 12))
            : null,
        child: brand.logoUrl.isEmpty
            ? const Icon(Icons.school_rounded, color: primary)
            : Image.network(brand.logoUrl,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) =>
                    const Icon(Icons.school_rounded, color: primary)));
    if (hero || !showName) return mark;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      mark,
      const SizedBox(width: 8),
      ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 150),
          child: Text(brand.appName,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)))
    ]);
  }
}

class Message extends StatelessWidget {
  const Message(this.message, {super.key, this.error = false});
  final String message;
  final bool error;
  @override
  Widget build(BuildContext context) => Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: error ? const Color(0xFFFFDAD6) : const Color(0xFFDFF5F0),
          borderRadius: BorderRadius.circular(10)),
      child: Text(message,
          style: TextStyle(
              color: error ? const Color(0xFF93000A) : deepGreen,
              fontSize: 12)));
}

class EmptyTutorials extends StatelessWidget {
  const EmptyTutorials(
      {super.key, this.message = 'No tutorials assigned yet.'});
  final String message;
  @override
  Widget build(BuildContext context) => SurfaceCard(
          child: Column(children: [
        const Icon(Icons.menu_book_outlined, color: teal, size: 42),
        const SizedBox(height: 10),
        Text(message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        const SizedBox(height: 5),
        const Text(
            'Your learning team can assign courses from the admin panel.',
            textAlign: TextAlign.center,
            style: TextStyle(color: muted, fontSize: 12))
      ]));
}

void openCourse(BuildContext context, Tutorial tutorial) =>
    Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TutorialPage(tutorial: tutorial)));

int courseDuration(Tutorial tutorial) => tutorial.chapters.fold(
    0,
    (total, chapter) =>
        total +
        chapter.videos.fold(0, (sum, video) => sum + video.durationMinutes));

String nextLesson(Tutorial tutorial) {
  for (final chapter in tutorial.chapters) {
    for (final video in chapter.videos) {
      if (!video.completed) return video.title;
    }
  }
  return tutorial.videoCount > 0 ? 'Course completed' : 'Course overview';
}

String formatVideoTime(int seconds) {
  final safe = seconds.clamp(0, 60 * 60 * 24);
  final minutes = safe ~/ 60;
  final remaining = safe % 60;
  return '$minutes:${remaining.toString().padLeft(2, '0')}';
}
