import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../student_app.dart'
    show canvas, primary, ink, muted, line, SurfaceCard, native;
import 'live_api.dart';
import 'student_classroom.dart';

class LiveClassesPage extends StatefulWidget {
  const LiveClassesPage(
      {super.key,
      required this.token,
      this.courseId,
      this.api,
      this.embedded = false});
  final String token;
  final bool embedded;
  final String? courseId;
  final LiveApi? api;
  @override
  State<LiveClassesPage> createState() => _LiveClassesPageState();
}

class _LiveClassesPageState extends State<LiveClassesPage>
    with WidgetsBindingObserver {
  late final api = widget.api ?? LiveApi(widget.token);
  List<LiveClass> classes = [];
  bool loading = true;
  String? error;
  String filter = 'Upcoming';
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
    timer = Timer.periodic(const Duration(seconds: 20), (_) => load());
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) load();
  }

  Future<void> load() async {
    try {
      final values = await api.classes(courseId: widget.courseId);
      if (mounted) {
        setState(() {
          classes = values;
          error = null;
          loading = false;
        });
      }
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = failure.toString();
          loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final values = classes
        .where((value) => switch (filter) {
              'Live Now' => value.status == 'Live',
              'Upcoming' => value.status == 'Scheduled',
              'My Classes' => value.accessible,
              'Completed' => value.status == 'Completed',
              _ => true
            })
        .toList();
    return Scaffold(
      backgroundColor: canvas,
      appBar: widget.embedded
          ? null
          : AppBar(
              title: const Text('Live Classes'),
              backgroundColor: canvas,
              surfaceTintColor: canvas,
              actions: [
                  IconButton(
                      tooltip: 'Attendance history',
                      icon: const Icon(Icons.history_rounded),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => LiveAttendancePage(api: api)))),
                  IconButton(
                      tooltip: 'Class notifications',
                      icon: const Icon(Icons.notifications_none_rounded),
                      onPressed: () => Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => LiveNotificationsPage(api: api))))
                ]),
      body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(20), children: [
            const Text('Learn together, live.',
                style: TextStyle(
                    color: ink, fontSize: 24, fontWeight: FontWeight.w700)),
            const SizedBox(height: 8),
            const Text(
                'Your scheduled sessions, course workshops and live classrooms.',
                style: TextStyle(color: muted, height: 1.5)),
            const SizedBox(height: 18),
            SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                    children: [
                  'Upcoming',
                  'Live Now',
                  'My Classes',
                  'Completed',
                  'All'
                ]
                        .map((name) => Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                                label: Text(name),
                                selected: filter == name,
                                selectedColor: const Color(0xFFE5FFF2),
                                onSelected: (_) =>
                                    setState(() => filter = name))))
                        .toList())),
            const SizedBox(height: 20),
            if (error != null)
              SurfaceCard(
                  child: Column(children: [
                Text(error!, style: const TextStyle(color: muted)),
                TextButton(onPressed: load, child: const Text('Try again'))
              ])),
            if (loading)
              const Center(
                  child: Padding(
                      padding: EdgeInsets.all(35),
                      child: CircularProgressIndicator())),
            if (!loading && values.isEmpty && error == null)
              const SurfaceCard(
                  child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Column(children: [
                        Icon(Icons.video_camera_front_outlined,
                            size: 42, color: primary),
                        SizedBox(height: 12),
                        Text('No classes in this section yet.',
                            style: TextStyle(color: muted))
                      ]))),
            ...values.map((value) => Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: LiveClassCard(
                    value: value,
                    onTap: () async {
                      await Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) =>
                                  LiveClassDetails(api: api, value: value)));
                      await load();
                    }))),
            const SizedBox(height: 30),
          ])),
    );
  }
}

