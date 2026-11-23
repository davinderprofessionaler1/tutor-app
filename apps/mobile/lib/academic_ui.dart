part of 'student_app.dart';

const _mint = Color(0xFFA5EDE0);
const _softBlue = Color(0xFFEAF5FE);

/// Flutter implementation of the supplied Academic Clarity screens.
/// Content, progress, admission and navigation use the existing app services.
class _AcademicLogin extends StatelessWidget {
  const _AcademicLogin(
      {required this.email,
      required this.otp,
      required this.codeSent,
      required this.loading,
      required this.error,
      required this.notice,
      required this.resendSeconds,
      required this.onSubmit,
      required this.onResend,
      required this.onEditEmail});
  final TextEditingController email, otp;
  final bool codeSent, loading;
  final String? error, notice;
  final int resendSeconds;
  final VoidCallback onSubmit, onResend, onEditEmail;

  @override
  Widget build(BuildContext context) {
    final brand = BrandingScope.of(context);
    return Scaffold(
        body: SafeArea(
            child: Center(
                child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 480),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(
                child: Container(
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                        color: const Color(0xFFE5EFF8),
                        borderRadius: BorderRadius.circular(40)),
                    child: Row(children: [
                      _LoginStep(
                          label: '1. Email',
                          icon: Icons.mail_outline,
                          selected: !codeSent),
                      _LoginStep(
                          label: '2. OTP Code',
                          icon: Icons.password_rounded,
                          selected: codeSent),
                    ]))),
            const SizedBox(width: 8),
            const Icon(Icons.circle, size: 8, color: accent),
            const SizedBox(width: 5),
            const Text('Student Portal',
                style: TextStyle(color: deepGreen, fontSize: 11)),
          ]),
          const SizedBox(height: 32),
          Center(
              child: Stack(clipBehavior: Clip.none, children: [
            Container(
                width: 78,
                height: 78,
                decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(22)),
                child: const Padding(
                    padding: EdgeInsets.all(12),
                    child: Brand(
                        showName: false,
                        background: false,
                        width: 54,
                        height: 54))),
            const Positioned(
                bottom: -4,
                right: -4,
                child: CircleAvatar(
                    radius: 13,
                    backgroundColor: primary,
                    child: Icon(Icons.verified_outlined,
                        size: 17, color: Colors.white))),
          ])),
          const SizedBox(height: 26),
          Text(
              codeSent
                  ? 'Check your email'
                  : 'Welcome back to ${brand.appName}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 28,
                  height: 1.15,
                  letterSpacing: -.8,
                  fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          Text(
              codeSent
                  ? 'Enter the 6-digit login code sent to\n${email.text.trim()}'
                  : 'Enter your university or work email to receive a secure login code.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 15, height: 1.5, color: muted)),
          const SizedBox(height: 28),
          SurfaceCard(
              padding: const EdgeInsets.all(18),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                        codeSent
                            ? '6-Digit Access Code'
                            : 'Academic or Organization Email',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14)),
                    const SizedBox(height: 10),
                    TextField(
                      key: ValueKey(codeSent),
                      controller: codeSent ? otp : email,
                      enabled: !loading,
                      autofocus: codeSent,
                      keyboardType: codeSent
                          ? TextInputType.number
                          : TextInputType.emailAddress,
                      textInputAction: TextInputAction.done,
                      autofillHints: [
                        codeSent
                            ? AutofillHints.oneTimeCode
                            : AutofillHints.email
                      ],
                      autocorrect: false,
                      inputFormatters: codeSent
                          ? [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(6)
                            ]
                          : null,
                      textAlign: codeSent ? TextAlign.center : TextAlign.start,
                      onSubmitted: (_) => onSubmit(),
                      style: TextStyle(
                          fontSize: codeSent ? 24 : 15,
                          letterSpacing: codeSent ? 10 : 0,
                          color: ink),
                      decoration: InputDecoration(
                          hintText:
                              codeSent ? '000000' : 'you@organization.com',
                          fillColor: _softBlue,
                          enabledBorder: OutlineInputBorder(
                              borderSide: BorderSide.none,
                              borderRadius: BorderRadius.circular(12)),
                          prefixIcon: Icon(
                              codeSent
                                  ? Icons.password_rounded
                                  : Icons.alternate_email,
                              color: deepGreen),
                          suffixIcon: codeSent
                              ? null
                              : IconButton(
                                  tooltip: 'Clear email',
                                  onPressed: loading ? null : email.clear,
                                  icon: const Icon(Icons.cancel_outlined,
                                      size: 20, color: muted))),
                    ),
                    const SizedBox(height: 12),
                    Row(children: [
                      const Icon(Icons.mark_email_read_outlined,
                          color: teal, size: 17),
                      const SizedBox(width: 8),
                      Expanded(
                          child: Text(
                              codeSent
                                  ? 'Use the latest code from your inbox.'
                                  : 'Use the email assigned by your learning team.',
                              style: const TextStyle(
                                  color: deepGreen,
                                  fontSize: 12,
                                  height: 1.4))),
                    ]),
                    if (error != null) Message(error!, error: true),
                    if (notice != null) Message(notice!),
                  ])),
          const SizedBox(height: 16),
          Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: _softBlue, borderRadius: BorderRadius.circular(16)),
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                        color: _mint, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.key_outlined,
                        color: deepGreen, size: 22)),
                const SizedBox(width: 12),
                const Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text('Passwordless & Protected',
                          style: TextStyle(fontWeight: FontWeight.w600)),
                      SizedBox(height: 4),
                      Text(
                          'Sign in with a one-time email code. No password to remember.',
                          style: TextStyle(
                              color: muted, fontSize: 13, height: 1.45)),
                    ])),
              ])),
          const SizedBox(height: 24),
          FilledButton.icon(
              onPressed: loading ? null : onSubmit,
              style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(54)),
              iconAlignment: IconAlignment.end,
              icon: loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Icon(Icons.arrow_forward_rounded),
              label: Text(codeSent ? 'Verify & Sign In' : 'Send Login Code')),
          if (codeSent) ...[
            const SizedBox(height: 6),
            Wrap(alignment: WrapAlignment.center, children: [
              TextButton(
                  onPressed: loading ? null : onEditEmail,
                  child: const Text('Edit email')),
              TextButton(
                  onPressed: loading || resendSeconds > 0 ? null : onResend,
                  child: Text(resendSeconds > 0
                      ? 'Resend in ${resendSeconds}s'
                      : 'Resend code')),
            ]),
          ],
          const SizedBox(height: 26),
          const Center(
              child: MetaChip(
                  icon: Icons.lock_outline,
                  label: 'Your student learning workspace')),
          const SizedBox(height: 10),
          Text(brand.siteName,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 12, color: muted)),
        ]),
      ),
    ))));
  }
}

