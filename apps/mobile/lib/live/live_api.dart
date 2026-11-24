import 'dart:convert';
import 'dart:io';
import '../api.dart';

class LiveClass {
  const LiveClass(this.data);
  final Map<String, dynamic> data;
  String get id => data['id'] as String;
  String get title => data['title'] as String;
  String get teacher => data['teacherName'] as String;
  String get status => data['status'] as String;
  String get description => data['description'] as String? ?? '';
  String get courseTitle => data['courseTitle'] as String? ?? '';
  String get accessType => data['accessType'] as String;
  String get thumbnail => data['thumbnailUrl'] as String? ?? '';
  bool get accessible => data['accessible'] == true;
  bool get canJoin => data['canJoin'] == true;
  bool get sessionEnded => data['sessionEnded'] == true;
  int get price => (data['price'] as num).toInt();
  int get coursePrice => (data['coursePrice'] as num? ?? 0).toInt();
  int get availableSeats => (data['availableSeats'] as num? ?? 0).toInt();
  int get duration => (data['durationMinutes'] as num).toInt();
  DateTime get startsAt => DateTime.parse(data['startsAt'] as String);
  String get schedule => startsAt.toLocal().toString().substring(0, 16);
}

class LiveApi {
  const LiveApi(this.token);
  final String token;
  static String get baseUrl =>
      StudentApi.baseUrl.replaceFirst(RegExp(r'/student/?$'), '/live');
  Future<Map<String, dynamic>> request(String path,
      {Map<String, dynamic>? body, String? method}) async {
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15);
    try {
      final request = await client.openUrl(
          method ?? (body == null ? 'GET' : 'POST'),
          Uri.parse('$baseUrl$path'));
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
      request.headers.contentType = ContentType.json;
      if (body != null) request.write(jsonEncode(body));
      final response =
          await request.close().timeout(const Duration(seconds: 25));
      final data = jsonDecode(await utf8.decoder.bind(response).join())
          as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw ApiFailure(
            data['error'] as String? ?? 'The classroom request failed.',
            code: data['code'] as String?);
      }
      return data;
    } on SocketException {
      throw const ApiFailure(
          'Cannot reach the classroom server. Check your connection.');
    } finally {
      client.close(force: true);
    }
  }

  Future<List<LiveClass>> classes({String? courseId}) async {
    final query = courseId == null
        ? ''
        : '?courseId=${Uri.encodeQueryComponent(courseId)}';
    final result = await request('/classes$query');
    return (result['data'] as List)
        .map((item) => LiveClass(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<LiveClass> detail(String id) async =>
      LiveClass(Map<String, dynamic>.from(
          (await request('/classes/$id'))['data'] as Map));
}

String livePrice(int amount) =>
    '₹${(amount / 100).toStringAsFixed(amount % 100 == 0 ? 0 : 2)}';
