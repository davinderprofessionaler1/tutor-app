import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:livekit_client/livekit_client.dart' as lk;
import '../student_app.dart'
    show canvas, primary, muted, ink, line, SurfaceCard;
import 'live_api.dart';

class StudentClassroom extends StatefulWidget {
  const StudentClassroom({super.key, required this.api, required this.value});
  final LiveApi api;
  final LiveClass value;
  @override
  State<StudentClassroom> createState() => _StudentClassroomState();
}

class _StudentClassroomState extends State<StudentClassroom>
    with WidgetsBindingObserver {
  lk.Room? room;
  Map<String, dynamic>? session, snapshot;
  final message = TextEditingController();
  Timer? pulseTimer, clockTimer;
  bool busy = false, polling = false, raised = false, closing = false;
  String? error, closedStatus;
  int elapsed = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    connect();
    pulseTimer = Timer.periodic(const Duration(seconds: 3), (_) => pulse());
    clockTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final started = widget.value.data['startedAt'] as String?;
      if (mounted && started != null) {
        setState(() => elapsed = DateTime.now()
            .difference(DateTime.parse(started))
            .inSeconds
            .clamp(0, 86400));
      }
    });
  }

  @override
  void dispose() {
    closing = true;
    pulseTimer?.cancel();
    clockTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    room?.removeListener(changed);
    unawaited(leave());
    message.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      unawaited(room?.localParticipant?.setCameraEnabled(false));
      unawaited(room?.localParticipant?.setMicrophoneEnabled(false));
    }
    if (state == AppLifecycleState.resumed) pulse();
  }

  void changed() {
    if (mounted && !closing) setState(() {});
    subscribeTeacher();
  }

  bool isTeacher(lk.RemoteParticipant participant) {
    try {
      return (jsonDecode(participant.metadata ?? '{}') as Map)['role'] ==
          'teacher';
    } catch (_) {
      return false;
    }
  }

  void subscribeTeacher() {
    final current = room;
    if (current == null) return;
    for (final participant in current.remoteParticipants.values) {
      for (final publication in [
        ...participant.videoTrackPublications,
        ...participant.audioTrackPublications
      ]) {
        if (isTeacher(participant) && !publication.subscribed) {
          unawaited(publication.subscribe().catchError((Object _) {}));
        } else if (!isTeacher(participant) && publication.subscribed) {
          unawaited(publication.unsubscribe().catchError((Object _) {}));
        }
      }
    }
  }

  Future<void> connect() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await leave();
      final joined = await widget.api
          .request('/classes/${widget.value.id}/join', body: {});
      final next = lk.Room(
          roomOptions:
              const lk.RoomOptions(adaptiveStream: true, dynacast: true));
      session = joined;
      room = next;
      next.addListener(changed);
      await next.connect(joined['url'] as String, joined['token'] as String,
          connectOptions: const lk.ConnectOptions(autoSubscribe: false));
      subscribeTeacher();
      await pulse();
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
      await leave();
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> leave() async {
    final old = session;
    session = null;
    snapshot = null;
    raised = false;
    final oldRoom = room;
    room = null;
    oldRoom?.removeListener(changed);
    await oldRoom?.disconnect();
    await oldRoom?.dispose();
    if (old != null) {
      try {
        await widget.api.request('/classes/${widget.value.id}/interact',
            body: {'action': 'leave', 'ticketId': old['ticketId']});
      } catch (_) {/* Server reconciles disconnected sessions. */}
    }
  }

  Future<void> pulse() async {
    if (session == null || polling || closing || busy) return;
    if (room?.connectionState == lk.ConnectionState.disconnected) {
      polling = true;
      try {
        final latest = await widget.api.detail(widget.value.id);
        if (latest.status == 'Completed' || latest.status == 'Cancelled') {
          closedStatus = latest.status;
        }
      } catch (_) {/* A network failure can still be retried. */}
      await leave();
      if (mounted) {
        setState(() => error = closedStatus == null
            ? 'Connection lost. Reconnect to rejoin the classroom.'
            : 'Class $closedStatus. This session is closed.');
      }
      polling = false;
      return;
    }
    polling = true;
    try {
      final result = await widget.api.request(
          '/classes/${widget.value.id}/interact',
          body: {'action': 'heartbeat', 'ticketId': session!['ticketId']});
      if (mounted) {
        setState(() {
          snapshot = result;
          raised = result['raisedHand'] == true;
          error = null;
        });
      }
      subscribeTeacher();
      if (result['microphone'] != true &&
          room?.localParticipant?.isMicrophoneEnabled() == true) {
        await room?.localParticipant?.setMicrophoneEnabled(false);
      }
      if (result['camera'] != true &&
          room?.localParticipant?.isCameraEnabled() == true) {
        await room?.localParticipant?.setCameraEnabled(false);
      }
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
      if (failure.toString().contains('ended') ||
          failure.toString().contains('enrollment')) {
        try {
          final latest = await widget.api.detail(widget.value.id);
          if (latest.status == 'Completed' || latest.status == 'Cancelled') {
            closedStatus = latest.status;
          }
        } catch (_) {/* Keep the original session error. */}
        await leave();
        if (mounted && closedStatus != null) {
          setState(
              () => error = 'Class $closedStatus. This session is closed.');
        }
      }
    } finally {
      polling = false;
    }
  }

  Future<void> interact(Map<String, dynamic> input) async {
    if (session == null) return;
    try {
      final result = await widget.api.request(
          '/classes/${widget.value.id}/interact',
          body: {...input, 'ticketId': session!['ticketId']});
      if (mounted) {
        setState(() {
          snapshot = result;
          raised = result['raisedHand'] == true;
          error = null;
        });
      }
    } catch (failure) {
      if (mounted) setState(() => error = failure.toString());
    }
  }

  Future<void> media(Future<dynamic> Function() action) async {
    try {
      await action();
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) {
        setState(() => error =
            'Media access was not granted. Check device permission and teacher approval.');
      }
    }
  }

  lk.VideoTrack? get stage {
    final teachers = room?.remoteParticipants.values.where(isTeacher) ??
        <lk.RemoteParticipant>[];
    for (final source in [
      lk.TrackSource.screenShareVideo,
      lk.TrackSource.camera
    ]) {
      for (final teacher in teachers) {
        final publication = teacher.getTrackPublicationBySource(source);
        if (publication?.track is lk.VideoTrack &&
            publication?.muted == false) {
          return publication!.track as lk.VideoTrack;
        }
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final video = stage, local = room?.localParticipant;
    final messages = snapshot?['messages'] as List? ?? [],
        participants = snapshot?['participants'] as List? ?? [];
    final connected = room?.connectionState == lk.ConnectionState.connected;
    return Scaffold(
        backgroundColor: canvas,
        appBar: AppBar(
            title: Text(widget.value.title,
                maxLines: 1, overflow: TextOverflow.ellipsis),
            backgroundColor: canvas),
        body: ListView(padding: const EdgeInsets.all(16), children: [
          Wrap(spacing: 14, runSpacing: 8, children: [
            Text(
                connected
                    ? '● LIVE'
                    : closedStatus ??
                        room?.connectionState.name ??
                        'Disconnected',
                style: const TextStyle(
                    color: primary, fontWeight: FontWeight.w700)),
            Text(
                '${elapsed ~/ 60}:${(elapsed % 60).toString().padLeft(2, '0')}',
                style: const TextStyle(color: muted)),
            Text('${participants.length} participants',
                style: const TextStyle(color: muted)),
            Text('Network: ${local?.connectionQuality.name ?? 'unknown'}',
                style: const TextStyle(color: muted))
          ]),
          const SizedBox(height: 14),
          ClipRRect(
              borderRadius: BorderRadius.circular(18),
              child: AspectRatio(
                  aspectRatio: 16 / 10,
                  child: ColoredBox(
                      color: ink,
                      child: video != null
                          ? lk.VideoTrackRenderer(video)
                          : Center(
                              child: Padding(
                                  padding: const EdgeInsets.all(24),
                                  child: Column(
                                      mainAxisAlignment:
                                          MainAxisAlignment.center,
                                      children: [
                                        if (busy)
                                          const CircularProgressIndicator()
                                        else
                                          const Icon(
                                              Icons.videocam_off_outlined,
                                              color: Colors.white70,
                                              size: 42),
                                        const SizedBox(height: 14),
                                        Text(
                                            busy
                                                ? 'Connecting to your classroom…'
                                                : connected
                                                    ? 'Waiting for the teacher’s camera or screen share.'
                                                    : 'The classroom connection is closed.',
                                            textAlign: TextAlign.center,
                                            style: const TextStyle(
                                                color: Colors.white70,
                                                height: 1.5))
                                      ])))))),
          const SizedBox(height: 14),
          if (error != null)
            Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(error!, style: const TextStyle(color: muted))),
          Wrap(spacing: 8, runSpacing: 8, children: [
            FilledButton.icon(
                onPressed: session == null
                    ? null
                    : () async {
                        setState(() => raised = !raised);
                        await interact({'action': 'hand', 'raised': raised});
                      },
                icon: const Icon(Icons.front_hand_outlined),
                label:
                    Text(raised ? 'Lower hand' : 'Raise hand / request mic')),
            OutlinedButton.icon(
                onPressed: snapshot?['microphone'] == true && connected
                    ? () => media(() => local!
                        .setMicrophoneEnabled(!local.isMicrophoneEnabled()))
                    : null,
                icon: Icon(local?.isMicrophoneEnabled() == true
                    ? Icons.mic
                    : Icons.mic_off_outlined),
                label: Text(snapshot?['microphone'] == true
                    ? 'Microphone'
                    : 'Mic needs teacher approval')),
            OutlinedButton.icon(
                onPressed: snapshot?['camera'] == true && connected
                    ? () => media(
                        () => local!.setCameraEnabled(!local.isCameraEnabled()))
                    : null,
                icon: const Icon(Icons.videocam_outlined),
                label: const Text('Camera')),
            if (!connected && closedStatus == null)
              OutlinedButton(
                  onPressed: busy ? null : connect,
                  child: const Text('Reconnect')),
            TextButton(
                onPressed: () async {
                  await leave();
                  if (context.mounted) Navigator.pop(context);
                },
                child: const Text('Leave class')),
          ]),
          const SizedBox(height: 18),
          SurfaceCard(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                const Text('Live chat',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                if (snapshot?['chatEnabled'] == false)
                  const Text('The teacher has paused chat.',
                      style: TextStyle(color: muted)),
                if (messages.isEmpty)
                  const Text('Class messages will appear here.',
                      style: TextStyle(color: muted)),
                ...messages.map((item) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item['name'] as String,
                              style: const TextStyle(
                                  color: primary,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12)),
                          const SizedBox(height: 3),
                          Text(item['text'] as String,
                              style: const TextStyle(height: 1.5))
                        ]))),
                const Divider(color: line),
                Row(children: [
                  Expanded(
                      child: TextField(
                          controller: message,
                          maxLength: 1000,
                          enabled: session != null &&
                              snapshot?['chatEnabled'] == true,
                          decoration: const InputDecoration(
                              hintText: 'Message your class',
                              counterText: ''))),
                  IconButton(
                      tooltip: 'Send message',
                      onPressed: session == null ||
                              snapshot?['chatEnabled'] != true
                          ? null
                          : () async {
                              final text = message.text.trim();
                              if (text.isEmpty) return;
                              await interact({'action': 'chat', 'text': text});
                              if (error == null) message.clear();
                            },
                      icon: const Icon(Icons.send_outlined, color: primary))
                ])
              ])),
          const SizedBox(height: 20),
        ]));
  }
}