class _LoginStep extends StatelessWidget {
  const _LoginStep(
      {required this.label, required this.icon, required this.selected});
  final String label;
  final IconData icon;
  final bool selected;
  @override
  Widget build(BuildContext context) => Expanded(
      child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
              color: selected ? primary : Colors.transparent,
              borderRadius: BorderRadius.circular(30)),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 15, color: selected ? Colors.white : muted),
            const SizedBox(width: 5),
            Flexible(
                child: Text(label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 12, color: selected ? Colors.white : ink))),
          ])));
}

class _AcademicAppBar extends StatelessWidget implements PreferredSizeWidget {
  const _AcademicAppBar(
      {required this.title,
      required this.student,
      required this.unread,
      required this.onMenu,
      required this.onNotifications,
      required this.onProfile,
      this.onHistory});
  final String title;
  final Student student;
  final int unread;
  final VoidCallback onMenu, onNotifications, onProfile;
  final VoidCallback? onHistory;
  @override
  Size get preferredSize => const Size.fromHeight(68);
  @override
  Widget build(BuildContext context) => AppBar(
          toolbarHeight: 68,
          titleSpacing: 4,
          leadingWidth: 58,
          leading: IconButton(
              tooltip: 'Open menu',
              onPressed: onMenu,
              icon: const Brand(
                  showName: false, background: false, width: 36, height: 36)),
          title: Text(title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -.5)),
          actions: [
            if (onHistory != null)
              IconButton(
                  tooltip: 'Attendance history',
                  onPressed: onHistory,
                  icon: const Icon(Icons.history_rounded, size: 22)),
            IconButton(
                tooltip: 'Class notifications',
                onPressed: onNotifications,
                icon: Badge(
                    isLabelVisible: unread > 0,
                    backgroundColor: primary,
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: const Icon(Icons.notifications_none_rounded,
                        size: 25))),
            Padding(
                padding: const EdgeInsets.only(right: 12),
                child: IconButton(
                    tooltip: 'Open profile',
                    onPressed: onProfile,
                    icon: CircleAvatar(
                        radius: 18,
                        backgroundColor: _mint,
                        foregroundColor: deepGreen,
                        child: Text(_initials(student),
                            style: const TextStyle(
                                fontSize: 13, fontWeight: FontWeight.w700))))),
          ]);
}