class LiveClassCard extends StatelessWidget {
  const LiveClassCard({super.key, required this.value, required this.onTap});
  final LiveClass value;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    var thumbnail = value.thumbnail;
    if (thumbnail.startsWith('/uploads/thumbnails/')) {
      thumbnail =
          '${Uri.parse(LiveApi.baseUrl).origin}/api/v1/public/course-thumbnail/${Uri.encodeComponent(thumbnail.split('/').last)}';
    }
    return SurfaceCard(
        child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(18),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (thumbnail.isNotEmpty)
                ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(thumbnail,
                        width: double.infinity,
                        height: 150,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) =>
                            const SizedBox(height: 20))),
              const SizedBox(height: 8),
              Row(children: [
                const Icon(Icons.videocam_outlined, color: primary),
                const SizedBox(width: 8),
                Text(value.status,
                    style: const TextStyle(
                        color: primary, fontWeight: FontWeight.w700)),
                const Spacer(),
                if (value.accessible)
                  const Text('Enrolled',
                      style: TextStyle(
                          color: primary, fontWeight: FontWeight.w600))
              ]),
              const SizedBox(height: 12),
              Text(value.title,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Text(value.teacher, style: const TextStyle(color: muted)),
              const SizedBox(height: 12),
              Text('${value.schedule} · ${value.duration} min',
                  style: const TextStyle(fontSize: 13, color: muted)),
              const SizedBox(height: 5),
              if (value.courseTitle.isNotEmpty)
                Text(value.courseTitle,
                    style: const TextStyle(fontSize: 12, color: muted)),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                    child: Text(
                        value.accessType == 'course'
                            ? 'Included in course'
                            : value.price == 0
                                ? 'Free class'
                                : livePrice(value.price),
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, color: primary))),
                TextButton(
                    onPressed: onTap,
                    child: Text(
                        value.canJoin ? 'Join live class →' : 'View class →'))
              ]),
            ])));
  }
}

class LiveClassDetails extends StatefulWidget {
  const LiveClassDetails({super.key, required this.api, required this.value});
  final LiveApi api;
  final LiveClass value;
  @override
  State<LiveClassDetails> createState() => _LiveClassDetailsState();
}