String _initials(Student student) =>
    '${student.firstName.isEmpty ? '' : student.firstName[0]}${student.lastName.isEmpty ? '' : student.lastName[0]}'
        .toUpperCase();

class HomeTab extends StatelessWidget {
  const HomeTab(
      {super.key,
      required this.student,
      required this.tutorials,
      required this.featuredTutorials,
      required this.onRefresh,
      required this.onCourses,
      this.sessions = const [],
      this.liveApi,
      this.liveLoading = false,
      this.liveError,
      this.onLiveRetry,
      this.onLiveClasses});
  final Student student;
  final List<Tutorial> tutorials, featuredTutorials;
  final List<LiveClass> sessions;
  final LiveApi? liveApi;
  final bool liveLoading;
  final String? liveError;
  final Future<void> Function() onRefresh;
  final VoidCallback onCourses;
  final VoidCallback? onLiveRetry, onLiveClasses;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final candidates = sessions
        .where((value) =>
            value.accessible &&
            !value.sessionEnded &&
            (value.status == 'Live' ||
                value.status == 'Scheduled' && value.startsAt.isAfter(now)))
        .toList()
      ..sort((a, b) {
        if (a.status == 'Live' && b.status != 'Live') return -1;
        if (b.status == 'Live' && a.status != 'Live') return 1;
        return a.startsAt.compareTo(b.startsAt);
      });
    final continuing = tutorials
        .where((t) => t.progressPercent > 0 && t.progressPercent < 100)
        .toList();
    final resume = continuing.isNotEmpty
        ? continuing.first
        : tutorials.where((t) => t.progressPercent < 100).firstOrNull;
    final todayCount = candidates.where((c) {
      final date = c.startsAt.toLocal();
      return date.year == now.year &&
          date.month == now.month &&
          date.day == now.day;
    }).length;
    final greeting = now.hour < 12
        ? 'Good morning'
        : now.hour < 17
            ? 'Good afternoon'
            : 'Good evening';
    return RefreshIndicator(
        color: primary,
        onRefresh: onRefresh,
        child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: [
              Row(children: [
                Expanded(
                    child: Text(_academicDate(now).toUpperCase(),
                        style: const TextStyle(
                            fontSize: 11,
                            color: deepGreen,
                            letterSpacing: .7))),
                if (student.status == 'Active')
                  const StatusPill(label: 'Active Learner'),
              ]),
              const SizedBox(height: 10),
              Text(
                  '$greeting, ${student.firstName.isEmpty ? 'Learner' : student.firstName}!',
                  style: const TextStyle(
                      fontSize: 27,
                      height: 1.15,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -.9)),
              const SizedBox(height: 8),
              Text(
                  todayCount > 0
                      ? 'Ready to learn? You have $todayCount ${todayCount == 1 ? 'class' : 'classes'} scheduled today.'
                      : 'Make time for your next step. Your learning continues here.',
                  style:
                      const TextStyle(color: muted, fontSize: 13, height: 1.5)),
              const SizedBox(height: 22),
              if (liveLoading)
                const _DashboardNotice(
                    icon: Icons.video_camera_front_outlined,
                    title: 'Checking your live sessions…',
                    description: 'Your next class will appear here.')
              else if (liveError != null)
                _DashboardNotice(
                    icon: Icons.cloud_off_outlined,
                    title: 'Live sessions unavailable',
                    description: liveError!,
                    onTap: onLiveRetry,
                    action: 'Retry')
              else if (candidates.isNotEmpty)
                _UpcomingSession(
                    value: candidates.first,
                    onTap: () async {
                      if (liveApi == null) {
                        onLiveClasses?.call();
                        return;
                      }
                      await Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => LiveClassDetails(
                                  api: liveApi!, value: candidates.first)));
                      await onRefresh();
                    })
              else
                _DashboardNotice(
                    icon: Icons.video_camera_front_outlined,
                    title: 'Your next live session',
                    description:
                        'Explore scheduled classes and join your next workshop.',
                    action: 'View classes',
                    onTap: onLiveClasses),
              const SizedBox(height: 24),
              if (resume != null) ...[
                SectionHeader(
                    title: 'Continue Learning',
                    action: 'My courses',
                    onTap: onCourses),
                const SizedBox(height: 12),
                _ResumeCourse(tutorial: resume),
                const SizedBox(height: 24),
              ],
              SectionHeader(
                  title: 'Assigned Courses',
                  action: 'View All (${tutorials.length})',
                  onTap: onCourses),
              const SizedBox(height: 12),
              if (tutorials.isEmpty)
                const EmptyTutorials()
              else
                ...tutorials
                    .take(3)
                    .map((value) => _AssignedCourse(tutorial: value)),
              if (featuredTutorials.isNotEmpty) ...[
                const SizedBox(height: 14),
                const Row(children: [
                  Icon(Icons.auto_awesome_outlined, color: primary, size: 19),
                  SizedBox(width: 8),
                  Text('Featured For You',
                      style:
                          TextStyle(fontSize: 17, fontWeight: FontWeight.w700))
                ]),
                const SizedBox(height: 12),
                ...featuredTutorials.take(2).map((value) => Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _FeaturedAcademicCourse(tutorial: value))),
              ],
            ]));
  }
}

String _academicDate(DateTime date) {
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
  ];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec'
  ];
  return '${days[date.weekday - 1]}, ${date.day} ${months[date.month - 1]}';
}

class _UpcomingSession extends StatelessWidget {
  const _UpcomingSession({required this.value, required this.onTap});
  final LiveClass value;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final start = value.startsAt.toLocal();
    final now = DateTime.now();
    final today = start.year == now.year &&
        start.month == now.month &&
        start.day == now.day;
    final hour = start.hour % 12 == 0 ? 12 : start.hour % 12;
    final live = value.status == 'Live';
    return SurfaceCard(
        padding: EdgeInsets.zero,
        onTap: onTap,
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
              padding: const EdgeInsets.all(16),
              child:
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      _AcademicTag(
                          label: live
                              ? 'LIVE NOW'
                              : today
                                  ? 'TODAY'
                                  : 'UPCOMING',
                          color: live ? const Color(0xFFFFDAD6) : _mint,
                          foreground:
                              live ? const Color(0xFF93000A) : deepGreen,
                          icon: live ? Icons.circle : Icons.schedule_outlined),
                      const SizedBox(height: 10),
                      Text(value.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              height: 1.2)),
                      const SizedBox(height: 8),
                      Text('${value.teacher} · ${value.duration} mins',
                          style: const TextStyle(color: muted, fontSize: 12)),
                      if (!today)
                        Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(_academicDate(start),
                                style: const TextStyle(
                                    color: deepGreen, fontSize: 12))),
                    ])),
                const SizedBox(width: 12),
                Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                        color: _softBlue,
                        borderRadius: BorderRadius.circular(10)),
                    child: Column(children: [
                      Text('$hour:${start.minute.toString().padLeft(2, '0')}',
                          style: const TextStyle(
                              fontSize: 20,
                              color: primary,
                              fontWeight: FontWeight.w700)),
                      Text(
                          '${start.hour < 12 ? 'AM' : 'PM'} ${start.timeZoneName}',
                          style: const TextStyle(fontSize: 10, color: muted)),
                    ])),
              ])),
          Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 12, 8),
              decoration: const BoxDecoration(
                  color: canvas,
                  borderRadius:
                      BorderRadius.vertical(bottom: Radius.circular(16))),
              child: Row(children: [
                const Icon(Icons.groups_outlined, color: primary, size: 18),
                const SizedBox(width: 6),
                const Expanded(
                    child: Text('Live classroom',
                        style: TextStyle(fontSize: 12, color: muted))),
                const SizedBox(width: 6),
                FilledButton.icon(
                    onPressed: onTap,
                    iconAlignment: IconAlignment.end,
                    style: FilledButton.styleFrom(
                        backgroundColor: deepGreen,
                        minimumSize: const Size(48, 44),
                        padding: const EdgeInsets.symmetric(horizontal: 12)),
                    icon: const Icon(Icons.arrow_forward, size: 17),
                    label: Text(live ? 'Open Classroom' : 'View Details',
                        style: const TextStyle(fontSize: 12))),
              ])),
        ]));
  }
}