class _LiveClassDetailsState extends State<LiveClassDetails>
    with WidgetsBindingObserver {
  late LiveClass value = widget.value;
  late final Razorpay razorpay;
  String? orderId, error;
  bool busy = false;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    razorpay = Razorpay()
      ..on(Razorpay.EVENT_PAYMENT_SUCCESS, success)
      ..on(Razorpay.EVENT_PAYMENT_ERROR, failure);
    refresh();
    timer = Timer.periodic(const Duration(seconds: 15), (_) => refresh());
  }

  @override
  void dispose() {
    timer?.cancel();
    razorpay.clear();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh();
  }

  Future<void> downloadRecording() async {
    try {
      final recording = value.data['recording'] as Map;
      await const MethodChannel('northstar/native')
          .invokeMethod('downloadFile', {
        'url': '${LiveApi.baseUrl}/classes/${value.id}/recording',
        'name':
            'class-${recording['id']}.${recording['mime'] == 'video/webm' ? 'webm' : 'mp4'}',
        'authorization': widget.api.token,
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Recording download started. Check your Downloads folder.')));
      }
    } catch (_) {
      if (mounted) {
        setState(() => error =
            'Could not start the recording download. Please try again.');
      }
    }
  }

  Future<void> refresh() async {
    try {
      final next = await widget.api.detail(value.id);
      if (mounted) setState(() => value = next);
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    }
  }

  Future<void> success(PaymentSuccessResponse response) async {
    if (orderId == null ||
        response.paymentId == null ||
        response.signature == null) {
      return;
    }
    try {
      await widget.api.request('/orders/$orderId/verify', body: {
        'paymentId': response.paymentId,
        'signature': response.signature
      });
      await refresh();
      if (mounted) {
        setState(() {
          error = null;
          busy = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Payment verified. Your access is active.')));
      }
    } catch (failure) {
      if (mounted) {
        setState(() {
          error =
              '$failure Your enrollment refreshes automatically when the provider confirms payment.';
          busy = false;
        });
      }
    }
  }

  void failure(PaymentFailureResponse response) {
    if (mounted) {
      setState(() {
        error = response.message ??
            'Payment was not completed. No access was granted.';
        busy = false;
      });
    }
  }

  Future<void> purchase(String kind) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final random = Random.secure();
      final key = List.generate(
              24, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'))
          .join();
      final checkout = await widget.api.request('/classes/${value.id}/checkout',
          body: {'kind': kind, 'idempotencyKey': key});
      if (checkout['alreadyEnrolled'] == true) {
        await refresh();
        if (mounted) setState(() => busy = false);
        return;
      }
      final order = checkout['order'] as Map<String, dynamic>;
      orderId = order['id'] as String;
      razorpay.open({
        'key': order['keyId'],
        'order_id': order['providerOrderId'],
        'amount': order['amount'],
        'currency': order['currency'],
        'name': order['name'],
        'description': kind == 'course'
            ? 'Complete course package'
            : 'Live classroom enrollment',
        'theme': {'color': '#006D2F'}
      });
    } catch (failure) {
      if (mounted) {
        setState(() {
          error = failure.toString();
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
          title: const Text('Live class details'),
          backgroundColor: canvas,
          surfaceTintColor: canvas),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        LiveClassCard(value: value, onTap: () {}),
        const SizedBox(height: 16),
        SurfaceCard(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
              value.description.isEmpty
                  ? 'Join your teacher for an interactive learning session.'
                  : value.description,
              style: const TextStyle(height: 1.6)),
          const Divider(height: 28, color: line),
          Text('Teacher: ${value.teacher}'),
          const SizedBox(height: 8),
          Text('Your local time: ${value.schedule}'),
          const SizedBox(height: 8),
          Text('Class time zone: ${value.data['timeZone']}'),
          const SizedBox(height: 8),
          Text('Duration: ${value.duration} minutes'),
          const SizedBox(height: 8),
          Text('Available seats: ${value.availableSeats}'),
          const SizedBox(height: 8),
          Text('Payment status: ${value.data['paymentStatus']}'),
          const SizedBox(height: 16),
          const Text('Learning objectives',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(value.data['objectives'] as String? ?? ''),
          const SizedBox(height: 16),
          const Text('Class instructions',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(value.data['instructions'] as String? ?? '')
        ])),
        const SizedBox(height: 16),
        if (error != null)
          Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: Text(error!, style: const TextStyle(color: muted))),
        if (value.accessible && value.data['recording'] != null)
          Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: OutlinedButton.icon(
                  onPressed: downloadRecording,
                  icon: const Icon(Icons.download_outlined),
                  label: const Text('Download class recording'))),
        if (value.sessionEnded)
          const SurfaceCard(
              child: Text(
                  'Your session was ended by the teacher. You cannot rejoin this class.',
                  style: TextStyle(color: muted)))
        else if (value.canJoin)
          FilledButton.icon(
              onPressed: busy
                  ? null
                  : () async {
                      await Navigator.push(
                          context,
                          MaterialPageRoute(
                              builder: (_) => StudentClassroom(
                                  api: widget.api, value: value)));
                      await refresh();
                    },
              icon: const Icon(Icons.videocam_outlined),
              label: const Text('Join Live Class'))
        else if (value.status == 'Completed' || value.status == 'Cancelled')
          SurfaceCard(child: Center(child: Text('Class ${value.status}')))
        else if (value.accessible)
          const SurfaceCard(
              child: Column(children: [
            Icon(Icons.check_circle_outline, color: primary),
            SizedBox(height: 8),
            Text('Already Enrolled'),
            SizedBox(height: 5),
            Text('Class Not Started', style: TextStyle(color: muted))
          ]))
        else ...[
          if (value.accessType != 'course')
            FilledButton(
                onPressed: busy || value.availableSeats == 0
                    ? null
                    : () => purchase('class'),
                child: Text(busy
                    ? 'Please wait…'
                    : value.price == 0
                        ? 'Enroll in free class'
                        : 'Pay for Class — ${livePrice(value.price)}')),
          if (value.accessType != 'individual' && value.courseTitle.isNotEmpty)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child: OutlinedButton(
                    onPressed: busy ? null : () => purchase('course'),
                    child: Text(
                        'Buy Complete Course — ${livePrice(value.coursePrice)}'))),
        ],
        const SizedBox(height: 14),
        if (value.accessType != 'individual')
          const Text(
              'An existing course purchase includes this session. You will not be charged twice for access you already own.',
              style: TextStyle(color: muted, fontSize: 12, height: 1.5)),
        const SizedBox(height: 25),
      ]));
}

class LiveCourseSessions extends StatefulWidget {
  const LiveCourseSessions({super.key, required this.courseId});
  final String courseId;
  @override
  State<LiveCourseSessions> createState() => _LiveCourseSessionsState();
}