class _DashboardNotice extends StatelessWidget {
  const _DashboardNotice(
      {required this.icon,
      required this.title,
      required this.description,
      this.action,
      this.onTap});
  final IconData icon;
  final String title, description;
  final String? action;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => SurfaceCard(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
                color: _softBlue, borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: deepGreen, size: 23)),
        const SizedBox(width: 12),
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 5),
          Text(description,
              style: const TextStyle(color: muted, fontSize: 12, height: 1.45)),
          if (action != null && onTap != null)
            TextButton(
                onPressed: onTap,
                style: TextButton.styleFrom(
                    padding: EdgeInsets.zero, foregroundColor: deepGreen),
                child: Text('$action →')),
        ])),
      ]));
}

class _ResumeCourse extends StatelessWidget {
  const _ResumeCourse({required this.tutorial});
  final Tutorial tutorial;
  @override
  Widget build(BuildContext context) => SurfaceCard(
      padding: EdgeInsets.zero,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child: Stack(children: [
              SizedBox(
                  height: 154,
                  width: double.infinity,
                  child: CourseImage(tutorial: tutorial)),
              const Positioned.fill(
                  child: DecoratedBox(
                      decoration: BoxDecoration(
                          gradient: LinearGradient(
                              begin: Alignment.center,
                              end: Alignment.bottomCenter,
                              colors: [
                    Colors.transparent,
                    Color(0x99002211)
                  ])))),
              Positioned(
                  left: 14,
                  right: 14,
                  bottom: 12,
                  child: Row(children: [
                    Flexible(
                        child: _AcademicTag(
                            label: tutorial.category.toUpperCase(),
                            color: Colors.white)),
                    const SizedBox(width: 8),
                    const Spacer(),
                    _AcademicTag(
                        label: '${tutorial.progressPercent}% Complete',
                        color: primary,
                        foreground: Colors.white),
                  ])),
            ])),
        Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(tutorial.title,
                      style: const TextStyle(
                          fontSize: 19,
                          fontWeight: FontWeight.w700,
                          height: 1.25)),
                  const SizedBox(height: 8),
                  Row(children: [
                    const Icon(Icons.play_circle_outline,
                        color: primary, size: 17),
                    const SizedBox(width: 7),
                    Expanded(
                        child: Text(nextLesson(tutorial),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: muted, fontSize: 13)))
                  ]),
                  const SizedBox(height: 12),
                  ProgressBar(value: tutorial.progressPercent / 100),
                  const SizedBox(height: 7),
                  Text(
                      '${tutorial.completedVideoCount} of ${tutorial.videoCount} lessons completed',
                      style: const TextStyle(color: muted, fontSize: 11)),
                  const SizedBox(height: 14),
                  FilledButton.icon(
                      onPressed: () => openCourse(context, tutorial),
                      icon: const Icon(Icons.play_arrow_outlined, size: 20),
                      label: Text(tutorial.progressPercent > 0
                          ? 'Resume Lesson'
                          : 'Start Learning')),
                ])),
      ]));
}

class _AssignedCourse extends StatelessWidget {
  const _AssignedCourse({required this.tutorial});
  final Tutorial tutorial;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: SurfaceCard(
          onTap: () => openCourse(context, tutorial),
          padding: const EdgeInsets.all(14),
          child: Row(children: [
            ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                    width: 58,
                    height: 64,
                    child: CourseImage(tutorial: tutorial))),
            const SizedBox(width: 12),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(tutorial.category.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          color: deepGreen,
                          fontSize: 10,
                          fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text(tutorial.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          height: 1.25)),
                  const SizedBox(height: 8),
                  Row(children: [
                    Expanded(
                        child:
                            ProgressBar(value: tutorial.progressPercent / 100)),
                    const SizedBox(width: 8),
                    Text('${tutorial.progressPercent}%',
                        style: const TextStyle(
                            color: primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600))
                  ]),
                ])),
            const SizedBox(width: 12),
            const CircleAvatar(
                radius: 18,
                backgroundColor: _softBlue,
                child: Icon(Icons.chevron_right, color: primary, size: 22)),
          ])));
}

class _FeaturedAcademicCourse extends StatelessWidget {
  const _FeaturedAcademicCourse({required this.tutorial});
  final Tutorial tutorial;
  @override
  Widget build(BuildContext context) => SurfaceCard(
      padding: EdgeInsets.zero,
      onTap: () => openCourse(context, tutorial),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        ClipRRect(
            borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            child:
                SizedBox(height: 150, child: CourseImage(tutorial: tutorial))),
        Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              _AcademicTag(label: tutorial.category, color: _softBlue),
              const SizedBox(height: 10),
              Text(tutorial.title,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700, height: 1.3)),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                    child: Text(
                        '${tutorial.videoCount} lessons · ${courseDuration(tutorial)} mins',
                        style: const TextStyle(color: muted, fontSize: 12))),
                const SizedBox(width: 8),
                TextButton.icon(
                    onPressed: () => openCourse(context, tutorial),
                    style: TextButton.styleFrom(
                        backgroundColor: _mint,
                        foregroundColor: deepGreen,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12))),
                    iconAlignment: IconAlignment.end,
                    icon: const Icon(Icons.arrow_forward, size: 17),
                    label: const Text('View Course',
                        style: TextStyle(fontSize: 12))),
              ]),
            ])),
      ]));
}

class CoursesTab extends StatefulWidget {
  const CoursesTab(
      {super.key, required this.tutorials, required this.onRefresh});
  final List<Tutorial> tutorials;
  final Future<void> Function() onRefresh;
  @override
  State<CoursesTab> createState() => _CoursesTabState();
}