class _LiveCourseSessionsState extends State<LiveCourseSessions> {
  List<LiveClass> classes = [];
  String? token;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final saved = await native.invokeMethod<String>('readToken');
      if (saved == null) return;
      final values = await LiveApi(saved).classes(courseId: widget.courseId);
      if (mounted) {
        setState(() {
          token = saved;
          classes = values;
        });
      }
    } catch (_) {
      /* Existing course content stays usable while live services are offline. */
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(top: 18),
      child: SurfaceCard(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Live sessions',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Text(
            classes.isEmpty
                ? 'No live sessions scheduled for this course yet.'
                : '${classes.length} live sessions in this course',
            style: const TextStyle(color: muted)),
        ...classes.take(3).map((value) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.videocam_outlined, color: primary),
            title: Text(value.title),
            subtitle: Text('${value.schedule} · ${value.status}'),
            onTap: token == null
                ? null
                : () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => LiveClassDetails(
                            api: LiveApi(token!), value: value))))),
        if (token != null && classes.isNotEmpty)
          TextButton(
              onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => LiveClassesPage(
                          token: token!, courseId: widget.courseId))),
              child: const Text('View all live sessions →'))
      ])));
}

class LiveNotificationsPage extends StatefulWidget {
  const LiveNotificationsPage({super.key, required this.api});
  final LiveApi api;
  @override
  State<LiveNotificationsPage> createState() => _LiveNotificationsPageState();
}

class _LiveNotificationsPageState extends State<LiveNotificationsPage> {
  List<Map<String, dynamic>> values = [];
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final response = await widget.api.request('/notifications');
      if (mounted) {
        setState(() {
          values = (response['data'] as List)
              .map((value) => Map<String, dynamic>.from(value as Map))
              .toList();
          error = null;
        });
      }
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
          title: const Text('Class notifications'), backgroundColor: canvas),
      body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(20), children: [
            if (error != null) Text(error!),
            if (values.isEmpty && error == null)
              const Text('No class notifications yet.',
                  style: TextStyle(color: muted)),
            ...values.map((value) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: SurfaceCard(
                    child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                            value['read'] == true
                                ? Icons.notifications_none
                                : Icons.notifications_active_outlined,
                            color: primary),
                        title: Text(value['title'] as String),
                        subtitle: Text(value['body'] as String),
                        onTap: () async {
                          await widget.api.request(
                              '/notifications/${value['id']}',
                              method: 'PATCH',
                              body: {});
                          await load();
                        }))))
          ])));
}

class LiveAttendancePage extends StatefulWidget {
  const LiveAttendancePage({super.key, required this.api});
  final LiveApi api;
  @override
  State<LiveAttendancePage> createState() => _LiveAttendancePageState();
}

class _LiveAttendancePageState extends State<LiveAttendancePage> {
  List<Map<String, dynamic>> values = [];
  bool loading = true;
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = await widget.api.request('/history');
      if (mounted) {
        setState(() {
          values = (result['data'] as List)
              .map((item) => Map<String, dynamic>.from(item as Map))
              .toList()
              .reversed
              .toList();
          loading = false;
          error = null;
        });
      }
    } catch (failure) {
      if (mounted) {
        setState(() {
          loading = false;
          error = failure.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      backgroundColor: canvas,
      appBar: AppBar(
          title: const Text('Attendance history'), backgroundColor: canvas),
      body: RefreshIndicator(
          onRefresh: load,
          child: ListView(padding: const EdgeInsets.all(20), children: [
            if (loading) const Center(child: CircularProgressIndicator()),
            if (error != null) Text(error!),
            if (!loading && error == null && values.isEmpty)
              const Text(
                  'Your classroom attendance will appear here after joining.',
                  style: TextStyle(color: muted)),
            ...values.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: SurfaceCard(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(item['title'] as String,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Text(
                          'Joined: ${DateTime.parse(item['joinedAt'] as String).toLocal().toString().substring(0, 16)}',
                          style: const TextStyle(color: muted)),
                      const SizedBox(height: 6),
                      Text(
                          item['leftAt'] == null
                              ? 'Session in progress'
                              : '${(item['durationSeconds'] as num) ~/ 60} min ${(item['durationSeconds'] as num).toInt() % 60} sec attended',
                          style: const TextStyle(color: primary)),
                    ])))),
          ])));
}