class _CoursesTabState extends State<CoursesTab>
    with AutomaticKeepAliveClientMixin {
  String query = '', filter = 'All';
  @override
  bool get wantKeepAlive => true;
  @override
  Widget build(BuildContext context) {
    super.build(context);
    final completed =
        widget.tutorials.where((value) => value.progressPercent >= 100).length;
    final counts = {
      'All': widget.tutorials.length,
      'In Progress': widget.tutorials.length - completed,
      'Completed': completed
    };
    final visible = widget.tutorials.where((value) {
      final matches =
          '${value.title} ${value.category} ${value.chapters.map((c) => c.title).join(' ')}'
              .toLowerCase()
              .contains(query.trim().toLowerCase());
      return matches &&
          (filter == 'All' ||
              (filter == 'Completed'
                  ? value.progressPercent >= 100
                  : value.progressPercent < 100));
    }).toList();
    return RefreshIndicator(
        color: primary,
        onRefresh: widget.onRefresh,
        child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 6, 20, 22),
                  sliver: SliverToBoxAdapter(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        TextField(
                            onChanged: (value) => setState(() => query = value),
                            decoration: InputDecoration(
                                hintText: 'Search enrolled courses or topics…',
                                hintStyle:
                                    const TextStyle(color: muted, fontSize: 14),
                                prefixIcon: const Icon(Icons.search_rounded,
                                    color: muted),
                                fillColor: _softBlue,
                                enabledBorder: OutlineInputBorder(
                                    borderSide: BorderSide.none,
                                    borderRadius: BorderRadius.circular(16)))),
                        const SizedBox(height: 14),
                        SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                                children: counts.entries
                                    .map((entry) => Padding(
                                        padding:
                                            const EdgeInsets.only(right: 7),
                                        child: ChoiceChip(
                                            showCheckmark: false,
                                            selected: filter == entry.key,
                                            onSelected: (_) => setState(
                                                () => filter = entry.key),
                                            backgroundColor: _softBlue,
                                            selectedColor: primary,
                                            side: BorderSide.none,
                                            shape: const StadiumBorder(),
                                            labelPadding:
                                                const EdgeInsets.symmetric(
                                                    horizontal: 6),
                                            label: Row(
                                                mainAxisSize: MainAxisSize.min,
                                                children: [
                                                  Text(entry.key,
                                                      style: TextStyle(
                                                          fontSize: 13,
                                                          color: filter ==
                                                                  entry.key
                                                              ? Colors.white
                                                              : ink)),
                                                  const SizedBox(width: 7),
                                                  Container(
                                                      padding: const EdgeInsets
                                                          .symmetric(
                                                          horizontal: 6,
                                                          vertical: 1),
                                                      decoration: BoxDecoration(
                                                          color: filter ==
                                                                  entry.key
                                                              ? Colors.white24
                                                              : const Color(
                                                                  0xFFDDEBF4),
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      12)),
                                                      child: Text(
                                                          '${entry.value}',
                                                          style: TextStyle(
                                                              fontSize: 11,
                                                              color: filter ==
                                                                      entry.key
                                                                  ? Colors.white
                                                                  : muted))),
                                                ]))))
                                    .toList())),
                      ]))),
              if (visible.isEmpty)
                SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverToBoxAdapter(
                        child: _DashboardNotice(
                            icon: Icons.menu_book_outlined,
                            title: widget.tutorials.isEmpty
                                ? 'Your courses will appear here'
                                : 'No matching courses',
                            description: widget.tutorials.isEmpty
                                ? 'Your learning team can assign your first course.'
                                : 'Try another search or course filter.')))
              else
                SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList.builder(
                        itemCount: visible.length,
                        itemBuilder: (_, index) => CourseCard(
                            tutorial: visible[index], index: index))),
              const SliverToBoxAdapter(child: SizedBox(height: 28)),
            ]));
  }
}

class CourseCard extends StatelessWidget {
  const CourseCard({super.key, required this.tutorial, required this.index});
  final Tutorial tutorial;
  final int index;
  @override
  Widget build(BuildContext context) {
    final done = tutorial.progressPercent >= 100;
    return Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: SurfaceCard(
            padding: const EdgeInsets.all(16),
            onTap: () => openCourse(context, tutorial),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  LayoutBuilder(builder: (context, constraints) {
                    final narrow = constraints.maxWidth < 290;
                    final image = ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: SizedBox(
                            width: narrow ? 76 : 100,
                            height: narrow ? 90 : 108,
                            child: CourseImage(tutorial: tutorial)));
                    return Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          image,
                          const SizedBox(width: 14),
                          Expanded(
                              child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                _AcademicTag(
                                    label: done
                                        ? 'COMPLETED'
                                        : tutorial.progressPercent > 0
                                            ? 'IN PROGRESS'
                                            : 'ASSIGNED',
                                    color:
                                        done ? const Color(0xFF9BF7A9) : _mint,
                                    icon: done
                                        ? Icons.check_circle_outline
                                        : null),
                                const SizedBox(height: 8),
                                Text(tutorial.title,
                                    style: const TextStyle(
                                        fontSize: 19,
                                        fontWeight: FontWeight.w700,
                                        height: 1.25,
                                        letterSpacing: -.4)),
                                const SizedBox(height: 8),
                                Text(
                                    '${tutorial.videoCount} lessons · ${tutorial.category}',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: muted,
                                        height: 1.4)),
                              ])),
                        ]);
                  }),
                  const SizedBox(height: 14),
                  Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                          color: canvas,
                          borderRadius: BorderRadius.circular(10)),
                      child: Column(children: [
                        Row(children: [
                          Icon(
                              done
                                  ? Icons.check_circle_outline
                                  : Icons.play_circle_outline,
                              color: primary,
                              size: 18),
                          const SizedBox(width: 7),
                          Expanded(
                              child: Text(
                                  done
                                      ? 'All lessons completed'
                                      : 'Next: ${nextLesson(tutorial)}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontSize: 13,
                                      color: primary,
                                      fontWeight: FontWeight.w600))),
                          const SizedBox(width: 10),
                          Text('${tutorial.progressPercent}%',
                              style: const TextStyle(
                                  color: primary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700)),
                        ]),
                        const SizedBox(height: 8),
                        ProgressBar(value: tutorial.progressPercent / 100),
                      ])),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                      onPressed: () => openCourse(context, tutorial),
                      style: FilledButton.styleFrom(
                          backgroundColor:
                              done ? _softBlue : const Color(0xFFDFEAF2),
                          foregroundColor: done ? primary : ink,
                          minimumSize: const Size.fromHeight(48),
                          textStyle: const TextStyle(
                              fontFamily: 'RobotoFlex',
                              fontSize: 14,
                              fontWeight: FontWeight.w500)),
                      iconAlignment: IconAlignment.end,
                      icon: Icon(
                          done
                              ? Icons.replay_rounded
                              : Icons.arrow_forward_rounded,
                          size: 20),
                      label: Text(done
                          ? 'Review Course'
                          : tutorial.progressPercent > 0
                              ? 'Continue Learning'
                              : 'Start Course')),
                ])));
  }
}

class _AcademicTag extends StatelessWidget {
  const _AcademicTag(
      {required this.label,
      required this.color,
      this.foreground = deepGreen,
      this.icon});
  final String label;
  final Color color, foreground;
  final IconData? icon;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration:
          BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[
          Icon(icon, color: foreground, size: 12),
          const SizedBox(width: 4)
        ],
        Flexible(
            child: Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: foreground,
                    fontSize: 10,
                    fontWeight: FontWeight.w600))),
      ]));
}

class FloatingNav extends StatelessWidget {
  const FloatingNav(
      {super.key, required this.selected, required this.onSelected});
  final int selected;
  final ValueChanged<int> onSelected;
  @override
  Widget build(BuildContext context) => Container(
      decoration: const BoxDecoration(color: Colors.white, boxShadow: [
        BoxShadow(
            color: Color(0x06131D23), blurRadius: 16, offset: Offset(0, -4))
      ]),
      child: SafeArea(
          top: false,
          child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 7, 8, 5),
              child: Row(children: [
                NavItem(
                    icon: Icons.school_outlined,
                    label: 'Home',
                    active: selected == 0,
                    onTap: () => onSelected(0)),
                NavItem(
                    icon: Icons.menu_book_outlined,
                    label: 'My Courses',
                    active: selected == 1,
                    onTap: () => onSelected(1)),
                NavItem(
                    icon: Icons.videocam_outlined,
                    label: 'Live Classes',
                    active: selected == 2,
                    onTap: () => onSelected(2)),
                NavItem(
                    icon: Icons.person_outline,
                    label: 'Profile',
                    active: selected == 3,
                    onTap: () => onSelected(3)),
              ]))));
}

class NavItem extends StatelessWidget {
  const NavItem(
      {super.key,
      required this.icon,
      required this.label,
      required this.active,
      required this.onTap});
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Expanded(
      child: Semantics(
          selected: active,
          button: true,
          child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 5),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    AnimatedContainer(
                        duration: const Duration(milliseconds: 160),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 4),
                        decoration: BoxDecoration(
                            color: active ? _mint : Colors.transparent,
                            borderRadius: BorderRadius.circular(30)),
                        child: Icon(icon,
                            size: 23, color: active ? primary : ink)),
                    const SizedBox(height: 3),
                    Text(label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            fontSize: 10,
                            color: active ? primary : ink,
                            fontWeight:
                                active ? FontWeight.w600 : FontWeight.w400)),
                  ])))));
}
